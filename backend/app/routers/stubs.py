import json
import uuid
import datetime
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter(tags=["simulation_and_agents_stubs"])

# -------------------------------------------------------------
# Aditya's Quant Engine Stubs (/scenario/parse, /simulate, /propagate, /replay, /why)
# -------------------------------------------------------------
class ParseRequest(BaseModel):
    text: str

class SimulateRequest(BaseModel):
    shock_object: Optional[Dict[str, Any]] = None
    adjustments: Optional[List[Dict[str, Any]]] = None

@router.post("/scenario/parse")
def parse_scenario_stub(payload: ParseRequest):
    """
    Day-1 Stub for Aditya / Manan:
    Translates user plain English text into structured shocks object.
    """
    text_lower = payload.text.lower()
    shocks = []
    
    if "oil" in text_lower or "crude" in text_lower:
        shocks.append({"factor": "oil_price", "change_pct": 25})
    if "rate" in text_lower or "repo" in text_lower or "interest" in text_lower:
        shocks.append({"factor": "policy_rate", "change_bps": 100})
    if "conflict" in text_lower or "war" in text_lower:
        shocks.append({"factor": "geopolitical_risk", "change_pct": 30})
    if not shocks:
        shocks = [{"factor": "oil_price", "change_pct": 20}, {"factor": "policy_rate", "change_bps": 75}]

    return {
        "scenario_name": payload.text[:50],
        "horizon_days": 10,
        "shocks": shocks
    }

@router.post("/simulate")
def simulate_scenario_stub(payload: SimulateRequest):
    """
    Day-1 Stub for Aditya's Quant Model:
    Returns the agreed frozen simulation result object.
    """
    run_id = f"run-{uuid.uuid4().hex[:4]}"
    return {
        "run_id": run_id,
        "expected_move_pct": -4.1,
        "p05": -6.8,
        "p95": -1.9,
        "cvar95": -7.4,
        "per_holding": [
            {
                "id": "tata",
                "weight": 12,
                "impact_pct": -12.6,
                "beta": 1.05,
                "breakdown": [
                    {"factor": "oil_price", "value_pct": -5.8},
                    {"factor": "policy_rate", "value_pct": -6.2}
                ]
            },
            {
                "id": "indigo",
                "weight": 9,
                "impact_pct": -12.0,
                "beta": 0.85,
                "breakdown": [
                    {"factor": "oil_price", "value_pct": -9.5},
                    {"factor": "policy_rate", "value_pct": -2.5}
                ]
            },
            {
                "id": "hdfc",
                "weight": 20,
                "impact_pct": -6.3,
                "beta": 0.90,
                "breakdown": [
                    {"factor": "oil_price", "value_pct": -1.5},
                    {"factor": "policy_rate", "value_pct": -4.8}
                ]
            },
            {
                "id": "reliance",
                "weight": 18,
                "impact_pct": 4.0,
                "beta": 0.70,
                "breakdown": [
                    {"factor": "oil_price", "value_pct": 4.8},
                    {"factor": "policy_rate", "value_pct": -0.8}
                ]
            }
        ],
        "risk_contribution": [
            {"id": "hdfc", "share": 0.24},
            {"id": "tata", "share": 0.21}
        ],
        "confidence": "medium",
        "in_fitted_range": True,
        "model_version": "factors-v3"
    }

@router.post("/propagate")
def propagate_stub(payload: Dict[str, Any]):
    """
    Day-1 Stub for Aditya's Propagation Graph:
    Returns nodes, edges, and hidden indirect exposures.
    """
    return {
        "nodes": [
            {"id": "oil", "type": "shock", "label": "Oil Spike (+25%)"},
            {"id": "energy", "type": "sector", "label": "Energy Sector"},
            {"id": "auto", "type": "sector", "label": "Auto Sector"},
            {"id": "banks", "type": "sector", "label": "Banks Sector"},
            {"id": "tata", "type": "holding", "label": "Tata Motors"},
            {"id": "hdfc", "type": "holding", "label": "HDFC Bank"}
        ],
        "edges": [
            {"source": "oil", "target": "energy", "weight": 0.8},
            {"source": "oil", "target": "auto", "weight": -0.6},
            {"source": "auto", "target": "tata", "weight": 1.05},
            {"source": "banks", "target": "tata", "weight": 0.5, "indirect": True, "note": "Auto loans funded by banks"}
        ],
        "hidden_exposures": [
            {
                "holding_id": "tata",
                "note": "Auto loans are funded by banks you also hold.",
                "severity": "high"
            }
        ]
    }

@router.get("/replay/{crisis}")
def replay_crisis_stub(crisis: str):
    """
    Day-1 Stub for Aditya's Regret Replay:
    Re-runs real crises (2008, 2020, 2022, oil).
    """
    metrics = {
        "2008": {"unprotected_loss_pct": -40.0, "adjusted_loss_pct": -22.0, "miss": 6.0},
        "2020": {"unprotected_loss_pct": -28.5, "adjusted_loss_pct": -11.5, "miss": 4.0},
        "2022": {"unprotected_loss_pct": -19.0, "adjusted_loss_pct": -10.0, "miss": 2.0},
        "oil": {"unprotected_loss_pct": -13.0, "adjusted_loss_pct": -7.0, "miss": 2.0},
    }
    selected = metrics.get(crisis, metrics["oil"])
    return {
        "crisis_id": crisis,
        "predicted_loss_pct": selected["unprotected_loss_pct"] - selected["miss"],
        "actual_loss_pct": selected["unprotected_loss_pct"],
        "adjusted_loss_pct": selected["adjusted_loss_pct"],
        "miss": selected["miss"],
        "out_of_sample": True
    }

@router.get("/why")
def why_it_moved_stub(date: Optional[str] = None):
    """
    Day-1 Stub for Aditya's Attribution Waterfall & Verdict:
    Explains daily move by holding and factor drivers.
    """
    return {
        "date": date or datetime.date.today().isoformat(),
        "total_move_pct": -0.9,
        "verdict": "Noise",
        "verdict_reason": "Move is within 1.5 standard deviations of historical volatility.",
        "contributions": [
            {"holding": "IndiGo", "move_pct": -1.4},
            {"holding": "HDFC Bank", "move_pct": -0.9},
            {"holding": "Tata Motors", "move_pct": -0.7},
            {"holding": "Reliance", "move_pct": 0.4}
        ],
        "story": "Weakness in aviation and autos drove today's mild pullback, partially offset by strength in upstream energy."
    }

# -------------------------------------------------------------
# Manan's Voice & Agent Stubs (/debate, /voice/intent)
# -------------------------------------------------------------
@router.post("/debate")
def debate_room_stub(payload: Dict[str, Any]):
    """
    Day-1 Stub for Manan's Multi-Agent Debate:
    Returns structured claims with cited evidence fields.
    """
    response = {
        "agents": [
            {
                "agent": "bull",
                "text": "Reliance gains 4.0% on higher crude and Sun Pharma barely moves. A small targeted trim fixes most of the portfolio risk.",
                "confidence": 3,
                "claims": [{"claim": "Reliance gains 4.0%", "evidence_field": "per_holding.reliance.impact_pct", "severity": 2}]
            },
            {
                "agent": "bear",
                "text": "Two winners do not cancel three losers. HDFC Bank falls 6.3% on the rate move, and Tata Motors and IndiGo both fall over 12%. Together they are 41% of the portfolio.",
                "confidence": 4,
                "claims": [{"claim": "Three largest losers represent 41% of portfolio", "evidence_field": "per_holding.tata.impact_pct", "severity": 4}]
            },
            {
                "agent": "audit",
                "text": "HDFC Bank and Tata Motors share auto-credit risk. In stress their correlation rises sharply, so holding both at full size is less diversified than it looks.",
                "confidence": 4,
                "claims": [{"claim": "Shared auto-credit risk between lenders and autos", "evidence_field": "risk_contribution", "severity": 4}]
            },
            {
                "agent": "pm",
                "text": "Recommendation: Trim Tata Motors from 12% to 8% and IndiGo to 6%, reallocating 7 points into defensives (Sun Pharma and ITC).",
                "confidence": 4,
                "claims": [{"claim": "Rebalancing improves expected drawdown by 0.7 percentage points", "evidence_field": "per_holding", "severity": 3}]
            }
        ],
        "recommended_action": "Trim cyclical autos and aviation, tilt to defensives."
    }
    run_id = payload.get("run_id")
    if run_id:
        # Do not create orphan audit records: debate output must reference a real run.
        from backend.app.db.database import get_db
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT id FROM runs WHERE id = ?", (str(run_id),))
            if not cur.fetchone():
                from fastapi import HTTPException
                raise HTTPException(status_code=404, detail="Simulation run not found; run a scenario before starting a debate.")
            for agent in response["agents"]:
                cur.execute("""
                    INSERT INTO agent_logs (run_id, agent, prompt, response, claims_json, confidence, latency_ms)
                    VALUES (?, ?, ?, ?, ?, ?, 0)
                """, (str(run_id), agent["agent"], "Debate response for supplied run", agent["text"], json.dumps(agent["claims"]), int(agent["confidence"])))
    return response

@router.post("/voice/intent")
def voice_intent_stub(payload: Dict[str, Any]):
    """
    Day-1 Stub for Manan's Voice Intent Router:
    Categorizes voice transcript to predefined fixed intent enum:
    RUN_SCENARIO, START_DEBATE, INTERRUPT_AGENT, REBALANCE, PAPER_TRADE,
    EXPLAIN_MOVE, BRIEFING, DRILL_DECISION.
    """
    raw_transcript = payload.get("transcript", "")
    transcript = raw_transcript.lower()
    
    post_action = None
    focus_agent = None

    # Check for focus agent
    if "bear" in transcript:
        focus_agent = "bear"
    elif "bull" in transcript:
        focus_agent = "bull"
    elif "audit" in transcript:
        focus_agent = "audit"

    # Interrupt / Barge-in
    if any(k in transcript for k in ["interrupt", "stop", "cancel", "quiet", "pause", "hold on"]):
        intent = "INTERRUPT_AGENT"
    # Drill decision
    elif any(k in transcript for k in ["drill", "drill decision", "decision under pressure"]):
        intent = "DRILL_DECISION"
    # Rebalance
    elif "rebalance" in transcript or "trim" in transcript:
        intent = "REBALANCE"
    # Paper trade
    elif any(k in transcript for k in ["trade", "buy", "sell", "place order"]):
        intent = "PAPER_TRADE"
    # Briefing
    elif any(k in transcript for k in ["briefing", "morning", "daily brief"]):
        intent = "BRIEFING"
    # Explain move
    elif any(k in transcript for k in ["explain", "why it moved", "why did"]):
        intent = "EXPLAIN_MOVE"
    # Compound: Scenario + Debate (e.g. "What if oil jumps 25% and Bear thinks my banks are safe?")
    elif any(k in transcript for k in ["what if", "oil", "rate", "crude", "jump", "shock", "scenario"]) and ("debate" in transcript or focus_agent is not None):
        intent = "RUN_SCENARIO"
        post_action = "START_DEBATE"
    # Pure debate
    elif "debate" in transcript or focus_agent is not None:
        intent = "START_DEBATE"
    else:
        intent = "RUN_SCENARIO"
        
    return {
        "intent": intent,
        "transcript": raw_transcript,
        "scenario_text": raw_transcript,
        "post_action": post_action,
        "focus_agent": focus_agent,
        "requires_spoken_confirmation": intent == "PAPER_TRADE",
        "spoken_summary": "Scenario analyzed. Expected portfolio movement is -4.1% over a 10-day horizon."
    }
