"""Regression tests for transaction safety and paper-trade accounting."""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.database import init_db
from backend.app.db.database import get_db

client = TestClient(app)

def setup_module():
    init_db()


def test_confirmation_is_required_when_field_is_omitted():
    response = client.post("/paper/trade", json={
        "holding_id": "tata", "side": "buy", "quantity": 1
    })
    assert response.status_code == 400
    assert "confirmation" in response.json()["detail"].lower()


def test_buy_updates_weighted_average_cost_basis():
    before = client.get("/portfolio").json()
    holding = next(h for h in before["holdings"] if h["id"] == "infy")
    old_qty = holding["quantity"]
    old_avg = 1880.0
    # Ensure the test uses the persisted basis, not the example's seed value.
    with get_db() as conn:
        row = conn.execute("SELECT avg_buy_price FROM holdings WHERE id='infy'").fetchone()
        old_avg = float(row["avg_buy_price"])
    quantity, price = 2, holding["current_price"]
    response = client.post("/paper/trade", json={
        "holding_id": "infy", "side": "buy", "quantity": quantity,
        "confirmed": True
    })
    assert response.status_code == 200
    assert response.json()["status"] == "EXECUTED"
    with get_db() as conn:
        row = conn.execute("SELECT quantity, avg_buy_price FROM holdings WHERE id='infy'").fetchone()
    expected = ((old_qty * old_avg) + quantity * price) / (old_qty + quantity)
    assert row["quantity"] == old_qty + quantity
    assert row["avg_buy_price"] == pytest.approx(expected, abs=0.01)


def test_processing_pending_order_twice_does_not_double_execute():
    before = client.get("/portfolio").json()
    holding = next(h for h in before["holdings"] if h["id"] == "sun")
    initial_qty = holding["quantity"]
    initial_cash = before["cash_balance"]
    market = holding["current_price"]
    limit = round(market - 0.50, 2)
    placed = client.post("/paper/trade", json={
        "holding_id": "sun", "side": "buy", "quantity": 1,
        "order_type": "limit", "limit_price": limit, "confirmed": True
    })
    assert placed.status_code == 200
    assert placed.json()["status"] == "PENDING"
    order_id = placed.json()["trade_id"]
    with get_db() as conn:
        conn.execute("UPDATE holdings SET current_price = ? WHERE id='sun'", (limit,))
    first = client.post("/paper/orders/process")
    assert first.status_code == 200
    with get_db() as conn:
        order = conn.execute("SELECT status FROM paper_trades WHERE id=?", (order_id,)).fetchone()
        after_first = conn.execute("SELECT quantity FROM holdings WHERE id='sun'").fetchone()["quantity"]
        cash_after_first = conn.execute("SELECT cash_balance FROM portfolios WHERE id='default'").fetchone()["cash_balance"]
    assert order["status"] == "EXECUTED"
    assert after_first == initial_qty + 1
    assert cash_after_first == pytest.approx(initial_cash - limit, abs=0.02)
    second = client.post("/paper/orders/process")
    assert second.status_code == 200
    with get_db() as conn:
        after_second = conn.execute("SELECT quantity FROM holdings WHERE id='sun'").fetchone()["quantity"]
        cash_after_second = conn.execute("SELECT cash_balance FROM portfolios WHERE id='default'").fetchone()["cash_balance"]
        conn.execute("UPDATE holdings SET current_price = ? WHERE id='sun'", (market,))
    assert after_second == after_first
    assert cash_after_second == pytest.approx(cash_after_first, abs=0.01)


def test_portfolio_weights_include_cash_in_total_portfolio_value():
    response = client.get("/portfolio")
    assert response.status_code == 200
    data = response.json()
    # Equity weights should not sum to ~100% when the portfolio also holds cash.
    weight_sum = sum(item["weight"] for item in data["holdings"])
    assert weight_sum < 100
    assert weight_sum == pytest.approx(data["total_equity_value"] / data["portfolio_value"] * 100, abs=1.0)
