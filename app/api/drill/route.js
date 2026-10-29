import { readStore, mutateStore, now } from "@/lib/server/store";


const SCENARIO_IDS = new Set(["oil-rate", "recession", "flash-crash"]);
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function portfolioSnapshot(db) {
  const portfolio = db.portfolios?.find((item) => item.id === "default") || { cash_balance: 0 };
  const holdings = (db.holdings || []).filter((item) => item.portfolio_id === "default");
  const equityValue = holdings.reduce((sum, item) => sum + Math.max(0, number(item.quantity)) * Math.max(0, number(item.current_price || item.avg_buy_price)), 0);
  const cash = Math.max(0, number(portfolio.cash_balance));
  const total = equityValue + cash;
  const valued = holdings.map((item) => ({
    name: item.name || item.ticker || item.id,
    sector: item.sector || "unknown",
    value: Math.max(0, number(item.quantity)) * Math.max(0, number(item.current_price || item.avg_buy_price)),
  })).sort((a, b) => b.value - a.value);
  return {
    portfolio_value: Math.round(total * 100) / 100,
    cash_balance: cash,
    largest_holding: valued[0]?.name || null,
    largest_holding_weight_pct: total > 0 && valued[0] ? Math.round(valued[0].value / total * 1000) / 10 : 0,
    holding_count: valued.length,
    price_status: "seeded_fallback",
    price_note: "Stored/demo prices; not live market data.",
  };
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "A JSON request body is required." }, { status: 400 }); }
  const scenarioId = String(body?.scenario_id || "");
  if (!SCENARIO_IDS.has(scenarioId)) return Response.json({ error: "Choose a supported crisis drill scenario." }, { status: 400 });

  const db = readStore();
  const snapshot = portfolioSnapshot(db);
  if (snapshot.holding_count === 0 && snapshot.cash_balance <= 0) {
    return Response.json({ error: "No saved portfolio data is available. Add holdings or cash before starting a drill." }, { status: 409 });
  }
  return Response.json({
    drill_id: `drill-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    scenario_id: scenarioId,
    started_at: now(),
    portfolio: snapshot,
    data_quality: "seeded_fallback",
    scoring_method: "transparent-decision-rubric-v1",
  });
}

