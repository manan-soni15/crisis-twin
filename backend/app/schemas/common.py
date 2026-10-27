from pydantic import BaseModel
from typing import List, Optional, Any

class AgentLogEntry(BaseModel):
    agent: str
    text: str
    confidence: Optional[int] = 3
    evidence: Optional[str] = None

class AuditRunOut(BaseModel):
    id: str
    scenario: str
    when: str
    agents: int
    confidence: str
    model: str
    shocks: str
    expected_move_pct: float
    survival_score: int
    log: List[AgentLogEntry]

class AuditRunsList(BaseModel):
    runs: List[AuditRunOut]
    total: int

class ProfileAnswer(BaseModel):
    q: str
    a: str
    loss_threshold: Optional[float] = -10.0

class ProfileStrategy(BaseModel):
    name: str
    worst_drawdown_pct: float
    verdict: str

class ProfileIn(BaseModel):
    answers: Optional[List[ProfileAnswer]] = None
    comfort_threshold_pct: Optional[float] = None
    breaking_point_pct: Optional[float] = None
    reaction_style: Optional[str] = None

class ProfileOut(BaseModel):
    comfort_threshold_pct: float
    breaking_point_pct: float
    reaction_style: str
    questions: List[ProfileAnswer]
    strategies: List[ProfileStrategy]

class DrillResultIn(BaseModel):
    drill_id: str
    drill_name: Optional[str] = "Market shock drill"
    option: str
    seconds: int
    loss_at_decision: float

class DrillResultOut(BaseModel):
    success: bool
    id: str
    recorded_at: str
    debrief_sentence: str

class ReportCardOut(BaseModel):
    run_id: str
    scenario_name: str
    survival_score: int
    expected_move_pct: float
    likely_range: List[float]
    after_fix_pct: float
    confidence: str
    hidden_risk: str
    fix_description: str
    timestamp: str
