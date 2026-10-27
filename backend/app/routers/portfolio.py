import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from backend.app.db.database import get_db
from backend.app.schemas.portfolio import (
    PortfolioOut,
    HoldingOut,
    TradeRequest,
    TradeResponse,
    PaperOrderOut,
    CancelOrderResponse,
    ProcessedOrderResult,
    ProcessOrdersResponse,
)
from backend.app.services.price_loader import fetch_all_prices, update_portfolio_from_cache
from backend.app.services.orders import (
    get_portfolio_cash_and_reserves,
    get_holding_shares_and_reserves,
    place_and_evaluate_paper_trade,
    process_pending_orders,
    cancel_pending_order,
)

router = APIRouter(tags=["portfolio"])

@router.get("/portfolio", response_model=PortfolioOut)
def get_portfolio():
    """Retrieve the current portfolio, equity holdings, weights, daily moves, and cash reserves."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Portfolio header & cash reserves
        cash, reserved_cash, available_cash = get_portfolio_cash_and_reserves(conn, "default")
        
        # Pending orders count
        cursor.execute("""
            SELECT COUNT(*) as pending_cnt
            FROM paper_trades
            WHERE portfolio_id = 'default' AND UPPER(status) = 'PENDING'
        """)
        pending_cnt_row = cursor.fetchone()
        pending_orders_count = int(pending_cnt_row["pending_cnt"]) if pending_cnt_row else 0
        
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
            
            # Calculate reserved shares in pending sell orders
            _, reserved_qty, avail_qty = get_holding_shares_and_reserves(conn, r["id"], "default")
            
            holdings.append(HoldingOut(
                id=r["id"],
                name=r["name"],
                ticker=r["ticker"],
                sector=r["sector"],
                weight=float(r["weight"]),
                beta=float(r["beta"]),
                day=float(r["day_change_pct"]),
                quantity=qty,
                reserved_quantity=reserved_qty,
                available_quantity=avail_qty,
                current_price=price,
                value=val
            ))
            
        total_val = round(cash + total_equity, 2)
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        return PortfolioOut(
            portfolio_id="default",
            portfolio_value=total_val,
            cash_balance=cash,
            reserved_cash=reserved_cash,
            available_cash=available_cash,
            total_equity_value=total_equity,
            holdings=holdings,
            pending_orders_count=pending_orders_count,
            last_updated=now_iso,
            is_live=True
        )

@router.post("/paper/trade", response_model=TradeResponse)
def execute_paper_trade(order: TradeRequest):
    """
    Validate, place, and evaluate simulated paper trade (market or limit).
    Updates holding quantity and cash balance atomically if immediately eligible,
    or persists order as PENDING with reserved funds/shares if not yet triggered.
    """
    with get_db() as conn:
        return place_and_evaluate_paper_trade(order, conn)

@router.get("/paper/orders", response_model=List[PaperOrderOut])
def get_paper_orders(status: Optional[str] = None):
    """
    Retrieve order history and pending orders for the portfolio.
    Filter by status (e.g. ?status=PENDING) if specified.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT p.id, p.portfolio_id, p.holding_id, h.name as holding_name,
                   p.ticker, p.side, p.order_type, p.quantity, p.price,
                   p.limit_price, p.executed_price, h.current_price as market_price,
                   p.total_val, p.status, p.confirmed, p.created_at, p.executed_at
            FROM paper_trades p
            LEFT JOIN holdings h ON p.holding_id = h.id
            WHERE p.portfolio_id = 'default'
        """
        params = []
        if status:
            query += " AND UPPER(p.status) = ?"
            params.append(status.strip().upper())
            
        query += " ORDER BY p.created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        orders = []
        for r in rows:
            orders.append(PaperOrderOut(
                id=r["id"],
                portfolio_id=r["portfolio_id"],
                holding_id=r["holding_id"],
                holding_name=r["holding_name"] or r["ticker"],
                ticker=r["ticker"],
                side=r["side"],
                order_type=r["order_type"] or "market",
                quantity=int(r["quantity"]),
                price=float(r["price"]),
                limit_price=float(r["limit_price"]) if r["limit_price"] is not None else None,
                executed_price=float(r["executed_price"]) if r["executed_price"] is not None else None,
                market_price=float(r["market_price"]) if r["market_price"] is not None else None,
                total_val=float(r["total_val"]),
                status=r["status"].upper(),
                confirmed=bool(r["confirmed"]),
                created_at=r["created_at"],
                executed_at=r["executed_at"],
            ))
        return orders

@router.post("/paper/orders/{order_id}/cancel", response_model=CancelOrderResponse)
def cancel_order(order_id: str):
    """Cancel a pending paper order and release its reserved cash/shares."""
    with get_db() as conn:
        return cancel_pending_order(order_id, conn)

@router.post("/paper/orders/process", response_model=ProcessOrdersResponse)
def process_orders():
    """
    Explicitly trigger evaluation of all pending limit orders against current market prices.
    Executes all eligible orders atomically.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM paper_trades WHERE portfolio_id = 'default' AND UPPER(status) = 'PENDING'")
        pending_count = int(cursor.fetchone()["cnt"])
        
        executed = process_pending_orders(conn=conn)
        
        results = [
            ProcessedOrderResult(
                order_id=item["order_id"],
                holding_id=item["holding_id"],
                holding_name=item["holding_name"],
                side=item["side"],
                quantity=item["quantity"],
                limit_price=item["limit_price"],
                executed_price=item["executed_price"],
                total_val=item["total_val"],
                status=item["status"],
                message=item["message"]
            )
            for item in executed
        ]
        
        return ProcessOrdersResponse(
            success=True,
            processed_count=pending_count,
            executed_count=len(executed),
            executed_orders=results,
            message=f"Processed {pending_count} pending orders. {len(executed)} executed."
        )

@router.post("/portfolio/refresh")
def refresh_market_data():
    """
    Trigger background refresh of all stock prices from Yahoo Finance,
    update portfolio valuations, and evaluate pending limit orders for execution.
    """
    cached_count = fetch_all_prices()
    update_portfolio_from_cache()
    executed_orders = process_pending_orders()
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    return {
        "success": True,
        "records_cached": cached_count,
        "executed_orders_count": len(executed_orders),
        "executed_orders": executed_orders,
        "timestamp": now_iso
    }

