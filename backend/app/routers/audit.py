import json
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from backend.app.db.database import get_db
from backend.app.schemas.common import AuditRunOut, AuditRunsList, AgentLogEntry

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/runs", response_model=AuditRunsList)
def get_audit_runs(
    confidence: Optional[str] = Query(None, description="Filter by confidence: high, medium, low"),
    model: Optional[str] = Query(None, description="Filter by model version"),
    limit: int = Query(20, ge=1, le=100)
):
    """Retrieve audit history of simulation runs with parsed shocks and agent reasoning logs."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        query = "SELECT * FROM runs WHERE 1=1"
        params = []
        if confidence:
            query += " AND confidence = ?"
            params.append(confidence.lower())
        if model:
            query += " AND model_version = ?"
            params.append(model)
            
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        run_rows = cursor.fetchall()
        
        results = []
        for r in run_rows:
            # Fetch agent logs for this run
            cursor.execute("SELECT agent, response, confidence FROM agent_logs WHERE run_id = ?", (r["id"],))
            logs = [
                AgentLogEntry(
                    agent=l["agent"],
                    text=l["response"],
                    confidence=l["confidence"]
                )
                for l in cursor.fetchall()
            ]
            
            # Format nicely
            results.append(AuditRunOut(
                id=r["id"],
                scenario=r["scenario_name"],
                when=r["created_at"][:10],
                agents=len(logs),
                confidence=r["confidence"].capitalize(),
                model=r["model_version"],
                shocks=r["shocks_json"],
                expected_move_pct=float(r["expected_move_pct"]),
                survival_score=int(r["survival_score"]),
                log=logs
            ))
            
        return AuditRunsList(runs=results, total=len(results))

@router.get("/runs/{run_id}", response_model=AuditRunOut)
def get_audit_run_detail(run_id: str):
    """Retrieve full audit record for a single run ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
        r = cursor.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
            
        cursor.execute("SELECT agent, response, confidence FROM agent_logs WHERE run_id = ?", (run_id,))
        logs = [
            AgentLogEntry(agent=l["agent"], text=l["response"], confidence=l["confidence"])
            for l in cursor.fetchall()
        ]
        
        return AuditRunOut(
            id=r["id"],
            scenario=r["scenario_name"],
            when=r["created_at"][:10],
            agents=len(logs),
            confidence=r["confidence"].capitalize(),
            model=r["model_version"],
            shocks=r["shocks_json"],
            expected_move_pct=float(r["expected_move_pct"]),
            survival_score=int(r["survival_score"]),
            log=logs
        )
