import sqlite3
import uuid
import datetime
import logging
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException
from backend.app.db.database import get_db
from backend.app.schemas.portfolio import (
    TradeRequest,
    TradeResponse,
    PaperOrderOut,
    CancelOrderResponse,
    ProcessedOrderResult,
    ProcessOrdersResponse,
)
from backend.app.services.price_loader import update_portfolio_from_cache

logger = logging.getLogger("crisis_twin.orders")

def get_portfolio_cash_and_reserves(conn: sqlite3.Connection, portfolio_id: str = "default") -> Tuple[float, float, float]:
    """
    Returns (cash_balance, reserved_cash, available_cash) for a portfolio.
    reserved_cash is the sum of total_val for all PENDING buy orders.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT cash_balance FROM portfolios WHERE id = ?", (portfolio_id,))
    port = cursor.fetchone()
    if not port:
        raise HTTPException(status_code=404, detail=f"Portfolio '{portfolio_id}' not found.")
    
    cash_balance = float(port["cash_balance"])
    
    cursor.execute("""
        SELECT COALESCE(SUM(total_val), 0.0) as reserved_cash
        FROM paper_trades
        WHERE portfolio_id = ? AND UPPER(status) = 'PENDING' AND side = 'buy'
    """, (portfolio_id,))
    res_row = cursor.fetchone()
    reserved_cash = float(res_row["reserved_cash"]) if res_row else 0.0
    available_cash = max(0.0, round(cash_balance - reserved_cash, 2))
    
    return cash_balance, reserved_cash, available_cash

def get_holding_shares_and_reserves(conn: sqlite3.Connection, holding_id: str, portfolio_id: str = "default") -> Tuple[int, int, int]:
    """
    Returns (total_quantity, reserved_shares, available_shares) for a holding.
    reserved_shares is the sum of quantity for all PENDING sell orders for this holding.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT quantity FROM holdings WHERE id = ? AND portfolio_id = ?", (holding_id, portfolio_id))
    holding = cursor.fetchone()
    if not holding:
        raise HTTPException(status_code=404, detail=f"Holding '{holding_id}' not found in portfolio.")
    
    total_quantity = int(holding["quantity"])
    
    cursor.execute("""
        SELECT COALESCE(SUM(quantity), 0) as reserved_shares
        FROM paper_trades
        WHERE portfolio_id = ? AND holding_id = ? AND UPPER(status) = 'PENDING' AND side = 'sell'
    """, (portfolio_id, holding_id))
    res_row = cursor.fetchone()
    reserved_shares = int(res_row["reserved_shares"]) if res_row else 0
    available_shares = max(0, total_quantity - reserved_shares)
    
    return total_quantity, reserved_shares, available_shares

def place_and_evaluate_paper_trade(order: TradeRequest, conn: sqlite3.Connection) -> TradeResponse:
    """
    Validate, place, and potentially execute a simulated paper trade.
    Enforces correct limit order semantics:
      - Buy limit: if market_price <= limit_price -> immediate execution; else PENDING.
      - Sell limit: if market_price >= limit_price -> immediate execution; else PENDING.
      - Market order: always immediate execution.
    Handles fund/share reservations atomically.
    """
    if not order.confirmed:
        raise HTTPException(status_code=400, detail="Order requires explicit confirmation.")
    
    if order.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero.")
        
    side = order.side.strip().lower()
    if side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="Side must be 'buy' or 'sell'.")
        
    order_type = (order.order_type or "market").strip().lower()
    if order_type not in ("market", "limit"):
        raise HTTPException(status_code=400, detail="Order type must be 'market' or 'limit'.")
        
    cursor = conn.cursor()
    
    # 1. Fetch holding
    cursor.execute("""
        SELECT id, ticker, name, quantity, current_price, avg_buy_price 
        FROM holdings 
        WHERE id = ? AND portfolio_id = 'default'
    """, (order.holding_id,))
    holding = cursor.fetchone()
    if not holding:
        raise HTTPException(status_code=404, detail=f"Holding '{order.holding_id}' not found in portfolio.")
        
    market_price = float(holding["current_price"]) if holding["current_price"] and holding["current_price"] > 0 else float(holding["avg_buy_price"])
    if market_price <= 0:
        raise HTTPException(status_code=400, detail=f"Invalid market price for holding '{holding['name']}'.")
        
    # 2. Limit price validation
    if order_type == "limit":
        limit_price = order.limit_price if order.limit_price is not None else order.price
        if limit_price is None or limit_price <= 0:
            raise HTTPException(status_code=400, detail="Limit order requires a valid limit price greater than ₹0.")
        limit_price = round(float(limit_price), 2)
        order_price = limit_price
    else:
        limit_price = None
        order_price = market_price

    # 3. Cash and share validation
    cash_balance, reserved_cash, available_cash = get_portfolio_cash_and_reserves(conn, "default")
    current_qty, reserved_shares, available_shares = get_holding_shares_and_reserves(conn, order.holding_id, "default")
    
    if side == "buy":
        required_funds = round(order.quantity * order_price, 2)
        if available_cash < required_funds:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient funds: trade requires ₹{required_funds:,.2f}, available cash is ₹{available_cash:,.2f}."
            )
    else:  # sell
        if available_shares < order.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient shares: cannot sell {order.quantity} of {available_shares} available shares."
            )

    # 4. Determine execution eligibility
    if order_type == "market":
        is_eligible = True
        exec_price = market_price
    else:  # limit
        if side == "buy":
            is_eligible = (market_price <= limit_price)
        else:  # sell
            is_eligible = (market_price >= limit_price)
        exec_price = market_price if is_eligible else None

    trade_id = f"ptrade-{uuid.uuid4().hex[:8]}"
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if is_eligible:
        # IMMEDIATE EXECUTION
        exec_val = round(order.quantity * exec_price, 2)
        if side == "buy":
            new_qty = current_qty + order.quantity
            new_cash = cash_balance - exec_val
            action_word = "Bought"
        else:
            new_qty = current_qty - order.quantity
            new_cash = cash_balance + exec_val
            action_word = "Sold"

        cursor.execute("""
            UPDATE holdings 
            SET quantity = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND portfolio_id = 'default'
        """, (new_qty, order.holding_id))

        cursor.execute("""
            UPDATE portfolios 
            SET cash_balance = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = 'default'
        """, (new_cash,))

        cursor.execute("""
            INSERT INTO paper_trades (
                id, portfolio_id, holding_id, ticker, side, order_type, quantity, price, limit_price, executed_price, total_val, status, confirmed, created_at, executed_at
            ) VALUES (?, 'default', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EXECUTED', 1, ?, ?)
        """, (trade_id, order.holding_id, holding["ticker"], side, order_type, order.quantity, exec_price, limit_price, exec_price, exec_val, now_iso, now_iso))

        update_portfolio_from_cache(conn=conn)

        if order_type == "limit":
            message = f"Limit order executed at ₹{exec_price:,.2f}. {action_word} {order.quantity} shares of {holding['name']} (Total: ₹{exec_val:,.2f})."
        else:
            message = f"{action_word} {order.quantity} shares of {holding['name']} at ₹{exec_price:,.2f} (Total: ₹{exec_val:,.2f})."

        return TradeResponse(
            success=True,
            simulated=True,
            status="EXECUTED",
            message=message,
            trade_id=trade_id,
            holding_id=order.holding_id,
            holding_name=holding["name"],
            side=side,
            order_type=order_type,
            quantity=order.quantity,
            price=exec_price,
            limit_price=limit_price,
            executed_price=exec_price,
            market_price=market_price,
            total_val=exec_val,
            timestamp=now_iso,
        )

    else:
        # PENDING LIMIT ORDER
        # Holdings and portfolio cash balance are NOT changed immediately.
        # Cash/shares are reserved via the status='PENDING' record.
        pending_val = round(order.quantity * limit_price, 2)
        cursor.execute("""
            INSERT INTO paper_trades (
                id, portfolio_id, holding_id, ticker, side, order_type, quantity, price, limit_price, executed_price, total_val, status, confirmed, created_at, executed_at
            ) VALUES (?, 'default', ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'PENDING', 1, ?, NULL)
        """, (trade_id, order.holding_id, holding["ticker"], side, order_type, order.quantity, limit_price, limit_price, pending_val, now_iso))

        action_word = "Buy" if side == "buy" else "Sell"
        message = (
            f"Limit order placed and awaiting execution. "
            f"{action_word} {order.quantity} shares of {holding['name']} @ ₹{limit_price:,.2f} "
            f"(Current market: ₹{market_price:,.2f})."
        )

        return TradeResponse(
            success=True,
            simulated=True,
            status="PENDING",
            message=message,
            trade_id=trade_id,
            holding_id=order.holding_id,
            holding_name=holding["name"],
            side=side,
            order_type=order_type,
            quantity=order.quantity,
            price=limit_price,
            limit_price=limit_price,
            executed_price=None,
            market_price=market_price,
            total_val=pending_val,
            timestamp=now_iso,
        )

def process_pending_orders(conn: Optional[sqlite3.Connection] = None) -> List[Dict]:
    """
    Evaluate all pending orders against current holding prices.
    Executes eligible orders atomically in FIFO order (by created_at ASC).
    Returns a list of dicts describing executed orders.
    """
    if conn is not None:
        return _do_process_pending_orders(conn)
    else:
        with get_db() as new_conn:
            return _do_process_pending_orders(new_conn)

def _do_process_pending_orders(conn: sqlite3.Connection) -> List[Dict]:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, portfolio_id, holding_id, ticker, side, order_type, quantity,
               price, limit_price, total_val, created_at
        FROM paper_trades
        WHERE portfolio_id = 'default' AND UPPER(status) = 'PENDING'
        ORDER BY created_at ASC
    """)
    pending_orders = cursor.fetchall()
    if not pending_orders:
        return []

    executed_results = []
    any_executed = False

    for ord_row in pending_orders:
        order_id = ord_row["id"]
        holding_id = ord_row["holding_id"]
        side = ord_row["side"].lower()
        qty = int(ord_row["quantity"])
        limit_price = float(ord_row["limit_price"] or ord_row["price"])

        # Fetch latest holding data
        cursor.execute("""
            SELECT id, name, quantity, current_price, avg_buy_price
            FROM holdings
            WHERE id = ? AND portfolio_id = 'default'
        """, (holding_id,))
        holding = cursor.fetchone()
        if not holding:
            logger.warning(f"Holding '{holding_id}' not found for pending order '{order_id}'. Marking REJECTED.")
            cursor.execute("UPDATE paper_trades SET status = 'REJECTED' WHERE id = ?", (order_id,))
            continue

        market_price = float(holding["current_price"]) if holding["current_price"] and holding["current_price"] > 0 else float(holding["avg_buy_price"])
        if market_price <= 0:
            continue

        # Check execution eligibility
        is_eligible = False
        if side == "buy":
            is_eligible = (market_price <= limit_price)
        else:  # sell
            is_eligible = (market_price >= limit_price)

        if not is_eligible:
            continue

        # Re-verify cash for buy / shares for sell
        cursor.execute("SELECT cash_balance FROM portfolios WHERE id = 'default'")
        port = cursor.fetchone()
        cash_balance = float(port["cash_balance"])
        exec_val = round(qty * market_price, 2)
        current_holding_qty = int(holding["quantity"])

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if side == "buy":
            if cash_balance < exec_val:
                logger.warning(f"Cannot execute pending buy order {order_id}: required ₹{exec_val}, cash ₹{cash_balance}")
                continue
            new_cash = cash_balance - exec_val
            new_qty = current_holding_qty + qty
            action_word = "Bought"
        else:  # sell
            if current_holding_qty < qty:
                logger.warning(f"Cannot execute pending sell order {order_id}: requires {qty} shares, holding has {current_holding_qty}")
                continue
            new_cash = cash_balance + exec_val
            new_qty = current_holding_qty - qty
            action_word = "Sold"

        # Atomically update holdings, portfolio cash, and order status
        cursor.execute("""
            UPDATE holdings
            SET quantity = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND portfolio_id = 'default'
        """, (new_qty, holding_id))

        cursor.execute("""
            UPDATE portfolios
            SET cash_balance = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = 'default'
        """, (new_cash,))

        cursor.execute("""
            UPDATE paper_trades
            SET status = 'EXECUTED',
                executed_price = ?,
                total_val = ?,
                executed_at = ?
            WHERE id = ? AND UPPER(status) = 'PENDING'
        """, (market_price, exec_val, now_iso, order_id))

        if cursor.rowcount > 0:
            any_executed = True
            msg = f"Limit order executed at ₹{market_price:,.2f}. {action_word} {qty} shares of {holding['name']} (Total: ₹{exec_val:,.2f})."
            executed_results.append({
                "order_id": order_id,
                "holding_id": holding_id,
                "holding_name": holding["name"],
                "side": side,
                "quantity": qty,
                "limit_price": limit_price,
                "executed_price": market_price,
                "total_val": exec_val,
                "status": "EXECUTED",
                "message": msg,
            })
            logger.info(f"Successfully executed pending order {order_id}: {msg}")

    if any_executed:
        update_portfolio_from_cache(conn=conn)

    return executed_results

def cancel_pending_order(order_id: str, conn: sqlite3.Connection) -> CancelOrderResponse:
    """
    Cancel a pending paper order, releasing reserved cash/shares.
    """
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, status, side, quantity, total_val
        FROM paper_trades
        WHERE id = ? AND portfolio_id = 'default'
    """, (order_id,))
    order = cursor.fetchone()
    if not order:
        raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")
        
    if order["status"].upper() != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel order with status '{order['status']}'. Only PENDING orders can be cancelled."
        )

    cursor.execute("UPDATE paper_trades SET status = 'CANCELLED' WHERE id = ?", (order_id,))
    return CancelOrderResponse(
        success=True,
        order_id=order_id,
        status="CANCELLED",
        message=f"Order {order_id} has been cancelled successfully."
    )
