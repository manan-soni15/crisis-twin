// lib/api.js
// Single API client for Crisis Twin frontend.
// Reads NEXT_PUBLIC_API_URL (defaults to http://localhost:8000).
// Gracefully falls back to lib/sample.js if backend is unreachable.

import * as sample from "./sample";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", credentials: "omit", ...options.headers },
      ...options,
    });
    if (!res.ok) {
      throw new Error(`API error ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`[Crisis Twin API] Falling back to sample data for ${path}:`, err.message);
    return null;
  }
}

// -------------------------------------------------------------
// Portfolio & Holdings
// -------------------------------------------------------------
export async function getPortfolio() {
  const live = await request("/portfolio");
  if (live && live.holdings) {
    return live;
  }
  // Fallback to sample
  return {
    portfolio_value: sample.PORTFOLIO_VALUE,
    holdings: sample.HOLDINGS.map((h) => ({
      id: h.id,
      name: h.name,
      sector: h.sector,
      weight: h.weight,
      beta: h.beta,
      day: h.day,
      quantity: Math.round((sample.PORTFOLIO_VALUE * (h.weight / 100)) / 2500),
      current_price: 2500,
      value: Math.round(sample.PORTFOLIO_VALUE * (h.weight / 100)),
    })),
    last_updated: new Date().toISOString(),
    is_live: false,
  };
}

export async function submitPaperTrade(trade) {
  // trade: { holding_id, side: 'buy'|'sell', quantity, price, confirmed: true }
  const live = await request("/paper/trade", {
    method: "POST",
    body: JSON.stringify(trade),
  });
  if (live) return live;
  return {
    success: true,
    simulated: true,
    message: `Order simulated: ${trade.side?.toUpperCase()} ${trade.quantity} units of ${trade.holding_id}.`,
    trade: { ...trade, id: `trade-${Date.now()}`, timestamp: new Date().toISOString() },
  };
}

// -------------------------------------------------------------
// Audit Runs
// -------------------------------------------------------------
export async function getAuditRuns(filters = {}) {
  const query = new URLSearchParams(filters).toString();
  const live = await request(`/audit/runs${query ? `?${query}` : ""}`);
  if (live && Array.isArray(live.runs)) return live.runs;

  return [
    {
      id: "run-0142",
      scenario: "Oil +25% and rates +100 bps",
      when: "Today",
      agents: 4,
      confidence: "Medium",
      model: "factors-v3",
      shocks: JSON.stringify({ oil_price: { change_pct: 25 }, policy_rate: { change_bps: 100 }, horizon_days: 10 }, null, 2),
      log: [
        { agent: "Bull", text: "Proposed a targeted trim." },
        { agent: "Bear", text: "Argued for a larger autos trim." },
        { agent: "Risk Auditor", text: "Flagged shared auto-credit risk." },
        { agent: "Manager", text: "Recommended three actions, dissent kept." },
      ],
    },
    {
      id: "run-0141",
      scenario: "Geopolitical conflict",
      when: "Yesterday",
      agents: 4,
      confidence: "Low",
      model: "factors-v3",
      shocks: JSON.stringify({ conflict: { severity: "high" }, horizon_days: 10 }, null, 2),
      log: [
        { agent: "Risk Auditor", text: "Scenario is outside the fitted data range." },
        { agent: "Manager", text: "Showed wider ranges and a low-confidence warning." },
      ],
    },
    {
      id: "run-0139",
      scenario: "Auto-sector scandal",
      when: "3 days ago",
      agents: 3,
      confidence: "High",
      model: "factors-v3",
      shocks: JSON.stringify({ company_event: { sector: "autos", size: -14 } }, null, 2),
      log: [
        { agent: "Bear", text: "Pointed to lenders as a second-round risk." },
        { agent: "Manager", text: "Recommended a small trim." },
      ],
    },
    {
      id: "run-0136",
      scenario: "Rates +150 bps",
      when: "Last week",
      agents: 4,
      confidence: "Medium",
      model: "factors-v2",
      shocks: JSON.stringify({ policy_rate: { change_bps: 150 } }, null, 2),
      log: [{ agent: "Manager", text: "Recommended shifting weight away from banks." }],
    },
  ];
}

export async function getAuditRun(runId) {
  const live = await request(`/audit/runs/${runId}`);
  if (live) return live;
  const list = await getAuditRuns();
  return list.find((r) => r.id === runId) || list[0];
}

// -------------------------------------------------------------
// Risk Profile & Crisis Drills
// -------------------------------------------------------------
export async function getRiskProfile() {
  const live = await request("/profile");
  if (live) return live;
  return {
    comfort_threshold_pct: -8,
    breaking_point_pct: -15,
    reaction_style: "holds then sells late",
    questions: [
      { q: "Your portfolio drops 15% in a week. What do you do?", a: "Sell a third and wait", loss_threshold: -15 },
      { q: "A friend says a stock will double. How much do you put in?", a: "A small amount", loss_threshold: -5 },
      { q: "The market falls for six months straight. You are most likely to", a: "Hold, then sell late", loss_threshold: -20 },
      { q: "When do you need this money?", a: "In five years or more", loss_threshold: -25 },
    ],
    strategies: [
      { name: "Current portfolio", worst_drawdown_pct: -21, verdict: "Too risky" },
      { name: "After suggested trims", worst_drawdown_pct: -17, verdict: "Stretch" },
      { name: "Defensive tilt", worst_drawdown_pct: -11, verdict: "Fits" },
    ],
  };
}

export async function saveRiskProfile(payload) {
  const live = await request("/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (live) return live;
  return { success: true, ...payload };
}

export async function recordDrillResult(result) {
  // result: { drill_id, option, seconds_taken, loss_at_decision_pct }
  const live = await request("/drill/result", {
    method: "POST",
    body: JSON.stringify(result),
  });
  if (live) return live;
  return { success: true, saved: result };
}

// -------------------------------------------------------------
// Report Card
// -------------------------------------------------------------
export async function getReportCard(runId = "run-0142") {
  const live = await request(`/report/${runId}`);
  if (live) return live;
  return {
    run_id: runId,
    scenario_name: "Oil +25% and rates +100 bps",
    survival_score: 72,
    expected_move_pct: -4.1,
    likely_range: [-6.8, -1.9],
    after_fix_pct: -3.4,
    confidence: "Medium",
    hidden_risk: "HDFC Bank and Tata Motors share auto-credit risk. Together they are 32% of the portfolio.",
    fix_description: "Trim Tata Motors to 8%, IndiGo to 6%, add defensives (+7 points).",
    timestamp: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// Simulation & Scenario (Aditya & Manan stubs)
// -------------------------------------------------------------
export async function parseScenario(text) {
  const live = await request("/scenario/parse", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  if (live) return live;
  return {
    scenario_name: text.slice(0, 40),
    horizon_days: 10,
    shocks: [
      { factor: "oil_price", change_pct: 25 },
      { factor: "policy_rate", change_bps: 100 },
    ],
  };
}

export async function runSimulation(shockObject, adjustments = null) {
  const live = await request("/simulate", {
    method: "POST",
    body: JSON.stringify({ shock_object: shockObject, adjustments }),
  });
  if (live) return live;
  return {
    run_id: `run-${Math.floor(1000 + Math.random() * 9000)}`,
    expected_move_pct: -4.1,
    p05: -6.8,
    p95: -1.9,
    cvar95: -7.4,
    per_holding: sample.HOLDINGS.map((h) => ({
      id: h.id,
      name: h.name,
      weight: h.weight,
      impact_pct: sample.holdingImpact("oil", h),
      beta: h.beta,
      breakdown: [
        { factor: "oil_price", value_pct: sample.holdingImpact("oil", h) * 0.6 },
        { factor: "policy_rate", value_pct: sample.holdingImpact("oil", h) * 0.4 },
      ],
    })),
    risk_contribution: [{ id: "hdfc", share: 0.24 }, { id: "tata", share: 0.21 }],
    confidence: "medium",
    in_fitted_range: true,
    model_version: "factors-v3",
  };
}
