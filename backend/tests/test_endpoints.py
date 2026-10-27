from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

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
    
    # Debate
    r = client.post("/debate", json={})
    assert r.status_code == 200
    assert len(r.json()["agents"]) == 4
    
    # Voice intent
    r = client.post("/voice/intent", json={"transcript": "Start the debate on this run"})
    assert r.status_code == 200
    assert r.json()["intent"] == "START_DEBATE"
    print("[PASS] All simulation & agent stubs passed")

if __name__ == "__main__":
    test_health()
    test_portfolio()
    test_paper_trade()
    test_audit_runs()
    test_profile()
    test_drill_result()
    test_report_card()
    test_stubs()
    print("\nALL BACKEND UNIT TESTS PASSED SUCCESSFULLY!")
