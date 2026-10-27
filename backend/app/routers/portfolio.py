import datetime
import uuid
from fastapi import APIRouter, HTTPException, Depends
from backend.app.db.database import get_db
from backend.app.schemas.portfolio import PortfolioOut, HoldingOut, TradeRequest, TradeResponse
from backend.app.services.price_loader import fetch_all_prices, update_portfolio_from_cache

router = APIRouter(tags=["portfolio"])

@router.get("/portfolio", response_model=PortfolioOut)
def get_portfolio():
    """Retrieve the current portfolio, equity holdings, weights, and daily moves."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Portfolio header
        cursor.execute("SELECT id, name, cash_balance FROM portfolios WHERE id = 'default'")
        port_row = cursor.fetchone()
        if not port_row:
            raise HTTPException(status_code=404, detail="Portfolio not found")
            
        cash = float(port_row["cash_balance"])
        
        # Holdings
        cursor.execute("""
            SELECT id, ticker, name, sector, quantity, avg_buy_price, 
                   current_price, beta, weight, day_change_pct, updated_at
            FROM holdings
            WHERE portfolio_id = 'default'
            ORDER BY weight DESC
        """)
        rows = cursor.fetchall()
        
        holdings = []
        total_equity = 0.0
        
        for r in rows:
            qty = int(r["quantity"])
            price = float(r["current_price"]) if r["current_price"] > 0 else float(r["avg_buy_price"])
            val = round(qty * price, 2)
            total_equity += val
            
            holdings.append(HoldingOut(
                id=r["id"],
                name=r["name"],
                ticker=r["ticker"],
                sector=r["sector"],
                weight=float(r["weight"]),
                beta=float(r["beta"]),
                day=float(r["day_change_pct"]),
                quantity=qty,
                current_price=price,
                value=val
            ))
            
        total_val = round(cash + total_equity, 2)
        
        return PortfolioOut(
            portfolio_id=port_row["id"],
            portfolio_value=total_val,
            cash_balance=cash,
            total_equity_value=total_equity,
            holdings=holdings,
            last_updated=datetime.datetime.utcnow().isoformat(),
            is_live=True
        )

@router.post("/paper/trade", response_model=TradeResponse)
def execute_paper_trade(order: TradeRequest):
    """
    Validate and execute a simulated paper trade.
    Updates holding quantity, cash balance, and logs trade to audit trail.
    """
    if not order.confirmed:
        raise HTTPException(status_code=400, detail="Order requires explicit confirmation.")
        
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Verify holding exists
        cursor.execute("SELECT id, ticker, name, quantity, current_price, avg_buy_price FROM holdings WHERE id = ? AND portfolio_id = 'default'", (order.holding_id,))
        holding = cursor.fetchone()
        if not holding:
            raise HTTPException(status_code=404, detail=f"Holding '{order.holding_id}' not found in portfolio.")
            
        price = order.price if order.price and order.price > 0 else holding["current_price"]
        total_val = round(order.quantity * price, 2)
        current_qty = holding["quantity"]
        
        # Verify portfolio cash for buys or shares for sells
        cursor.execute("SELECT cash_balance FROM portfolios WHERE id = 'default'")
        port = cursor.fetchone()
        cash = port["cash_balance"]
        
        if order.side == "buy":
            if cash < total_val:
                raise HTTPException(status_code=400, detail=f"Insufficient funds: trade requires ₹{total_val}, cash balance is ₹{cash}.")
            new_qty = current_qty + order.quantity
            new_cash = cash - total_val
        else: # sell
            if current_qty < order.quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient shares: cannot sell {order.quantity} of {current_qty} held.")
            new_qty = current_qty - order.quantity
            new_cash = cash + total_val
            
        # Update holding
        cursor.execute("""
            UPDATE holdings 
            SET quantity = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (new_qty, order.holding_id))
        
        # Update cash
        cursor.execute("UPDATE portfolios SET cash_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'default'", (new_cash,))
        
        # Log paper trade
        trade_id = f"ptrade-{uuid.uuid4().hex[:8]}"
        now_iso = datetime.datetime.utcnow().isoformat()
        cursor.execute("""
            INSERT INTO paper_trades (
                id, portfolio_id, holding_id, ticker, side, quantity, price, total_val, status, confirmed, created_at
            ) VALUES (?, 'default', ?, ?, ?, ?, ?, ?, 'executed', 1, ?)
        """, (trade_id, order.holding_id, holding["ticker"], order.side, order.quantity, price, total_val, now_iso))
        
        # Recalculate weights
        update_portfolio_from_cache(conn=conn)
        
        action_word = "Bought" if order.side == "buy" else "Sold"
        return TradeResponse(
            success=True,
            simulated=True,
            message=f"{action_word} {order.quantity} shares of {holding['name']} at ₹{price:,.2f} (Total: ₹{total_val:,.2f}).",
            trade_id=trade_id,
            holding_id=order.holding_id,
            side=order.side,
            quantity=order.quantity,
            price=price,
            total_val=total_val,
            timestamp=now_iso
        )

@router.post("/portfolio/refresh")
def refresh_market_data():
    """Trigger background refresh of all stock prices from Yahoo Finance."""
    cached_count = fetch_all_prices()
    update_portfolio_from_cache()
    return {"success": True, "records_cached": cached_count, "timestamp": datetime.datetime.utcnow().isoformat()}
