import uuid
import json
from backend.app.db.database import init_db, get_db

def test_persistence_and_no_duplication():
    # 1. Startup initialization
    init_db()

    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) as cnt FROM portfolios")
        assert c.fetchone()["cnt"] == 1, "Portfolio count should be 1"

        c.execute("SELECT COUNT(*) as cnt FROM holdings")
        assert c.fetchone()["cnt"] == 7, "Holdings count should be 7"

        c.execute("SELECT COUNT(*) as cnt FROM runs WHERE id = 'run-0142'")
        assert c.fetchone()["cnt"] == 1, "Seed run-0142 should be 1"

        c.execute("SELECT COUNT(*) as cnt FROM agent_logs WHERE run_id = 'run-0142'")
        assert c.fetchone()["cnt"] == 4, "Seed agent_logs for run-0142 should be 4"

    # 2. Insert new trade, drill result, and audit run
    test_trade_id = f"ptrade-test-{uuid.uuid4().hex[:6]}"
    test_drill_id = f"drill-test-{uuid.uuid4().hex[:6]}"
    test_run_id = f"run-test-{uuid.uuid4().hex[:6]}"

    with get_db() as conn:
        c = conn.cursor()
        # Insert trade
        c.execute("""
            INSERT INTO paper_trades (id, portfolio_id, holding_id, ticker, side, quantity, price, total_val, status, confirmed)
            VALUES (?, 'default', 'reliance', 'RELIANCE.NS', 'buy', 10, 2500.0, 25000.0, 'executed', 1)
        """, (test_trade_id,))

        # Insert drill result
        c.execute("""
            INSERT INTO drill_results (id, user_id, drill_name, option_chosen, seconds_taken, loss_at_decision_pct, outcome_pct, debrief_sentence)
            VALUES (?, 'user_default', 'Persistence Test Drill', 'Hold', 20, -5.0, -5.0, 'Test sentence')
        """, (test_drill_id,))

        # Insert audit run
        c.execute("""
            INSERT INTO runs (id, scenario_name, shocks_json, horizon_days, expected_move_pct, p05, p95, cvar95, survival_score, confidence, in_fitted_range, model_version, per_holding_json, risk_contribution_json)
            VALUES (?, 'Test Scenario', '{}', 10, -2.5, -4.0, -1.0, -5.0, 80, 'high', 1, 'factors-v3', '[]', '[]')
        """, (test_run_id,))

        # Insert agent log for this run
        c.execute("""
            INSERT INTO agent_logs (run_id, agent, prompt, response, confidence)
            VALUES (?, 'Bull', 'Test prompt', 'Test response', 3)
        """, (test_run_id,))

    # 3. Simulate backend restart by calling init_db() again
    init_db()

    # 4. Verify seed data is NOT duplicated
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) as cnt FROM portfolios")
        assert c.fetchone()["cnt"] == 1, "Portfolios duplicated after restart!"

        c.execute("SELECT COUNT(*) as cnt FROM holdings")
        assert c.fetchone()["cnt"] == 7, "Holdings duplicated after restart!"

        c.execute("SELECT COUNT(*) as cnt FROM runs WHERE id = 'run-0142'")
        assert c.fetchone()["cnt"] == 1, "Run-0142 duplicated after restart!"

        c.execute("SELECT COUNT(*) as cnt FROM agent_logs WHERE run_id = 'run-0142'")
        assert c.fetchone()["cnt"] == 4, "Agent logs duplicated after restart!"

        # 5. Verify inserted data persisted across restart
        c.execute("SELECT * FROM paper_trades WHERE id = ?", (test_trade_id,))
        assert c.fetchone() is not None, "Paper trade failed to persist!"

        c.execute("SELECT * FROM drill_results WHERE id = ?", (test_drill_id,))
        assert c.fetchone() is not None, "Drill result failed to persist!"

        c.execute("SELECT * FROM runs WHERE id = ?", (test_run_id,))
        assert c.fetchone() is not None, "Audit run failed to persist!"

        c.execute("SELECT * FROM agent_logs WHERE run_id = ?", (test_run_id,))
        assert c.fetchone() is not None, "Agent log failed to persist!"

        # Clean up test rows
        c.execute("DELETE FROM paper_trades WHERE id = ?", (test_trade_id,))
        c.execute("DELETE FROM drill_results WHERE id = ?", (test_drill_id,))
        c.execute("DELETE FROM agent_logs WHERE run_id = ?", (test_run_id,))
        c.execute("DELETE FROM runs WHERE id = ?", (test_run_id,))

    print("[PASS] Persistence and non-duplication test verified successfully!")

if __name__ == "__main__":
    test_persistence_and_no_duplication()
