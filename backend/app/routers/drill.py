import datetime
import uuid
from fastapi import APIRouter
from backend.app.db.database import get_db
from backend.app.schemas.common import DrillResultIn, DrillResultOut

router = APIRouter(prefix="/drill", tags=["drill"])

@router.post("/result", response_model=DrillResultOut)
def record_drill_result(payload: DrillResultIn):
    """
    Record user action during a timed crisis drill.
    Compares decision timing & loss against stated risk tolerance.
    """
    drill_id = f"drill-{uuid.uuid4().hex[:8]}"
    now_iso = datetime.datetime.utcnow().isoformat()
    
    # Simple simulated outcome calculation
    outcome = round(payload.loss_at_decision * 0.75 if "trim" in payload.option.lower() or "hedge" in payload.option.lower() else payload.loss_at_decision, 1)
    
    # Generate debrief sentence
    if payload.seconds < 15:
        debrief = f"Decided rapidly in {payload.seconds}s: chosen action '{payload.option}' mitigated loss to {outcome}%."
    elif payload.seconds < 35:
        debrief = f"Measured response in {payload.seconds}s at {payload.loss_at_decision}% loss. Realized outcome was {outcome}%."
    else:
        debrief = f"Slow to act ({payload.seconds}s), approaching panic boundary before executing '{payload.option}'."

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO drill_results (
                id, user_id, drill_name, option_chosen, seconds_taken,
                loss_at_decision_pct, outcome_pct, debrief_sentence, created_at
            ) VALUES (?, 'user_default', ?, ?, ?, ?, ?, ?, ?)
        """, (
            drill_id,
            payload.drill_name or "Market shock drill",
            payload.option,
            payload.seconds,
            payload.loss_at_decision,
            outcome,
            debrief,
            now_iso
        ))
        
    return DrillResultOut(
        success=True,
        id=drill_id,
        recorded_at=now_iso,
        debrief_sentence=debrief
    )
