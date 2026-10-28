"""Daily price provider adapter and SQLite cache.

Massive is the only enabled market-price adapter. It requires an API key and a plan
that explicitly permits the requested market/endpoint and display use. We do not fall
back to unofficial scraping or yfinance. If credentials/coverage are unavailable, the
existing cached or seeded value remains clearly marked as unverified/stale by the API.
"""
import datetime
import logging
from typing import Dict, List, Optional
import requests
from backend.app.config import settings
from backend.app.db.database import get_db

logger = logging.getLogger("crisis_twin.price_loader")
MASSIVE_BASE_URL = "https://api.massive.com"


def fetch_and_cache_ticker(ticker: str, period: str = "1mo") -> int:
    """Fetch daily aggregates from Massive; never silently substitute another source."""
    if not settings.MASSIVE_API_KEY:
        logger.warning("Price refresh skipped: MASSIVE_API_KEY is not configured")
        return 0
    end = datetime.date.today()
    days = 95 if period == "3mo" else 35
    start = end - datetime.timedelta(days=days)
    url = f"{MASSIVE_BASE_URL}/v2/aggs/ticker/{ticker}/range/1/day/{start.isoformat()}/{end.isoformat()}"
    try:
        response = requests.get(
            url,
            params={"adjusted": "true", "sort": "asc", "limit": 5000, "apiKey": settings.MASSIVE_API_KEY},
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("status") == "ERROR":
            logger.warning("Massive returned an error for %s: %s", ticker, payload.get("error"))
            return 0
        records = []
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        for item in payload.get("results", []):
            close = float(item.get("c") or 0)
            if close <= 0:
                continue
            date_str = datetime.datetime.fromtimestamp(item["t"] / 1000, datetime.timezone.utc).date().isoformat()
            records.append((ticker, date_str, item.get("o"), item.get("h"), item.get("l"), close, item.get("v"), now, "Massive", "daily_close"))
        if not records:
            logger.warning("Massive returned no usable daily prices for %s", ticker)
            return 0
        with get_db() as conn:
            conn.executemany("""
                INSERT INTO prices_cache (ticker, date, open, high, low, close, volume, updated_at, source, price_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(ticker, date) DO UPDATE SET open=excluded.open, high=excluded.high,
                    low=excluded.low, close=excluded.close, volume=excluded.volume,
                    updated_at=excluded.updated_at, source=excluded.source, price_type=excluded.price_type
            """, records)
        return len(records)
    except requests.RequestException as exc:
        logger.warning("Massive price fetch failed for %s: %s", ticker, exc)
        return 0
    except (TypeError, ValueError, KeyError) as exc:
        logger.warning("Invalid Massive response for %s: %s", ticker, exc)
        return 0


def fetch_all_prices() -> int:
    """Refresh tickers currently held in the database, not a hard-coded ticker list."""
    with get_db() as conn:
        tickers = [row["ticker"] for row in conn.execute("SELECT DISTINCT ticker FROM holdings WHERE quantity >= 0")]
    return sum(fetch_and_cache_ticker(ticker, period="3mo") for ticker in tickers)


def get_latest_price(ticker: str) -> Optional[Dict]:
    with get_db() as conn:
        rows = conn.execute("""
            SELECT ticker, date, open, high, low, close, volume, updated_at, source, price_type
            FROM prices_cache WHERE ticker = ? ORDER BY date DESC LIMIT 2
        """, (ticker,)).fetchall()
    if not rows:
        return None
    latest = dict(rows[0])
    latest["day_change_pct"] = round(((latest["close"] - rows[1]["close"]) / rows[1]["close"]) * 100, 2) if len(rows) > 1 and rows[1]["close"] else 0.0
    return latest


def update_portfolio_from_cache(conn=None):
    if conn is not None:
        _do_update_portfolio(conn)
    else:
        with get_db() as new_conn:
            _do_update_portfolio(new_conn)


def _do_update_portfolio(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT id, ticker, quantity, avg_buy_price, current_price FROM holdings WHERE portfolio_id = 'default'")
    holdings = cursor.fetchall()
    updates = []
    equity_total = 0.0
    for holding in holdings:
        cursor.execute("SELECT close FROM prices_cache WHERE ticker = ? ORDER BY date DESC LIMIT 1", (holding["ticker"],))
        price_row = cursor.fetchone()
        price = float(price_row["close"]) if price_row else (float(holding["current_price"] or 0) if float(holding["current_price"] or 0) > 0 else float(holding["avg_buy_price"] or 0))
        value = int(holding["quantity"]) * price
        equity_total += value
        updates.append((holding["id"], price, value))
    cash_row = cursor.execute("SELECT cash_balance FROM portfolios WHERE id = 'default'").fetchone()
    total_portfolio_value = equity_total + (float(cash_row["cash_balance"] or 0) if cash_row else 0)
    for holding_id, price, value in updates:
        weight = round(value / total_portfolio_value * 100, 2) if total_portfolio_value > 0 else 0.0
        cursor.execute("UPDATE holdings SET current_price = ?, weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND portfolio_id = 'default'", (price, weight, holding_id))
    logger.info("Portfolio cache updated. Equity=%s, total portfolio=%s", equity_total, total_portfolio_value)
