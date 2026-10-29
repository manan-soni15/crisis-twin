import { mutateStore, now } from "@/lib/server/store";


const VALID_SCENARIOS = new Set(["oil-rate", "recession", "flash-crash"]);
const VALID_CHOICES = new Set(["hold", "trim", "cash", "hedge"]);
const BASE_SCORES = { hold: 3, trim: 4, cash: 3, hedge: 5 };

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function evaluateDecision({ choiceId, scenarioId, roundIndex, secondsTaken, estimatedLossPct }) {
  const scenarioAdjustment = scenarioId === "flash-crash" ? 1 : 0;
  const roundAdjustment = roundIndex === 2 ? 1 : 0;
  let rubric = BASE_SCORES[choiceId] ?? 2;
  if (choiceId === "hold" && Math.abs(estimatedLossPct) >= 7) rubric = Math.min(rubric, 3);
  if (choiceId === "cash" && Math.abs(estimatedLossPct) < 4) rubric = Math.min(rubric, 3);
  if (choiceId === "hedge") rubric = 5;
  if (choiceId === "trim") rubric = scenarioId === "recession" || roundIndex === 1 ? 5 : 4;
  if (scenarioAdjustment && choiceId === "hold") rubric = Math.max(2, rubric - 1);
  if (roundAdjustment && choiceId === "hedge") rubric = 5;

  // A response time affects process feedback only, not the underlying decision score.
  const score = Math.max(40, Math.min(100, rubric * 20));
  const feedbackByChoice = {
    hold: "Holding can avoid locking in losses, but it should be paired with clear monitoring triggers and a defined risk limit. This choice does not remove the portfolio's exposure to the scenario.",
    trim: "A targeted reduction can lower exposure to vulnerable sectors, but it may lock in losses. The rationale should be tied to portfolio exposure and a clear re-entry or review rule.",
    cash: "Raising cash can reduce market exposure and improve flexibility, but broad selling has opportunity costs and may be poorly timed. Consider liquidity needs and the size of the risk being reduced.",
    hedge: "A structured review of defensive exposure, liquidity, and alternative scenario sizes is a disciplined response. It still requires checking the assumptions and should not be treated as a guaranteed hedge.",
  };
  const pace = secondsTaken < 8 ? " You responded very quickly; make sure speed did not replace checking the assumptions." : secondsTaken > 30 ? " You used much of the decision window; consider preparing decision rules before the next crisis." : " Your response time was within the drill's decision window.";
  return {
    score,
    feedback: `${feedbackByChoice[choiceId]}${pace} Score is based on a transparent training rubric, not on a prediction of investment performance.`,
  };
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "A JSON request body is required." }, { status: 400 }); }
  const drillId = String(body?.drill_id || "").trim();
  const scenarioId = String(body?.scenario_id || "");
  const roundIndex = number(body?.round_index, -1);
  const decision = body?.decision || {};
  const choiceId = String(decision.choice_id || "");
  if (!drillId || !VALID_SCENARIOS.has(scenarioId)) return Response.json({ error: "Invalid drill or scenario." }, { status: 400 });
  if (!VALID_CHOICES.has(choiceId)) return Response.json({ error: "Choose one of the available decision options." }, { status: 400 });
  if (!Number.isInteger(roundIndex) || roundIndex < 0 || roundIndex > 2) return Response.json({ error: "Invalid drill round." }, { status: 400 });

  const result = evaluateDecision({
    choiceId,
    scenarioId,
    roundIndex,
    secondsTaken: Math.max(0, Math.min(45, number(decision.seconds_taken))),
    estimatedLossPct: number(decision.estimated_loss_pct),
  });
  const isFinal = body?.is_final === true;
  let saved = false;
  if (isFinal) {
    mutateStore((db) => {
      db.drill_results ||= [];
      db.drill_results.unshift({
        id: drillId,
        user_id: "user_default",
        drill_name: scenarioId,
        scenario_id: scenarioId,
        decisions_json: JSON.stringify([...(Array.isArray(body.previous_decisions) ? body.previous_decisions : []), { ...decision, score: result.score, feedback: result.feedback }]),
        option_chosen: choiceId,
        seconds_taken: number(decision.seconds_taken),
        loss_at_decision_pct: number(decision.estimated_loss_pct),
        outcome_pct: number(decision.estimated_loss_pct),
        debrief_sentence: result.feedback,
        completed: true,
        created_at: now(),
      });
    });
    saved = true;
  }
  return Response.json({
    success: true,
    score: result.score,
    feedback: result.feedback,
    completed: isFinal,
    saved,
    scoring_method: "transparent-decision-rubric-v1",
  });
}

