from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.database import init_db

client = TestClient(app)

def setup_module():
    init_db()

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"
    print("[PASS] /health passed")

def test_portfolio():
    res = client.get("/portfolio")
    assert res.status_code == 200
    data = res.json()
    assert "holdings" in data
    assert len(data["holdings"]) == 7
    assert data["portfolio_value"] > 0
    print("[PASS] /portfolio passed")

def test_paper_trade():
    trade = {
        "holding_id": "reliance",
        "side": "buy",
        "quantity": 5,
        "price": 2500.0,
        "confirmed": True
    }
    res = client.post("/paper/trade", json=trade)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["simulated"] is True
    print("[PASS] /paper/trade passed")

def test_audit_runs():
    res = client.get("/audit/runs")
    assert res.status_code == 200
    data = res.json()
    assert "runs" in data
    assert len(data["runs"]) >= 1
    assert data["runs"][0]["id"] == "run-0142"
    print("[PASS] /audit/runs passed")

def test_profile():
    res = client.get("/profile")
    assert res.status_code == 200
    data = res.json()
    assert "comfort_threshold_pct" in data
    assert "breaking_point_pct" in data
    assert "strategies" in data
    print("[PASS] /profile passed")

def test_drill_result():
    payload = {
        "drill_id": "drill-1",
        "drill_name": "Oil shock drill",
        "option": "Trim the biggest losers",
        "seconds": 24,
        "loss_at_decision": -4.1
    }
    res = client.post("/drill/result", json=payload)
    assert res.status_code == 200
    assert res.json()["success"] is True
    print("[PASS] /drill/result passed")

def test_report_card():
    res = client.get("/report/run-0142")
    assert res.status_code == 200
    data = res.json()
    assert data["survival_score"] == 72
    assert "expected_move_pct" in data
    print("[PASS] /report/{run_id} passed")

def test_paper_trade_validation():
    # Unconfirmed trade should fail with 400
    res = client.post("/paper/trade", json={"holding_id": "reliance", "side": "buy", "quantity": 5, "price": 2500.0, "confirmed": False})
    assert res.status_code == 400
    assert "confirmation" in res.json()["detail"].lower()

    # Non-existent holding should fail with 404
    res = client.post("/paper/trade", json={"holding_id": "nonexistent_coin", "side": "buy", "quantity": 5, "price": 100.0, "confirmed": True})
    assert res.status_code == 404

    # Insufficient shares to sell should fail with 400
    res = client.post("/paper/trade", json={"holding_id": "indigo", "side": "sell", "quantity": 9999999, "price": 4000.0, "confirmed": True})
    assert res.status_code == 400
    assert "insufficient shares" in res.json()["detail"].lower()
    print("[PASS] /paper/trade validation rejections passed")

def test_stubs():
    # Scenario parse
    r = client.post("/scenario/parse", json={"text": "Crude oil spikes 25% and rates increase"})
    assert r.status_code == 200
    assert len(r.json()["shocks"]) >= 1
    
    # Simulate
    r = client.post("/simulate", json={})
    assert r.status_code == 200
    assert r.json()["expected_move_pct"] == -4.1
    
    # Propagate
    r = client.post("/propagate", json={})
    assert r.status_code == 200
    assert "nodes" in r.json()
    
    # Replay
    r = client.get("/replay/2008")
    assert r.status_code == 200
    assert r.json()["crisis_id"] == "2008"
    
    # Debate (confirming frozen contract: 4 agents with claims, evidence fields, severity, confidence)
    r = client.post("/debate", json={})
    assert r.status_code == 200
    debate_data = r.json()
    assert len(debate_data["agents"]) == 4
    for agent in debate_data["agents"]:
        assert "agent" in agent
        assert "text" in agent
        assert "confidence" in agent
        assert "claims" in agent
        for claim in agent["claims"]:
            assert "claim" in claim
            assert "evidence_field" in claim
            assert "severity" in claim
    assert "recommended_action" in debate_data
    
    # Voice intent (pure debate)
    r = client.post("/voice/intent", json={"transcript": "Start the debate on this run"})
    assert r.status_code == 200
    assert r.json()["intent"] == "START_DEBATE"

    # Voice intent (compound contract example from PDF page 4)
    r = client.post("/voice/intent", json={"transcript": "What if oil jumps twenty five percent and Bear thinks my banks are safe?"})
    assert r.status_code == 200
    res_json = r.json()
    assert res_json["intent"] == "RUN_SCENARIO"
    assert res_json["post_action"] == "START_DEBATE"
    assert res_json["focus_agent"] == "bear"

    # Voice intent (interrupt)
    r = client.post("/voice/intent", json={"transcript": "Stop and pause"})
    assert r.status_code == 200
    assert r.json()["intent"] == "INTERRUPT_AGENT"

    print("[PASS] All simulation & agent stubs passed")

if __name__ == "__main__":
    test_health()
    test_portfolio()
    test_paper_trade()
    test_paper_trade_validation()
    test_audit_runs()
    test_profile()
    test_drill_result()
    test_report_card()
    test_stubs()
    print("\nALL BACKEND UNIT TESTS PASSED SUCCESSFULLY!")
