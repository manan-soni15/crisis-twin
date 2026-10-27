import sqlite3
import logging
import datetime
from typing import Dict, List, Optional
import yfinance as yf
from backend.app.db.database import get_db

logger = logging.getLogger("crisis_twin.price_loader")

# Target holding tickers
HOLDING_TICKERS = {
    "reliance": "RELIANCE.NS",
    "indigo": "INDIGO.NS",
    "hdfc": "HDFCBANK.NS",
    "tata": "TATAMOTORS.NS",
    "infy": "INFY.NS",
    "sun": "SUNPHARMA.NS",
    "itc": "ITC.NS",
}

# Target macro factors
MACRO_TICKERS = {
    "crude_oil": "CL=F",
    "usd_inr": "INR=X",
    "nifty_50": "^NSEI",
    "india_vix": "^INDIAVIX",
}

def fetch_and_cache_ticker(ticker: str, period: str = "1mo") -> int:
    """Download daily prices for a ticker using yfinance and cache in SQLite."""
    try:
        data = yf.download(ticker, period=period, progress=False, auto_adjust=True)
        if data.empty:
            logger.warning(f"No data returned for ticker {ticker}")
            return 0
        
        records = []
        now_str = datetime.datetime.utcnow().isoformat()
        
        for index, row in data.iterrows():
            date_str = index.strftime("%Y-%m-%d")
            # Handle possible MultiIndex or series
            try:
                close_val = float(row["Close"].iloc[0] if hasattr(row["Close"], "iloc") else row["Close"])
                open_val = float(row["Open"].iloc[0] if hasattr(row["Open"], "iloc") else row["Open"])
                high_val = float(row["High"].iloc[0] if hasattr(row["High"], "iloc") else row["High"])
                low_val = float(row["Low"].iloc[0] if hasattr(row["Low"], "iloc") else row["Low"])
                volume_val = float(row["Volume"].iloc[0] if hasattr(row["Volume"], "iloc") else row["Volume"])
            except Exception:
                continue

            records.append((ticker, date_str, open_val, high_val, low_val, close_val, volume_val, now_str))
            
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.executemany("""
                INSERT INTO prices_cache (ticker, date, open, high, low, close, volume, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(ticker, date) DO UPDATE SET
                    open=excluded.open,
                    high=excluded.high,
                    low=excluded.low,
                    close=excluded.close,
                    volume=excluded.volume,
                    updated_at=excluded.updated_at
            """, records)
            
        logger.info(f"Cached {len(records)} price records for {ticker}")
        return len(records)
    except Exception as e:
        logger.error(f"Failed to fetch data for {ticker}: {e}")
        return 0

def fetch_all_prices():
    """Batch fetch all portfolio holdings and macro factors."""
    total = 0
    for hid, ticker in HOLDING_TICKERS.items():
        total += fetch_and_cache_ticker(ticker, period="3mo")
    for fid, ticker in MACRO_TICKERS.items():
        total += fetch_and_cache_ticker(ticker, period="3mo")
    return total

def get_latest_price(ticker: str) -> Optional[Dict]:
    """Retrieve the most recent cached price for a ticker."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ticker, date, open, high, low, close, volume, updated_at
            FROM prices_cache
            WHERE ticker = ?
            ORDER BY date DESC
            LIMIT 2
        """, (ticker,))
        rows = cursor.fetchall()
        if not rows:
            return None
        
        latest = dict(rows[0])
        if len(rows) > 1:
            prev_close = rows[1]["close"]
            latest["day_change_pct"] = round(((latest["close"] - prev_close) / prev_close) * 100, 2)
        else:
            latest["day_change_pct"] = 0.0
            
        return latest

def update_portfolio_from_cache(conn: Optional[sqlite3.Connection] = None):
    """Recalculate portfolio weights and values based on the latest cached prices."""
    if conn is not None:
        _do_update_portfolio(conn)
    else:
        with get_db() as new_conn:
            _do_update_portfolio(new_conn)

def _do_update_portfolio(conn: sqlite3.Connection):
    cursor = conn.cursor()
    cursor.execute("SELECT id, ticker, quantity, avg_buy_price FROM holdings WHERE portfolio_id = 'default'")
    holdings = cursor.fetchall()
    
    updates = []
    total_val = 0.0
    
    for h in holdings:
        # Query prices_cache directly with the same connection
        cursor.execute("SELECT close FROM prices_cache WHERE ticker = ? ORDER BY date DESC LIMIT 1", (h["ticker"],))
        price_row = cursor.fetchone()
        price = price_row["close"] if price_row else h["avg_buy_price"]
        val = h["quantity"] * price
        total_val += val
        updates.append((h["id"], price, val))
        
    if total_val > 0:
        for hid, price, val in updates:
            weight = round((val / total_val) * 100, 1)
            cursor.execute("""
                UPDATE holdings 
                SET current_price = ?, weight = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (price, weight, hid))
            
    logger.info(f"Updated portfolio from cache. Total equity: {total_val}")

