import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.database import get_db, init_db

client = TestClient(app)

def setup_module():
    init_db()

def test_buy_limit_order_pending_when_market_above_limit():
    """
    User scenario:
    Stock: Tata Motors (market price ~935)
    Side: Buy
    Quantity: 10 shares
    Order type: Limit
    Limit price: 934.51
    Expected: Status is PENDING, cash and shares are NOT modified, funds are reserved.
    """
    # 1. Fetch current portfolio baseline
    res = client.get("/portfolio")
    assert res.status_code == 200
    baseline = res.json()
    init_cash = baseline["cash_balance"]
    init_avail_cash = baseline["available_cash"]
    tata_baseline = next(h for h in baseline["holdings"] if h["id"] == "tata")
    init_tata_qty = tata_baseline["quantity"]
    market_price = tata_baseline["current_price"]

    # Tata Motors market price should be 935.0
    limit_price = 934.51
    assert market_price > limit_price

    # 2. Place limit buy order
    order_payload = {
        "holding_id": "tata",
        "side": "buy",
        "quantity": 10,
        "order_type": "limit",
        "limit_price": limit_price,
        "confirmed": True
    }
    res = client.post("/paper/trade", json=order_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "PENDING"
    assert "awaiting execution" in data["message"].lower()
    assert data["executed_price"] is None
    order_id = data["trade_id"]

    # 3. Verify portfolio state: cash_balance and shares are NOT changed, but reserved_cash increases!
    res = client.get("/portfolio")
    updated = res.json()
    assert updated["cash_balance"] == init_cash  # Settled cash unchanged!
    tata_updated = next(h for h in updated["holdings"] if h["id"] == "tata")
    assert tata_updated["quantity"] == init_tata_qty  # Shares unchanged!
    
    expected_reserved = round(10 * limit_price, 2)
    assert updated["reserved_cash"] >= expected_reserved
    assert updated["available_cash"] == pytest.approx(init_avail_cash - expected_reserved, abs=0.01)

    # 4. Verify order appears in GET /paper/orders
    res = client.get("/paper/orders?status=PENDING")
    assert res.status_code == 200
    pending_list = res.json()
    found = next((o for o in pending_list if o["id"] == order_id), None)
    assert found is not None
    assert found["status"] == "PENDING"
    assert found["order_type"] == "limit"
    assert found["limit_price"] == limit_price

    # Clean up by cancelling
    res = client.post(f"/paper/orders/{order_id}/cancel")
    assert res.status_code == 200
    assert res.json()["status"] == "CANCELLED"

def test_buy_limit_order_immediate_execution_when_market_below_limit():
    """
    Market price <= limit price:
    Example: Tata market price is 935.0, limit price is 936.00.
    Order should execute immediately at current market price!
    """
    res = client.get("/portfolio")
    baseline = res.json()
    init_cash = baseline["cash_balance"]
    tata_baseline = next(h for h in baseline["holdings"] if h["id"] == "tata")
    init_tata_qty = tata_baseline["quantity"]
    market_price = tata_baseline["current_price"]

    limit_price = market_price + 5.0  # Limit is above market price

    order_payload = {
        "holding_id": "tata",
        "side": "buy",
        "quantity": 5,
        "order_type": "limit",
        "limit_price": limit_price,
        "confirmed": True
    }
    res = client.post("/paper/trade", json=order_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "EXECUTED"
    assert data["executed_price"] == market_price
    assert "executed" in data["message"].lower()

    # Verify portfolio state: cash and shares DID update
    res = client.get("/portfolio")
    updated = res.json()
    tata_updated = next(h for h in updated["holdings"] if h["id"] == "tata")
    assert tata_updated["quantity"] == init_tata_qty + 5
    expected_cost = round(5 * market_price, 2)
    assert round(updated["cash_balance"], 2) == round(init_cash - expected_cost, 2)

def test_sell_limit_order_pending_and_execution_semantics():
    """
    Sell Limit:
    - If market_price < limit_price -> PENDING (and shares reserved).
    - If market_price >= limit_price -> EXECUTED immediately.
    """
    res = client.get("/portfolio")
    baseline = res.json()
    tata_baseline = next(h for h in baseline["holdings"] if h["id"] == "tata")
    init_qty = tata_baseline["quantity"]
    market_price = tata_baseline["current_price"]

    # 1. Limit price higher than market price -> PENDING
    higher_limit = market_price + 50.0
    res = client.post("/paper/trade", json={
        "holding_id": "tata",
        "side": "sell",
        "quantity": 10,
        "order_type": "limit",
        "limit_price": higher_limit,
        "confirmed": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "PENDING"
    order_id = data["trade_id"]

    # Check that shares are reserved
    res = client.get("/portfolio")
    tata_after = next(h for h in res.json()["holdings"] if h["id"] == "tata")
    assert tata_after["quantity"] == init_qty  # Actual shares unchanged
    assert tata_after["reserved_quantity"] >= 10
    assert tata_after["available_quantity"] <= init_qty - 10

    # Clean up order
    client.post(f"/paper/orders/{order_id}/cancel")

    # 2. Limit price lower than market price -> Immediate execution
    lower_limit = market_price - 10.0
    res = client.post("/paper/trade", json={
        "holding_id": "tata",
        "side": "sell",
        "quantity": 5,
        "order_type": "limit",
        "limit_price": lower_limit,
        "confirmed": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "EXECUTED"
    assert data["executed_price"] == market_price

def test_prevention_of_overspending_and_overselling():
    """
    Ensure users cannot commit more than available cash (with pending buys)
    or more than available shares (with pending sells).
    """
    res = client.get("/portfolio")
    baseline = res.json()
    available_cash = baseline["available_cash"]
    tata = next(h for h in baseline["holdings"] if h["id"] == "tata")

    # Attempt buy requiring more than available cash
    too_expensive_qty = int(available_cash // tata["current_price"]) + 500
    res = client.post("/paper/trade", json={
        "holding_id": "tata",
        "side": "buy",
        "quantity": too_expensive_qty,
        "order_type": "limit",
        "limit_price": tata["current_price"],
        "confirmed": True
    })
    assert res.status_code == 400
    assert "insufficient funds" in res.json()["detail"].lower()

    # Attempt sell requiring more than available shares
    avail_shares = tata["available_quantity"] or tata["quantity"]
    res = client.post("/paper/trade", json={
        "holding_id": "tata",
        "side": "sell",
        "quantity": avail_shares + 100,
        "order_type": "limit",
        "limit_price": tata["current_price"] + 10.0,
        "confirmed": True
    })
    assert res.status_code == 400
    assert "insufficient shares" in res.json()["detail"].lower()

def test_process_pending_orders_endpoint():
    """
    Place a pending limit order, simulate market price movement to meet limit,
    and process pending orders.
    """
    # Place pending buy order for Sun Pharma at limit 1800 (market price 1850)
    res = client.post("/paper/trade", json={
        "holding_id": "sun",
        "side": "buy",
        "quantity": 2,
        "order_type": "limit",
        "limit_price": 1800.0,
        "confirmed": True
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "PENDING"
    order_id = data["trade_id"]

    # Directly update Sun Pharma price in holdings to 1790 (below limit 1800)
    with get_db() as conn:
        conn.execute("UPDATE holdings SET current_price = 1790.0 WHERE id = 'sun'")

    # Process pending orders
    res = client.post("/paper/orders/process")
    assert res.status_code == 200
    proc_data = res.json()
    assert proc_data["success"] is True
    assert proc_data["executed_count"] >= 1
    executed_ids = [o["order_id"] for o in proc_data["executed_orders"]]
    assert order_id in executed_ids

    # Verify order is now EXECUTED in database
    res = client.get("/paper/orders")
    found = next((o for o in res.json() if o["id"] == order_id), None)
    assert found is not None
    assert found["status"] == "EXECUTED"
    assert found["executed_price"] == 1790.0

    # Reset sun price back to 1850.0
    with get_db() as conn:
        conn.execute("UPDATE holdings SET current_price = 1850.0 WHERE id = 'sun'")
