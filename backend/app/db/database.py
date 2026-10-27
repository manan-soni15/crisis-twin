import sqlite3
import json
import logging
from contextlib import contextmanager
from typing import Generator
from backend.app.config import settings

logger = logging.getLogger("crisis_twin.db")

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for SQLite connection with dictionary row access."""
    conn = sqlite3.connect(settings.DATABASE_PATH, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Create all required tables for Crisis Twin data foundation."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Portfolios
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS portfolios (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                user_id TEXT NOT NULL,
                cash_balance REAL NOT NULL DEFAULT 500000.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 2. Holdings
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS holdings (
                id TEXT PRIMARY KEY,
                portfolio_id TEXT NOT NULL,
                ticker TEXT NOT NULL,
                name TEXT NOT NULL,
                sector TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 0,
                avg_buy_price REAL NOT NULL DEFAULT 0.0,
                current_price REAL NOT NULL DEFAULT 0.0,
                beta REAL NOT NULL DEFAULT 1.0,
                weight REAL NOT NULL DEFAULT 0.0,
                day_change_pct REAL NOT NULL DEFAULT 0.0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
            );
        """)
        
        # 3. Prices Cache (for yfinance / NSE historical daily prices)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prices_cache (
                ticker TEXT NOT NULL,
                date TEXT NOT NULL,
                open REAL,
                high REAL,
                low REAL,
                close REAL NOT NULL,
                volume REAL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ticker, date)
            );
        """)
        
        # 4. Macro Factors Cache (Crude, Rates, VIX, FX)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS macro_factors_cache (
                factor TEXT NOT NULL,
                date TEXT NOT NULL,
                value REAL NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (factor, date)
            );
        """)
        
        # 5. Simulation Runs (Audit trail requirement)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                scenario_name TEXT NOT NULL,
                shocks_json TEXT NOT NULL,
                horizon_days INTEGER NOT NULL DEFAULT 10,
                expected_move_pct REAL NOT NULL,
                p05 REAL NOT NULL,
                p95 REAL NOT NULL,
                cvar95 REAL NOT NULL,
                survival_score INTEGER NOT NULL DEFAULT 70,
                confidence TEXT NOT NULL DEFAULT 'medium',
                in_fitted_range BOOLEAN NOT NULL DEFAULT 1,
                model_version TEXT NOT NULL DEFAULT 'factors-v3',
                per_holding_json TEXT NOT NULL,
                risk_contribution_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 6. Agent Logs (Bull, Bear, Auditor, Portfolio Manager)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                agent TEXT NOT NULL,
                prompt TEXT,
                response TEXT NOT NULL,
                claims_json TEXT,
                confidence INTEGER NOT NULL DEFAULT 3,
                latency_ms INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
            );
        """)
        
        # 7. Paper Trades
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS paper_trades (
                id TEXT PRIMARY KEY,
                portfolio_id TEXT NOT NULL,
                holding_id TEXT NOT NULL,
                ticker TEXT NOT NULL,
                side TEXT NOT NULL CHECK(side IN ('buy', 'sell')),
                order_type TEXT NOT NULL DEFAULT 'market',
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                limit_price REAL,
                executed_price REAL,
                total_val REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'EXECUTED',
                confirmed BOOLEAN NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                executed_at TIMESTAMP,
                FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
            );
        """)
        # Safe migration for existing SQLite database files
        cursor.execute("PRAGMA table_info(paper_trades);")
        pt_cols = {col["name"] for col in cursor.fetchall()}
        if "order_type" not in pt_cols:
            cursor.execute("ALTER TABLE paper_trades ADD COLUMN order_type TEXT NOT NULL DEFAULT 'market';")
        if "limit_price" not in pt_cols:
            cursor.execute("ALTER TABLE paper_trades ADD COLUMN limit_price REAL;")
        if "executed_price" not in pt_cols:
            cursor.execute("ALTER TABLE paper_trades ADD COLUMN executed_price REAL;")
        if "executed_at" not in pt_cols:
            cursor.execute("ALTER TABLE paper_trades ADD COLUMN executed_at TIMESTAMP;")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_paper_trades_status ON paper_trades(portfolio_id, status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_paper_trades_holding ON paper_trades(holding_id, status);")
        
        # 8. User Risk Profiles
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                user_id TEXT PRIMARY KEY,
                comfort_threshold_pct REAL NOT NULL DEFAULT -8.0,
                breaking_point_pct REAL NOT NULL DEFAULT -15.0,
                reaction_style TEXT NOT NULL DEFAULT 'holds then sells late',
                answers_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 9. Drill Results (from Crisis Drill)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS drill_results (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                drill_name TEXT NOT NULL,
                option_chosen TEXT NOT NULL,
                seconds_taken INTEGER NOT NULL,
                loss_at_decision_pct REAL NOT NULL,
                outcome_pct REAL NOT NULL,
                debrief_sentence TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Seed default data if empty
        seed_default_data(conn)
        logger.info("Database initialized successfully.")

def seed_default_data(conn: sqlite3.Connection):
    """Seed initial records if the database is newly created."""
    cursor = conn.cursor()
    
    # Check if default portfolio exists
    cursor.execute("SELECT COUNT(*) as cnt FROM portfolios WHERE id = 'default'")
    if cursor.fetchone()["cnt"] == 0:
        cursor.execute("""
            INSERT INTO portfolios (id, name, user_id, cash_balance)
            VALUES ('default', 'Main Growth Portfolio', 'user_default', 750000.0)
        """)
        
        # Seed 7 Indian benchmark holdings
        initial_holdings = [
            ("reliance", "default", "RELIANCE.NS", "Reliance Industries", "energy", 345, 2520.0, 2515.0, 0.70, 18.0, 0.4),
            ("indigo", "default", "INDIGO.NS", "InterGlobe Aviation", "airlines", 98, 4420.0, 4390.0, 0.85, 9.0, -1.6),
            ("hdfc", "default", "HDFCBANK.NS", "HDFC Bank", "banks", 580, 1660.0, 1650.0, 0.90, 20.0, -0.5),
            ("tata", "default", "TATAMOTORS.NS", "Tata Motors", "auto", 620, 935.0, 928.0, 1.05, 12.0, -0.9),
            ("infy", "default", "INFY.NS", "Infosys", "it", 435, 1880.0, 1885.0, 0.80, 17.0, 0.2),
            ("sun", "default", "SUNPHARMA.NS", "Sun Pharma", "pharma", 260, 1850.0, 1860.0, 0.60, 10.0, 0.7),
            ("itc", "default", "ITC.NS", "ITC", "fmcg", 1370, 492.0, 493.0, 0.75, 14.0, 0.1),
        ]
        
        cursor.executemany("""
            INSERT INTO holdings (
                id, portfolio_id, ticker, name, sector, quantity, avg_buy_price, 
                current_price, beta, weight, day_change_pct
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, initial_holdings)

    # Check runs table
    cursor.execute("SELECT COUNT(*) as cnt FROM runs WHERE id = 'run-0142'")
    if cursor.fetchone()["cnt"] == 0:
        shocks = {"oil_price": {"change_pct": 25}, "policy_rate": {"change_bps": 100}, "horizon_days": 10}
        per_holding = [
            {"id": "tata", "name": "Tata Motors", "weight": 12, "impact_pct": -12.6, "beta": 1.05, "breakdown": [{"factor": "oil_price", "value_pct": -5.8}, {"factor": "policy_rate", "value_pct": -6.2}]},
            {"id": "indigo", "name": "IndiGo", "weight": 9, "impact_pct": -12.0, "beta": 0.85, "breakdown": [{"factor": "oil_price", "value_pct": -9.5}, {"factor": "policy_rate", "value_pct": -2.5}]},
            {"id": "hdfc", "name": "HDFC Bank", "weight": 20, "impact_pct": -6.3, "beta": 0.90, "breakdown": [{"factor": "oil_price", "value_pct": -1.5}, {"factor": "policy_rate", "value_pct": -4.8}]},
            {"id": "reliance", "name": "Reliance", "weight": 18, "impact_pct": 4.0, "beta": 0.70, "breakdown": [{"factor": "oil_price", "value_pct": 4.8}, {"factor": "policy_rate", "value_pct": -0.8}]},
            {"id": "itc", "name": "ITC", "weight": 14, "impact_pct": -3.8, "beta": 0.75, "breakdown": [{"factor": "oil_price", "value_pct": -2.2}, {"factor": "policy_rate", "value_pct": -1.6}]},
            {"id": "infy", "name": "Infosys", "weight": 17, "impact_pct": -2.3, "beta": 0.80, "breakdown": [{"factor": "oil_price", "value_pct": -0.6}, {"factor": "policy_rate", "value_pct": -1.7}]},
            {"id": "sun", "name": "Sun Pharma", "weight": 10, "impact_pct": -0.6, "beta": 0.60, "breakdown": [{"factor": "oil_price", "value_pct": -0.3}, {"factor": "policy_rate", "value_pct": -0.3}]}
        ]
        risk_contrib = [{"id": "hdfc", "share": 0.24}, {"id": "tata", "share": 0.21}, {"id": "indigo", "share": 0.19}]
        
        cursor.execute("""
            INSERT INTO runs (
                id, scenario_name, shocks_json, horizon_days, expected_move_pct,
                p05, p95, cvar95, survival_score, confidence, in_fitted_range,
                model_version, per_holding_json, risk_contribution_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "run-0142", "Oil +25% and rates +100 bps", json.dumps(shocks), 10,
            -4.1, -6.8, -1.9, -7.4, 72, "medium", 1, "factors-v3",
            json.dumps(per_holding), json.dumps(risk_contrib)
        ))
        
        # Seed debate logs for run-0142
        agent_logs = [
            ("run-0142", "Bull", "Evaluate opportunities in oil +25% and rates +100 bps", "Reliance gains 4.0% on higher crude and Sun Pharma barely moves. A small, targeted trim fixes most of the portfolio risk.", json.dumps([{"claim": "Reliance gains 4.0%", "evidence_field": "per_holding.reliance.impact_pct", "severity": 2}]), 3, 420),
            ("run-0142", "Bear", "Evaluate downside in oil +25% and rates +100 bps", "Two winners do not cancel three losers. HDFC Bank falls 6.3% on the rate move, and Tata Motors and IndiGo both fall over 12%. Together they are 41% of the portfolio.", json.dumps([{"claim": "HDFC, Tata and IndiGo are 41% of portfolio", "evidence_field": "per_holding.tata.impact_pct", "severity": 4}]), 4, 530),
            ("run-0142", "Risk Auditor", "Check hidden correlation in stress", "HDFC Bank and Tata Motors share auto-credit risk. In stress their correlation rises sharply, so holding both at full size is less diversified than it looks.", json.dumps([{"claim": "Shared auto-credit risk", "evidence_field": "risk_contribution", "severity": 4}]), 4, 380),
            ("run-0142", "Portfolio Manager", "Synthesize final recommendation", "Recommend trimming Tata Motors from 12% to 8% and IndiGo to 6%, reallocating 7 points into defensives (Sun Pharma and ITC). Dissent noted.", json.dumps([{"action": "Trim Tata Motors to 8%"}, {"action": "Trim IndiGo to 6%"}]), 4, 610),
        ]
        cursor.executemany("""
            INSERT INTO agent_logs (
                run_id, agent, prompt, response, claims_json, confidence, latency_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, agent_logs)

    # Seed default user profile
    cursor.execute("SELECT COUNT(*) as cnt FROM profiles WHERE user_id = 'user_default'")
    if cursor.fetchone()["cnt"] == 0:
        answers = [
            {"q": "Your portfolio drops 15% in a week. What do you do?", "a": "Sell a third and wait", "loss_threshold": -15.0},
            {"q": "A friend says a stock will double. How much do you put in?", "a": "A small amount", "loss_threshold": -5.0},
            {"q": "The market falls for six months straight. You are most likely to", "a": "Hold, then sell late", "loss_threshold": -20.0},
            {"q": "When do you need this money?", "a": "In five years or more", "loss_threshold": -25.0},
        ]
        cursor.execute("""
            INSERT INTO profiles (user_id, comfort_threshold_pct, breaking_point_pct, reaction_style, answers_json)
            VALUES ('user_default', -8.0, -15.0, 'holds then sells late', ?)
        """, (json.dumps(answers),))
