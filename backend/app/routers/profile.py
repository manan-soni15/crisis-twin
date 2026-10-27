import json
from fastapi import APIRouter
from backend.app.db.database import get_db
from backend.app.schemas.common import ProfileIn, ProfileOut, ProfileAnswer, ProfileStrategy

router = APIRouter(tags=["profile"])

DEFAULT_QUESTIONS = [
    {"q": "Your portfolio drops 15% in a week. What do you do?", "a": "Sell a third and wait", "loss_threshold": -15.0},
    {"q": "A friend says a stock will double. How much do you put in?", "a": "A small amount", "loss_threshold": -5.0},
    {"q": "The market falls for six months straight. You are most likely to", "a": "Hold, then sell late", "loss_threshold": -20.0},
    {"q": "When do you need this money?", "a": "In five years or more", "loss_threshold": -25.0},
]

def classify_reaction_style(answers: list[dict], drill_adjustment: float = 0.0) -> str:
    """Classify user's behavioral reaction style based on answers and past drill results."""
    action_answer = next((ans["a"] for ans in answers if "drops 15%" in ans["q"]), "").lower()
    if "sell" in action_answer and ("third" in action_answer or "half" in action_answer):
        return "sells early" if drill_adjustment < -2 else "holds then sells late"
    elif "hold" in action_answer:
        return "holds through"
    return "freezes"

@router.get("/profile", response_model=ProfileOut)
def get_user_profile():
    """Retrieve user risk tolerance, comfort threshold, breaking point, and strategy checks."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM profiles WHERE user_id = 'user_default'")
        row = cursor.fetchone()
        
        comfort = float(row["comfort_threshold_pct"]) if row else -8.0
        breaking = float(row["breaking_point_pct"]) if row else -15.0
        style = row["reaction_style"] if row else "holds then sells late"
        raw_answers = json.loads(row["answers_json"]) if row else DEFAULT_QUESTIONS
        
        # Check drill records to see if user panics earlier than stated
        cursor.execute("SELECT MIN(loss_at_decision_pct) as worst_drill_loss FROM drill_results WHERE user_id = 'user_default'")
        drill_row = cursor.fetchone()
        if drill_row and drill_row["worst_drill_loss"] is not None:
            drill_loss = float(drill_row["worst_drill_loss"])
            # If drill shows selling before the breaking point, adjust breaking point closer to zero
            if drill_loss > breaking:
                breaking = round(drill_loss, 1)
                
        # Compare against standard portfolio allocations
        strategies = [
            ProfileStrategy(
                name="Current portfolio",
                worst_drawdown_pct=-21.0,
                verdict="Fits" if -21.0 >= breaking else "Too risky" if -21.0 < (breaking - 3) else "Stretch"
            ),
            ProfileStrategy(
                name="After suggested trims",
                worst_drawdown_pct=-17.0,
                verdict="Fits" if -17.0 >= breaking else "Too risky" if -17.0 < (breaking - 3) else "Stretch"
            ),
            ProfileStrategy(
                name="Defensive tilt",
                worst_drawdown_pct=-11.0,
                verdict="Fits" if -11.0 >= breaking else "Stretch"
            ),
        ]
        
        return ProfileOut(
            comfort_threshold_pct=comfort,
            breaking_point_pct=breaking,
            reaction_style=style,
            questions=[ProfileAnswer(**q) for q in raw_answers],
            strategies=strategies
        )

@router.post("/profile", response_model=ProfileOut)
def update_user_profile(payload: ProfileIn):
    """Update profile questions/answers and recalculate risk thresholds."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Compute thresholds if new answers provided
        answers_dict = [q.model_dump() for q in payload.answers] if payload.answers else DEFAULT_QUESTIONS
        comfort = payload.comfort_threshold_pct if payload.comfort_threshold_pct is not None else -8.0
        breaking = payload.breaking_point_pct if payload.breaking_point_pct is not None else -15.0
        style = payload.reaction_style or classify_reaction_style(answers_dict)
        
        cursor.execute("""
            INSERT INTO profiles (user_id, comfort_threshold_pct, breaking_point_pct, reaction_style, answers_json, updated_at)
            VALUES ('user_default', ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                comfort_threshold_pct=excluded.comfort_threshold_pct,
                breaking_point_pct=excluded.breaking_point_pct,
                reaction_style=excluded.reaction_style,
                answers_json=excluded.answers_json,
                updated_at=CURRENT_TIMESTAMP
        """, (comfort, breaking, style, json.dumps(answers_dict)))
        
        return get_user_profile()
