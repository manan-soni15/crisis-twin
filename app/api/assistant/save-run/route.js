import { mutateStore, now } from '@/lib/server/store';

const text = (value, max = 5000) => String(value ?? '').trim().slice(0, max);
const finiteOrNull = (value) => Number.isFinite(Number(value)) && value !== null && value !== '' ? Number(value) : null;

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 }); }

  const question = text(body?.question, 1000);
  const answer = text(body?.answer, 8000);
  if (!question || !answer) {
    return Response.json({ ok: false, error: 'Both the original question and answer are required.' }, { status: 400 });
  }

  const result = body?.result && typeof body.result === 'object' ? body.result : {};
  const runId = `assistant-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const expected = finiteOrNull(result.expected_move_pct ?? result.expectedMovePct);
  const p05 = finiteOrNull(result.p05 ?? result.likely_range?.[0]);
  const p95 = finiteOrNull(result.p95 ?? result.likely_range?.[1]);
  const survival = finiteOrNull(result.survival_score ?? result.survivalScore);
  const scenario = text(result.scenario_name || result.scenario || question, 240);
  const createdAt = now();

  try {
    const saved = mutateStore((db) => {
      if (!Array.isArray(db.runs)) db.runs = [];
      if (!Array.isArray(db.agent_logs)) db.agent_logs = [];
      const run = {
        id: runId,
        scenario_name: scenario,
        shocks_json: JSON.stringify({ source: 'voice_assistant', question, answer, tool_calls: Array.isArray(body.tool_calls) ? body.tool_calls : [] }),
        horizon_days: finiteOrNull(result.horizon_days ?? result.horizonDays),
        expected_move_pct: expected,
        p05,
        p95,
        cvar95: finiteOrNull(result.cvar95),
        survival_score: survival,
        confidence: text(result.confidence || 'unrated', 30).toLowerCase(),
        in_fitted_range: result.in_fitted_range ? 1 : 0,
        model_version: `assistant-${text(body.source || 'unknown', 30)}`,
        per_holding_json: JSON.stringify(Array.isArray(result.per_holding) ? result.per_holding : []),
        risk_contribution_json: JSON.stringify(Array.isArray(result.risk_contribution) ? result.risk_contribution : []),
        created_at: createdAt,
        saved_by_user: true,
        record_type: 'assistant_analysis',
        original_question: question,
        assistant_answer: answer,
      };
      db.runs.unshift(run);
      db.agent_logs.push({ run_id: runId, agent: 'Crisis Twin AI', response: answer, confidence: run.confidence, created_at: createdAt });
      db.agent_logs = db.agent_logs.slice(-500);
      db.runs = db.runs.slice(0, 200);
      return { id: run.id, scenario_name: run.scenario_name, created_at: run.created_at };
    });
    return Response.json({ ok: true, run: saved });
  } catch (error) {
    console.error('[assistant-save-run] persistence failed:', error);
    return Response.json({ ok: false, error: 'Could not save this result to the local JSON store.' }, { status: 500 });
  }
}
