import { readStore, now } from './store.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_DEFAULT = 'openai/gpt-oss-20b';
const MAX_TOOL_ROUNDS = 4;
const json = (data, status = 200) => Response.json(data, { status });
const numeric = (value, fallback = 0) => {
  const valueAsNumber = Number(value);
  return Number.isFinite(valueAsNumber) ? valueAsNumber : fallback;
};
const money = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;

// Model cascade for resilient war-room operations
const MODELS_CASCADE = Array.from(
  new Set([process.env.GROQ_MODEL || MODEL_DEFAULT, 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'])
);

function getPortfolio(db) {
  const account = (Array.isArray(db?.portfolios) ? db.portfolios : []).find((item) => item.id === 'default') || { cash_balance: 0 };
  const cash = Math.max(0, numeric(account.cash_balance));
  const holdings = (Array.isArray(db?.holdings) ? db.holdings : [])
    .filter((holding) => holding.portfolio_id === 'default')
    .map((holding) => {
      const quantity = Math.max(0, numeric(holding.quantity));
      const price = Math.max(0, numeric(holding.current_price, numeric(holding.avg_buy_price)) || numeric(holding.avg_buy_price));
      return {
        id: String(holding.id || ''), name: String(holding.name || holding.ticker || 'Unnamed holding'),
        ticker: String(holding.ticker || ''), sector: String(holding.sector || 'unspecified'), quantity,
        current_price: price, value: quantity * price,
        day_change_pct: Number.isFinite(Number(holding.day_change_pct)) ? Number(holding.day_change_pct) : null,
        beta: Number.isFinite(Number(holding.beta)) ? Number(holding.beta) : null,
      };
    });
  const equity = holdings.reduce((sum, holding) => sum + holding.value, 0);
  const total = equity + cash;
  const ranked = holdings.map((holding) => ({ ...holding, weight_pct: total > 0 ? holding.value / total * 100 : 0 })).sort((a, b) => b.value - a.value);
  return {
    portfolio_value: total, cash_balance: cash, total_equity_value: equity,
    holdings: ranked, price_status: 'seeded_fallback', price_as_of: null, last_updated: now(),
    warning: 'Stored/demo prices only; not live market data.',
  };
}

function compactContext(portfolio, db) {
  const recentRuns = (Array.isArray(db?.runs) ? db.runs : []).slice(0, 5).map((run) => ({
    id: run.id, scenario: run.scenario_name, horizon_days: run.horizon_days,
    estimated_portfolio_move_pct: run.expected_move_pct, p05: run.p05, p95: run.p95,
    confidence: run.confidence || 'low', model: run.model_version, created_at: run.created_at,
  }));
  return { portfolio, recent_simulations: recentRuns };
}

function toolSpecs() {
  return [
    { type: 'function', function: { name: 'get_portfolio_summary', description: 'Return the current saved portfolio value, cash, equity value, and allocation. Use for questions about the user portfolio.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
    { type: 'function', function: { name: 'get_holding_details', description: 'Get exact details of a holding by ticker or name fragment from the saved portfolio.', parameters: { type: 'object', properties: { query: { type: 'string', description: 'Holding name or ticker to look up' } }, required: ['query'], additionalProperties: false } } },
    { type: 'function', function: { name: 'get_sector_exposure', description: 'Calculate portfolio exposure by the saved sector labels, using stored market values.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
    { type: 'function', function: { name: 'get_simulation_history', description: 'Return recent saved crisis simulation runs and their methodology/confidence.', parameters: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 5 } }, additionalProperties: false } } },
    { type: 'function', function: { name: 'run_stress_test', description: 'Run a transparent heuristic stress test against the current holdings. Use when the user asks what-if/scenario-impact questions. Results are illustrative, low confidence and not forecasts.', parameters: { type: 'object', properties: {
      factor: { type: 'string', enum: ['oil_price', 'policy_rate', 'geopolitical_risk', 'broad_equity'] },
      change_pct: { type: 'number', description: 'Percent change for oil_price, geopolitical_risk or broad_equity. For broad_equity, negative means a market decline.' },
      change_bps: { type: 'number', description: 'Basis-point change for policy_rate. Positive means rates rise.' },
      horizon_days: { type: 'integer', minimum: 1, maximum: 90 },
    }, required: ['factor'], additionalProperties: false } } },
  ];
}

function runTool(name, args, portfolio, db) {
  if (name === 'get_portfolio_summary') {
    return { ...portfolio, allocation_pct: { equities: portfolio.portfolio_value ? Number((portfolio.total_equity_value / portfolio.portfolio_value * 100).toFixed(2)) : 0, cash: portfolio.portfolio_value ? Number((portfolio.cash_balance / portfolio.portfolio_value * 100).toFixed(2)) : 0 }, currency: 'INR', price_warning: portfolio.warning };
  }
  if (name === 'get_holding_details') {
    const query = String(args.query || '').toLowerCase().trim();
    const matches = portfolio.holdings.filter((h) => h.name.toLowerCase().includes(query) || h.ticker.toLowerCase().includes(query));
    return { matches, message: matches.length ? 'Values use saved demo/stored prices.' : `No saved holding matched '${query}'.` };
  }
  if (name === 'get_sector_exposure') {
    const buckets = new Map();
    for (const h of portfolio.holdings) buckets.set(h.sector, (buckets.get(h.sector) || 0) + h.value);
    return { sectors: [...buckets.entries()].map(([sector, value]) => ({ sector, market_value: Number(value.toFixed(2)), pct_of_total: portfolio.portfolio_value ? Number((value / portfolio.portfolio_value * 100).toFixed(2)) : 0 })).sort((a, b) => b.market_value - a.market_value), price_warning: portfolio.warning };
  }
  if (name === 'get_simulation_history') {
    const limit = Math.max(1, Math.min(5, Math.floor(numeric(args.limit, 5))));
    return { simulations: (Array.isArray(db.runs) ? db.runs : []).slice(0, limit).map((run) => ({ id: run.id, scenario: run.scenario_name, horizon_days: run.horizon_days, expected_move_pct: run.expected_move_pct, p05: run.p05, p95: run.p95, confidence: run.confidence || 'low', model: run.model_version, created_at: run.created_at, per_holding: safeJson(run.per_holding_json) })), note: 'Saved results may be generated by a sector-sensitivity heuristic, not a calibrated forecast.' };
  }
  if (name === 'run_stress_test') return runStressTest(args, portfolio);
  return { error: `Unknown tool: ${name}` };
}

function safeJson(value) {
  if (typeof value !== 'string') return value ?? null;
  try { return JSON.parse(value); } catch { return null; }
}

function runStressTest(args, portfolio) {
  const factor = args.factor;
  const horizon = Math.max(1, Math.min(90, Math.floor(numeric(args.horizon_days, 10))));
  const scale = Math.sqrt(horizon / 10);
  if (factor === 'broad_equity') {
    if (args.change_pct === undefined || !Number.isFinite(Number(args.change_pct))) return { error: 'Provide change_pct for a broad-equity scenario.' };
    const change = Number(args.change_pct);
    const holdingResults = portfolio.holdings.map((h) => ({ name: h.name, ticker: h.ticker, sector: h.sector, weight_pct: Number(h.weight_pct.toFixed(2)), impact_pct: Number((change * scale).toFixed(3)), estimated_pnl_inr: Number((h.value * change / 100 * scale).toFixed(2)) }));
    return stressSummary(factor, change, horizon, portfolio, holdingResults, 'Assumes every saved equity holding moves by the requested percentage; cash is unchanged. This ignores correlations, derivatives, taxes, FX and instrument-specific behaviour.');
  }
  if (factor === 'oil_price') {
    if (args.change_pct === undefined || !Number.isFinite(Number(args.change_pct))) return { error: 'Provide change_pct for an oil-price scenario.' };
    const sensitivities = { energy: 0.2, airlines: -0.5, auto: -0.25, it: -0.05, pharma: 0.02, fmcg: -0.05, banks: -0.08 };
    const change = Number(args.change_pct);
    const holdingResults = portfolio.holdings.map((h) => { const impact = numeric(sensitivities[h.sector], -0.03) * change * scale; return { name: h.name, ticker: h.ticker, sector: h.sector, weight_pct: Number(h.weight_pct.toFixed(2)), impact_pct: Number(impact.toFixed(3)), estimated_pnl_inr: Number((h.value * impact / 100).toFixed(2)) }; });
    return stressSummary(factor, change, horizon, portfolio, holdingResults, 'Uses the app sector-sensitivity heuristic. The coefficients are illustrative assumptions, not empirically calibrated estimates.');
  }
  if (factor === 'policy_rate') {
    if (args.change_bps === undefined || !Number.isFinite(Number(args.change_bps))) return { error: 'Provide change_bps for a policy-rate scenario.' };
    const sensitivities = { banks: -0.03, auto: -0.02, it: -0.01, fmcg: -0.005, energy: -0.005, airlines: -0.01, pharma: -0.002 };
    const change = Number(args.change_bps);
    const holdingResults = portfolio.holdings.map((h) => { const impact = numeric(sensitivities[h.sector], -0.01) * (change / 100) * scale; return { name: h.name, ticker: h.ticker, sector: h.sector, weight_pct: Number(h.weight_pct.toFixed(2)), impact_pct: Number(impact.toFixed(3)), estimated_pnl_inr: Number((h.value * impact / 100).toFixed(2)) }; });
    return stressSummary(factor, change, horizon, portfolio, holdingResults, 'Uses the app sector-sensitivity heuristic; rate effects vary by company and market conditions and are not calibrated.');
  }
  if (factor === 'geopolitical_risk') {
    if (args.change_pct === undefined || !Number.isFinite(Number(args.change_pct))) return { error: 'Provide change_pct for a geopolitical-risk scenario.' };
    const change = Number(args.change_pct);
    const holdingResults = portfolio.holdings.map((h) => { const impact = -0.1 * change * scale; return { name: h.name, ticker: h.ticker, sector: h.sector, weight_pct: Number(h.weight_pct.toFixed(2)), impact_pct: Number(impact.toFixed(3)), estimated_pnl_inr: Number((h.value * impact / 100).toFixed(2)) }; });
    return stressSummary(factor, change, horizon, portfolio, holdingResults, 'Applies a uniform illustrative shock to holdings; it is not a geopolitical forecasting model.');
  }
  return { error: 'Unsupported factor. No stress test was executed.' };
}

function stressSummary(factor, change, horizon, portfolio, holdings, assumption) {
  const changeKey = factor === 'policy_rate' ? `${change} bps` : `${change}%`;
  const delta = holdings.reduce((sum, h) => sum + h.estimated_pnl_inr, 0);
  const resultingValue = portfolio.portfolio_value + delta;
  const totalMovePct = portfolio.portfolio_value ? delta / portfolio.portfolio_value * 100 : 0;
  return {
    factor, shock: changeKey, horizon_days: horizon,
    current_portfolio_value_inr: Number(portfolio.portfolio_value.toFixed(2)), estimated_pnl_inr: Number(delta.toFixed(2)),
    estimated_portfolio_move_pct: Number(totalMovePct.toFixed(3)), estimated_portfolio_value_after_scenario_inr: Number(resultingValue.toFixed(2)),
    largest_negative_contributors: [...holdings].sort((a, b) => a.estimated_pnl_inr - b.estimated_pnl_inr).slice(0, 3),
    holding_impacts: holdings, confidence: 'low', methodology: 'heuristic_scenario_not_forecast', assumption, price_warning: portfolio.warning,
  };
}

function makeMessages(body, portfolio, db) {
  const context = compactContext(portfolio, db);
  const system = `You are Crisis Twin's institutional portfolio intelligence strategist in the Voice War Room. Answer in concise spoken-friendly language.
Formatting rules: do not output Markdown tables or vertical-pipe table syntax; explain comparisons with short spoken bullet points or clear phrases that sound natural when read aloud. Avoid decorative Markdown asterisks or bold spam.

INDIAN MACROECONOMIC INSIGHTS:
- Dalal Street & NIFTY dynamics: Indian equity markets are heavily influenced by crude oil (India imports ~85% of crude in USD, widening CAD and pressuring INR), RBI MPC repo rate decisions (affecting auto retail loans and bank NIMs), and domestic institutional SIP support (~₹20,000+ Cr monthly domestic mutual fund inflows).
- Export hedges: IT (Infosys) and US-generic pharma (Sun Pharma) benefit from rupee depreciation, offering natural hedges against imported inflation.
- Upstream energy: Reliance Industries captures Gross Refining Margin (GRM) expansion when global crack spreads widen.

You may call server-side tools to retrieve portfolio data and run deterministic illustrative stress tests. Use tool results as the authority for numbers; never invent holdings, prices, allocations, P&L, historical returns, correlations, market news, or live quotes. Current saved portfolio context: ${JSON.stringify(context)}. Prices are stored/demo prices, not live quotes. Portfolio currency is INR. Any stress-test output marked low confidence is a simple illustrative heuristic, not a calibrated forecast, VaR, investment advice, or a prediction. State key assumptions and limits. If asked about a market factor not supported by tools (e.g. FX, bond duration, specific US holdings), say that required data/model isn't available rather than pretending to calculate it. Never execute trades or claim to access brokers. Avoid making a specific buy/sell recommendation; explain exposures, contagion paths, and scenario mechanics.`;
  const prior = (Array.isArray(body?.history) ? body.history : []).slice(-10).map((item) => ({
    role: item?.role === 'assistant' || item?.who === 'Crisis Twin AI' || item?.who === 'Crisis Twin' ? 'assistant' : 'user',
    content: String(item?.text || '').slice(0, 1800),
  })).filter((item) => item.content.trim());
  return [{ role: 'system', content: system }, ...prior, { role: 'user', content: String(body?.message || '').trim().slice(0, 4000) }];
}

async function callGroq(messages, tools, apiKey, model) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, ...(Array.isArray(tools) && tools.length ? { tools, tool_choice: 'auto' } : {}), temperature: 0.2, max_tokens: 900 }),
    signal: AbortSignal.timeout(25000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String(payload?.error?.message || `HTTP ${response.status}`);
    const status = response.status === 429 ? 429 : (response.status === 401 || response.status === 403 ? 502 : 502);
    throw Object.assign(new Error(`Groq returned HTTP ${response.status}: ${detail}`), { status });
  }
  const message = payload?.choices?.[0]?.message;
  if (!message) throw Object.assign(new Error('Groq returned an empty response.'), { status: 502 });
  return { message, model: payload.model || model };
}

export async function answerWithGroq(body) {
  if (!String(body?.message || '').trim()) return json({ error: 'Please provide a question.' }, 400);
  let db;
  try { db = readStore(); } catch (error) {
    console.error('[voice-war-room] portfolio store read failed:', error);
    return json({ error: 'Crisis Twin could not read data/crisis-twin.json. Check the file is valid JSON and writable.' }, 500);
  }
  const portfolio = getPortfolio(db);
  const apiKey = String(process.env.GROQ_API_KEY || '').trim();
  if (!apiKey || apiKey.includes('INSERT_YOUR_KEY_HERE')) return json({ error: "Advanced analysis is temporarily unavailable. Saved-portfolio questions are still available.", code: 'ADVANCED_ANALYSIS_UNAVAILABLE' }, 503);
  const tools = toolSpecs();

  let lastError = null;

  // Attempt models across fallback cascade
  for (const modelCandidate of MODELS_CASCADE) {
    const messages = makeMessages(body, portfolio, db);
    try {
      let modelUsed = modelCandidate;
      for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
        const result = await callGroq(messages, tools, apiKey, modelCandidate);
        modelUsed = result.model;
        const assistantMessage = result.message;
        messages.push({ role: 'assistant', content: assistantMessage.content || null, ...(assistantMessage.tool_calls?.length ? { tool_calls: assistantMessage.tool_calls } : {}) });
        if (!assistantMessage.tool_calls?.length) {
          const answer = String(assistantMessage.content || '').trim();
          if (!answer) throw new Error('Groq returned no text.');
          return json({ who: 'Crisis Twin AI', text: answer, source: 'groq', model: modelUsed, portfolio_context_loaded: true, price_status: portfolio.price_status, tool_calls: messages.filter((m) => m.role === 'tool').map((m) => m.name) });
        }
        for (const call of assistantMessage.tool_calls.slice(0, 4)) {
          const name = call?.function?.name;
          let args = {};
          try { args = JSON.parse(call?.function?.arguments || '{}'); } catch { args = {}; }
          const result = runTool(name, args, portfolio, db);
          messages.push({ role: 'tool', tool_call_id: call.id, name, content: JSON.stringify(result) });
        }
      }
      messages.push({ role: 'system', content: 'Tool call limit reached. Summarize only the tool results already returned. Do not call more tools or invent missing data.' });
      const final = await callGroq(messages, [], apiKey, modelCandidate);
      const answer = String(final.message.content || '').trim();
      if (!answer) throw new Error('Groq reached its tool-call limit without returning a final answer.');
      return json({ who: 'Crisis Twin AI', text: answer, source: 'groq', model: final.model || modelCandidate, portfolio_context_loaded: true, price_status: portfolio.price_status, tool_calls: messages.filter((m) => m.role === 'tool').map((m) => m.name), tool_round_limit_reached: true });
    } catch (error) {
      console.warn(`[voice-war-room] Attempt with ${modelCandidate} failed:`, error?.message || error);
      lastError = error;
      // Continue to next model in cascade
    }
  }

  const status = Number(lastError?.status) || (lastError?.name === 'TimeoutError' || lastError?.name === 'AbortError' ? 504 : 502);
  console.error('[voice-war-room] Advanced analysis failed after model fallbacks:', lastError?.message || 'Unknown provider error');
  return json({ error: status === 504 ? 'The advanced analysis request timed out. Please try again.' : 'Advanced analysis is temporarily unavailable. Saved-portfolio questions are still available.', code: 'ADVANCED_ANALYSIS_UNAVAILABLE' }, status);
}

export async function handleGroqVoiceWarRoomChat(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }
  return answerWithGroq(body);
}

export async function handleGroqChatBody(body) {
  return answerWithGroq(body);
}
