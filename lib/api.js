// lib/api.js
// Single API client for Crisis Twin frontend.
// Uses same-origin Next.js Route Handlers under /api; no separate backend URL.
// Gracefully falls back to lib/sample.js if backend is unreachable.

import * as sample from "./sample";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

async function request(path, options = {}) {
  const url = `${BASE_URL}/api${path}`;
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", credentials: "omit", ...options.headers },
      ...options,
    });
    if (!res.ok) {
      let message = `API error ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData?.detail) {
          message = typeof errorData.detail === "string" ? errorData.detail : JSON.stringify(errorData.detail);
        } else if (errorData?.message) {
          message = errorData.message;
        }
      } catch (_) {}
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    return await res.json();
  } catch (err) {
    if (options.throwOnError) {
      throw err;
    }
    console.warn(`[Crisis Twin API] Falling back to sample data for ${path}:`, err.message);
    return null;
  }
}

// -------------------------------------------------------------
// Portfolio & Holdings
// -------------------------------------------------------------
export async function getPortfolio() {
  const live = await request("/portfolio");
  if (live && Array.isArray(live.holdings)) return live;
  // Do not silently substitute seeded sample holdings for a failed persistence request.
  return {
    portfolio_id: "default",
    portfolio_value: 0,
    cash_balance: 0,
    total_equity_value: 0,
    holdings: [],
    pending_orders_count: 0,
    last_updated: null,
    is_live: false,
    api_unavailable: true,
    error_message: "Saved portfolio could not be loaded. Check the server and retry; no sample holdings were substituted.",
  };
}

export async function submitPaperTrade(trade) {
  // trade: { holding_id, side: 'buy'|'sell', quantity, order_type: 'market'|'limit', price, limit_price, confirmed: true }
  try {
    const live = await request("/paper/trade", {
      method: "POST",
      body: JSON.stringify(trade),
      throwOnError: true,
    });
    if (live) return live;
    throw new Error("No response received from trade endpoint.");
  } catch (err) {
    console.error(`[Crisis Twin API] Paper trade failed for ${trade.holding_id}:`, err.message);
    return {
      success: false,
      status: "REJECTED",
      detail: err.message || "Failed to execute paper trade.",
      message: err.message || "Failed to execute paper trade.",
    };
  }
}

export async function getPaperOrders(status = null) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const live = await request(`/paper/orders${query}`);
  if (live && Array.isArray(live)) return live;
  return [];
}

export async function cancelPaperOrder(orderId) {
  try {
    const live = await request(`/paper/orders/${orderId}/cancel`, {
      method: "POST",
      throwOnError: true,
    });
    return live || { success: false, message: "No response from cancel endpoint" };
  } catch (err) {
    return { success: false, message: err.message || "Failed to cancel order" };
  }
}

export async function processPendingOrders() {
  try {
    const live = await request("/paper/orders/process", {
      method: "POST",
      throwOnError: true,
    });
    return live || { success: false, message: "No response from process endpoint" };
  } catch (err) {
    return { success: false, message: err.message || "Failed to process pending orders" };
  }
}

export async function refreshPortfolioPrices() {
  try {
    const live = await request("/portfolio/refresh", {
      method: "POST",
      throwOnError: true,
    });
    return live || { success: false };
  } catch (err) {
    return { success: false, message: err.message || "Failed to refresh prices" };
  }
}


// -------------------------------------------------------------
// Audit Runs
// -------------------------------------------------------------
export async function getAuditRuns(filters = {}) {
  const query = new URLSearchParams(filters).toString();
  const live = await request(`/audit/runs${query ? `?${query}` : ""}`);
  // Never show fabricated audit entries when persistence is unavailable.
  return live && Array.isArray(live.runs) ? live.runs : [];
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
    comfort_threshold_pct: null,
    breaking_point_pct: null,
    reaction_style: null,
    questions: [],
    strategies: [],
    unavailable: true,
    message: "Saved risk profile could not be loaded. No example answers or strategies were substituted.",
  };
}

export async function saveRiskProfile(payload) {
  try {
    const live = await request("/profile", {
      method: "POST",
      body: JSON.stringify(payload),
      throwOnError: true,
    });
    if (live) return live;
    return { success: false, message: "No response from profile endpoint." };
  } catch (err) {
    console.error("[Crisis Twin API] Save risk profile failed:", err.message);
    return { success: false, detail: err.message, message: err.message };
  }
}

export async function recordDrillResult(result) {
  // Normalize payload to match DrillResultIn backend schema (seconds, loss_at_decision)
  const payload = {
    drill_id: result.drill_id || `drill-${Date.now()}`,
    drill_name: result.drill_name || "Market shock drill",
    option: result.option || result.option_chosen || "Hold",
    seconds: result.seconds ?? result.seconds_taken ?? 30,
    loss_at_decision: result.loss_at_decision ?? result.loss_at_decision_pct ?? -4.1,
  };

  try {
    const live = await request("/drill/result", {
      method: "POST",
      body: JSON.stringify(payload),
      throwOnError: true,
    });
    if (live) return live;
    throw new Error("No response received from drill endpoint.");
  } catch (err) {
    console.error("[Crisis Twin API] Drill result request failed:", err.message);
    return {
      success: false,
      error: err.message || "Failed to record drill result.",
      message: err.message || "Failed to record drill result.",
    };
  }
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


/**
 * Strict War Room calls: unlike dashboard convenience helpers, these never
 * silently substitute sample/mock data when the backend is unavailable.
 */
export async function getPortfolioStrict() {
  const live = await request("/portfolio", { throwOnError: true });
  if (!live || !Array.isArray(live.holdings)) {
    throw new Error("The portfolio endpoint returned an invalid response.");
  }
  return live;
}

export async function parseScenarioStrict(text) {
  return request("/scenario/parse", {
    method: "POST",
    body: JSON.stringify({ text }),
    throwOnError: true,
  });
}

export async function runSimulationStrict(shockObject) {
  return request("/simulate", {
    method: "POST",
    body: JSON.stringify({ shock_object: shockObject }),
    throwOnError: true,
  });
}
