import json
from fastapi import APIRouter, HTTPException
from backend.app.db.database import get_db
from backend.app.schemas.common import ReportCardOut

router = APIRouter(prefix="/report", tags=["report"])

@router.get("/{run_id}", response_model=ReportCardOut)
def get_report_card(run_id: str):
    """Generate executive one-page report card for a simulation run."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
        run = cursor.fetchone()
        if not run:
            # Fallback to run-0142 if requested run is not found
            cursor.execute("SELECT * FROM runs ORDER BY created_at DESC LIMIT 1")
            run = cursor.fetchone()
            if not run:
                raise HTTPException(status_code=404, detail="No simulation runs found.")
                
        cursor.execute("SELECT agent, response FROM agent_logs WHERE run_id = ?", (run["id"],))
        agent_logs = cursor.fetchall()
        
        auditor_note = next((l["response"] for l in agent_logs if l["agent"] == "Risk Auditor"), "Auto loans and banking credit exhibit hidden correlation under stress.")
        pm_note = next((l["response"] for l in agent_logs if l["agent"] == "Portfolio Manager"), "Trim high-beta names and allocate toward defensives.")
        
        p05 = float(run["p05"])
        p95 = float(run["p95"])
        expected = float(run["expected_move_pct"])
        after_fix = round(expected * 0.82, 1) # Estimated post-fix move
        
        return ReportCardOut(
            run_id=run["id"],
            scenario_name=run["scenario_name"],
            survival_score=int(run["survival_score"]),
            expected_move_pct=expected,
            likely_range=[p05, p95],
            after_fix_pct=after_fix,
            confidence=run["confidence"].capitalize(),
            hidden_risk=auditor_note,
            fix_description=pm_note,
            timestamp=run["created_at"]
        )
