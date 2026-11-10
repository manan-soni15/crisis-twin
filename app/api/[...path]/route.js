import { handleGroqChatBody } from '@/lib/server/groq-voice-war-room-chat.js';
import { readStore, mutateStore, now } from '@/lib/server/store';
import { runQuantSimulation, SECTOR_DEFAULT_BETAS } from '@/lib/server/quant-engine.js';
import { runPropagation } from '@/lib/server/propagation-engine.js';
import { generateAdversarialDebate } from '@/lib/server/debate-orchestrator.js';
import { parseScenarioWithLlama, parseScenarioRules } from '@/lib/server/scenario-parser.js';

const json = (data, status = 200) => Response.json(data, { status });
const err = (message, status = 400) => json({ detail: message, message }, status);
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function resolveBeta(sector, rawBeta) {
  const b = Number(rawBeta);
  if (Number.isFinite(b) && b > 0 && b !== 1) return b;
  const key = String(sector || 'other').toLowerCase();
  return SECTOR_DEFAULT_BETAS[key] ?? (Number.isFinite(b) && b > 0 ? b : 1.0);
}

function portfolio(db) {
  const p = db.portfolios.find((x) => x.id === 'default') || { cash_balance: 0 };
  const cash = num(p.cash_balance);
  const trades = db.paper_trades.filter((x) => x.portfolio_id === 'default');
  const reservedCash = trades
    .filter((x) => x.status === 'PENDING' && x.side === 'buy')
    .reduce((s, x) => s + num(x.total_val), 0);
  const holdings = db.holdings
    .filter((h) => h.portfolio_id === 'default')
    .map((h) => {
      const hasCurrentPrice =
        Number.isFinite(Number(h.current_price)) &&
        h.current_price !== null &&
        h.current_price !== '' &&
        Number(h.current_price) > 0;
      const price = hasCurrentPrice ? num(h.current_price) : null;
      const avgBuyPrice =
        Number.isFinite(Number(h.avg_buy_price)) && Number(h.avg_buy_price) > 0
          ? num(h.avg_buy_price)
          : null;
      const val = price === null ? null : num(h.quantity) * price;
      const investedValue = avgBuyPrice === null ? null : num(h.quantity) * avgBuyPrice;
      const unrealizedPnl = val === null || investedValue === null ? null : val - investedValue;
      const reserved = db.paper_trades
        .filter((x) => x.status === 'PENDING' && x.side === 'sell' && x.holding_id === h.id)
        .reduce((s, x) => s + num(x.quantity), 0);
      const beta = resolveBeta(h.sector, h.beta);
      return {
        id: h.id,
        name: h.name,
        ticker: h.ticker,
        sector: h.sector,
        weight: h.weight,
        beta,
        day: num(h.day_change_pct, 0),
        day_change_pct: num(h.day_change_pct, 0),
        quantity: h.quantity,
        reserved_quantity: reserved,
        available_quantity: Math.max(0, h.quantity - reserved),
        current_price: price,
        current_price_available: price !== null,
        avg_buy_price: avgBuyPrice,
        purchase_date: h.purchase_date || null,
        invested_value: investedValue === null ? null : Math.round(investedValue * 100) / 100,
        unrealized_pnl: unrealizedPnl === null ? null : Math.round(unrealizedPnl * 100) / 100,
        return_pct:
          unrealizedPnl === null || investedValue === null || investedValue <= 0
            ? null
            : Math.round((unrealizedPnl / investedValue) * 10000) / 100,
        value: val === null ? null : Math.round(val * 100) / 100,
      };
    });
  const equity = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const investedKnown = holdings.every((h) => h.invested_value !== null);
  const invested = holdings.reduce((s, h) => s + (h.invested_value ?? 0), 0);
  const unrealizedPnl =
    holdings.every((h) => h.current_price_available && h.invested_value !== null)
      ? equity - invested
      : null;
  const total = equity + cash;
  holdings.forEach(
    (h) => (h.weight = total > 0 && h.value !== null ? Math.round((h.value / total) * 10000) / 100 : 0)
  );
  const isLive = p.price_status === 'live_yahoo_finance';
  return {
    portfolio_id: 'default',
    portfolio_value: Math.round(total * 100) / 100,
    invested_amount: investedKnown ? Math.round(invested * 100) / 100 : null,
    unrealized_pnl: unrealizedPnl === null ? null : Math.round(unrealizedPnl * 100) / 100,
    return_pct:
      unrealizedPnl === null || !investedKnown || invested <= 0
        ? null
        : Math.round((unrealizedPnl / invested) * 10000) / 100,
    cash_balance: cash,
    reserved_cash: reservedCash,
    available_cash: Math.max(0, cash - reservedCash),
    total_equity_value: Math.round(equity * 100) / 100,
    valuation_complete: holdings.every((h) => h.current_price_available),
    valuation_note: holdings.every((h) => h.current_price_available)
      ? isLive
        ? `Quotes refreshed from market data as of ${p.price_as_of || 'recent check'}.`
        : 'All holdings have stored current prices; click Refresh Prices to pull latest market quotes.'
      : 'One or more holdings lack a current price. Portfolio totals exclude unpriced holdings and are incomplete.',
    holdings,
    pending_orders_count: trades.filter((x) => x.status === 'PENDING').length,
    last_updated: p.updated_at || now(),
    is_live: isLive,
    price_status: p.price_status || 'manual_or_imported',
    price_source: p.price_source || 'manual_or_imported',
    price_as_of: p.price_as_of || null,
  };
}

function deriveRunMitigation(r) {
  const perHolding = (() => {
    try {
      return typeof r.per_holding_json === 'string'
        ? JSON.parse(r.per_holding_json)
        : r.per_holding || [];
    } catch {
      return [];
    }
  })();
  const expected = r.expected_move_pct ?? null;
  if (r.after_fix_pct !== undefined && r.after_fix_pct !== null && r.hidden_risk && r.fix_description) {
    return {
      after_fix_pct: Number(r.after_fix_pct),
      hidden_risk: r.hidden_risk,
      fix_description: r.fix_description,
      per_holding: perHolding,
    };
  }
  const losers = [...perHolding]
    .filter((h) => Number(h.impact_pct) < 0)
    .sort((a, b) => Number(a.impact_pct) - Number(b.impact_pct));
  if (!losers.length || expected === null) {
    return {
      after_fix_pct: r.after_fix_pct ?? expected,
      hidden_risk:
        r.hidden_risk ||
        r.assistant_answer ||
        'Scenario estimates are heuristic; inspect holding-level sensitivities in the audit trail.',
      fix_description:
        r.fix_description ||
        (r.original_question
          ? `Original request: ${r.original_question}`
          : 'Maintain current allocation and monitor trailing risk limits.'),
      per_holding: perHolding,
    };
  }
  const top1 = losers[0];
  const top2 = losers[1];
  const w1 = num(top1.weight ?? top1.weight_pct, 12);
  const w2 = top2 ? num(top2.weight ?? top2.weight_pct, 8) : 0;
  const trim1 = Math.min(w1, Math.max(2, Math.round(w1 * 0.3 * 10) / 10));
  const trim2 = top2 ? Math.min(w2, Math.max(1.5, Math.round(w2 * 0.25 * 10) / 10)) : 0;
  const savedImpact =
    (trim1 / 100) * -Number(top1.impact_pct) +
    (top2 ? (trim2 / 100) * -Number(top2.impact_pct) : 0);
  const afterFixPct = Math.round((Number(expected) + savedImpact) * 10) / 10;
  const combinedWeight = Math.round((w1 + w2) * 10) / 10;

  const hiddenRisk =
    r.hidden_risk ||
    (top2
      ? `${top1.name} (${top1.sector || 'equity'}) and ${top2.name} (${top2.sector || 'equity'}) make up ${combinedWeight}% of the portfolio and suffer correlated drawdown (${top1.impact_pct}% and ${top2.impact_pct}%) under this scenario.`
      : `${top1.name} accounts for ${w1}% of portfolio weight with a simulated ${top1.impact_pct}% drawdown.`);

  const fixDescription =
    r.fix_description ||
    (top2
      ? `Trim ${top1.name} by ${trim1} pts and ${top2.name} by ${trim2} pts, reallocating ${Math.round((trim1 + trim2) * 10) / 10}% into defensive cash/pharma reserves to soften expected drawdown from ${expected}% to ${afterFixPct}%.`
      : `Trim ${top1.name} by ${trim1} pts and shift proceeds to defensive reserves to reduce drawdown from ${expected}% to ${afterFixPct}%.`);

  return {
    after_fix_pct: afterFixPct,
    hidden_risk: hiddenRisk,
    fix_description: fixDescription,
    per_holding: perHolding,
  };
}

function asAudit(db, r) {
  const logs = db.agent_logs
    .filter((l) => l.run_id === r.id)
    .map((l) => ({ agent: l.agent, text: l.response, confidence: l.confidence }));
  const derived = deriveRunMitigation(r);
  return {
    id: r.id,
    scenario: r.scenario_name,
    when: String(r.created_at || '').slice(0, 10),
    agents: logs.length,
    confidence: String(r.confidence || 'low').replace(/^./, (c) => c.toUpperCase()),
    methodology: r.methodology || 'Quantitative scenario engine',
    shocks: r.shocks_json,
    expected_move_pct: r.expected_move_pct ?? null,
    after_fix_pct: derived.after_fix_pct ?? null,
    survival_score: r.survival_score ?? null,
    hidden_risk: derived.hidden_risk,
    fix_description: derived.fix_description,
    log: logs.length
      ? logs
      : r.assistant_answer
      ? [{ agent: 'Crisis Twin AI', text: r.assistant_answer, confidence: r.confidence }]
      : [],
    original_question: r.original_question || null,
    assistant_answer: r.assistant_answer || null,
    record_type: r.record_type || 'simulation',
    saved_by_user: Boolean(r.saved_by_user),
    p05: r.p05 ?? null,
    p95: r.p95 ?? null,
    created_at: r.created_at || null,
    per_holding: derived.per_holding,
  };
}

async function fetchYahooQuoteForTicker(rawTicker) {
  const clean = String(rawTicker || '').trim().toUpperCase();
  if (!clean) return null;
  const candidates = /\.[A-Z]{1,4}$/.test(clean)
    ? [clean]
    : [`${clean}.NS`, `${clean}.BO`, clean];

  for (const symbol of candidates) {
    try {
      const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
      const res = await fetch(endpoint, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CrisisTwin/1.0 market-refresh',
        },
        signal: AbortSignal.timeout(3500),
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      const regularPrice = Number(meta?.regularMarketPrice);
      const prevClose = Number(meta?.chartPreviousClose ?? meta?.previousClose);
      if (Number.isFinite(regularPrice) && regularPrice > 0) {
        const dayChangePct =
          Number.isFinite(prevClose) && prevClose > 0
            ? Math.round(((regularPrice - prevClose) / prevClose) * 10000) / 100
            : 0;
        return {
          symbol,
          price: Math.round(regularPrice * 100) / 100,
          day_change_pct: dayChangePct,
          currency: meta?.currency || 'INR',
        };
      }
    } catch {
      // Try next symbol candidate
    }
  }
  return null;
}

const HISTORICAL_CRISES = {
  '2008': {
    crisis: '2008',
    label: '2008 financial crisis',
    span: 'Sep to Nov 2008',
    raw: 40,
    adj: 22,
    recover: 0.3,
    miss: 6,
    confidence: 'medium',
    shocks: [
      { factor: 'volatility', change_pct: 65 },
      { factor: 'policy_rate', change_bps: 150 },
      { factor: 'usd_inr', change_pct: 12 },
      { factor: 'oil_price', change_pct: -25 },
    ],
    horizon_days: 45,
  },
  '2020': {
    crisis: '2020',
    label: '2020 pandemic crash',
    span: 'Feb to Apr 2020',
    raw: 28.5,
    adj: 11.5,
    recover: 0.5,
    miss: 4,
    confidence: 'high',
    shocks: [
      { factor: 'volatility', change_pct: 55 },
      { factor: 'oil_price', change_pct: 30 },
      { factor: 'geopolitical_risk', change_pct: 40 },
    ],
    horizon_days: 30,
  },
  '2022': {
    crisis: '2022',
    label: '2022 rate hikes',
    span: 'Jan to Jun 2022',
    raw: 19,
    adj: 10,
    recover: 0.2,
    miss: 2,
    confidence: 'high',
    shocks: [
      { factor: 'policy_rate', change_bps: 225 },
      { factor: 'oil_price', change_pct: 28 },
      { factor: 'usd_inr', change_pct: 7 },
    ],
    horizon_days: 30,
  },
  oil: {
    crisis: 'oil',
    label: 'Oil spike episode',
    span: 'Historical window',
    raw: 13,
    adj: 7,
    recover: 0.4,
    miss: 2,
    confidence: 'high',
    shocks: [
      { factor: 'oil_price', change_pct: 35 },
      { factor: 'policy_rate', change_bps: 75 },
      { factor: 'usd_inr', change_pct: 4 },
    ],
    horizon_days: 15,
  },
};

function findHoldingForTrade(holdings, identifier, actionText = '') {
  if (!Array.isArray(holdings) || !holdings.length) return null;
  const raw = String(identifier || '').trim();
  const lower = raw.toLowerCase();
  // 1. Exact ID match
  let match = holdings.find((h) => h.id === raw);
  if (match) return match;
  // 2. Ticker or name fragment match
  if (lower) {
    match = holdings.find(
      (h) =>
        String(h.ticker || '').toLowerCase() === lower ||
        String(h.ticker || '').toLowerCase().includes(lower) ||
        String(h.name || '').toLowerCase().includes(lower)
    );
    if (match) return match;
  }
  // 3. Sector / keyword fallback for Debate Room quick actions ("tata" -> auto, "indigo" -> airlines, "hdfc" -> banks, "sun" -> pharma, "itc" -> fmcg)
  const sectorMap = {
    tata: 'auto',
    auto: 'auto',
    indigo: 'airlines',
    airlines: 'airlines',
    hdfc: 'banks',
    bank: 'banks',
    sun: 'pharma',
    pharma: 'pharma',
    itc: 'fmcg',
    fmcg: 'fmcg',
    reliance: 'energy',
    energy: 'energy',
  };
  const mappedSector = sectorMap[lower] || sectorMap[String(actionText || '').toLowerCase()];
  if (mappedSector) {
    match = holdings.find((h) => String(h.sector || '').toLowerCase() === mappedSector);
    if (match) return match;
  }
  return null;
}

async function handle(req, ctx) {
  const { path = [] } = await ctx.params;
  const p = '/' + path.join('/');
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  let body = {};
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  try {
    // -------------------------------------------------------------
    // Async AI & External Provider Endpoints
    // -------------------------------------------------------------
    if (p === '/intelligence/chat') {
      if (method !== 'POST') return err('Method not allowed. Use POST /api/intelligence/chat.', 405);
      return handleGroqChatBody(body);
    }

    if (p === '/scenario/parse') {
      if (method !== 'POST') return err('Method not allowed. Use POST /api/scenario/parse.', 405);
      const parsed = await parseScenarioWithLlama(body.text);
      return parsed
        ? json(parsed)
        : err("I couldn't identify a supported shock. Try 'oil prices rise 20%' or 'interest rates rise 100 bps'.", 422);
    }

    if (p === '/debate') {
      const db = readStore();
      const runId = body.run_id || body.runId || url.searchParams.get('run_id');
      let run = db.runs.find((r) => r.id === runId) || db.runs[0];

      if (!run) {
        const pData = portfolio(db);
        const sim = runQuantSimulation(pData, {
          scenario_name: 'Oil +25% and rates +100 bps',
          shocks: [
            { factor: 'oil_price', change_pct: 25 },
            { factor: 'policy_rate', change_bps: 100 },
          ],
        });
        mutateStore((draft) => {
          draft.runs.unshift({
            id: sim.run_id,
            scenario_name: sim.scenario_name,
            shocks_json: JSON.stringify({ shocks: sim.shocks, horizon_days: sim.horizon_days }),
            expected_move_pct: sim.expected_move_pct,
            after_fix_pct: sim.after_fix_pct,
            p05: sim.p05,
            p95: sim.p95,
            cvar95: sim.cvar95,
            survival_score: sim.survival_score ?? 93,
            confidence: sim.confidence,
            hidden_risk: sim.hidden_risk,
            fix_description: sim.fix_description,
            model_version: 'quant-factor-sensitivity-v1',
            methodology: 'Sector factor sensitivity stress engine',
            per_holding_json: JSON.stringify(sim.per_holding),
            risk_contribution_json: JSON.stringify(sim.risk_contribution),
            created_at: sim.created_at,
          });
        });
        run = sim;
      }

      const simData = {
        scenario_name: run.scenario_name,
        expected_move_pct: run.expected_move_pct,
        p05: run.p05,
        p95: run.p95,
        per_holding:
          typeof run.per_holding_json === 'string'
            ? JSON.parse(run.per_holding_json)
            : run.per_holding || [],
        risk_contribution:
          typeof run.risk_contribution_json === 'string'
            ? JSON.parse(run.risk_contribution_json)
            : run.risk_contribution || [],
      };

      const includeRebuttal = Boolean(
        body.include_rebuttal ?? body.includeRebuttal ?? url.searchParams.get('rebuttal') === 'true'
      );
      const debatePayload = await generateAdversarialDebate(simData, { includeRebuttal });

      mutateStore((draft) => {
        (debatePayload.messages || []).forEach((m) => {
          draft.agent_logs.push({
            id: Date.now() + Math.random(),
            run_id: run.id,
            agent: m.name,
            response: m.text,
            confidence: m.conf,
            created_at: now(),
          });
        });
      });

      return json({ run_id: run.id, ...debatePayload });
    }

    if (p === '/portfolio/refresh' && method === 'POST') {
      const db = readStore();
      const targetHoldings = db.holdings.filter((h) => h.portfolio_id === 'default');
      if (!targetHoldings.length) {
        return json({
          success: true,
          updated_count: 0,
          message: 'No holdings in portfolio to refresh.',
          price_status: 'manual_or_imported',
        });
      }

      const quoteEntries = await Promise.all(
        targetHoldings.map(async (h) => {
          const quote = await fetchYahooQuoteForTicker(h.ticker || h.name);
          return [h.id, quote];
        })
      );
      const quoteMap = new Map(quoteEntries.filter(([, q]) => q !== null));

      if (quoteMap.size === 0) {
        return json({
          success: true,
          updated_count: 0,
          message:
            'Market quote service did not return live updates for current tickers; stored prices were retained.',
          price_status: 'manual_or_imported',
          portfolio: portfolio(db),
        });
      }

      const updatedPortfolio = mutateStore((draft) => {
        const ts = now();
        for (const h of draft.holdings) {
          if (h.portfolio_id !== 'default') continue;
          const q = quoteMap.get(h.id);
          if (q) {
            h.current_price = q.price;
            h.day_change_pct = q.day_change_pct;
            h.updated_at = ts;
          }
        }
        const acct = draft.portfolios.find((x) => x.id === 'default');
        if (acct) {
          acct.price_status = 'live_yahoo_finance';
          acct.price_source = 'Yahoo Finance (15m delayed/indicative)';
          acct.price_as_of = ts;
          acct.updated_at = ts;
        }
        return portfolio(draft);
      });

      return json({
        success: true,
        updated_count: quoteMap.size,
        message: `Refreshed market prices for ${quoteMap.size} of ${targetHoldings.length} holding(s).`,
        price_status: 'live_yahoo_finance',
        portfolio: updatedPortfolio,
      });
    }

    // -------------------------------------------------------------
    // Read-Only Endpoints (uses readStore() — zero disk writes on GET)
    // -------------------------------------------------------------
    if (method === 'GET' || (p === '/propagate' && method === 'POST') || (p === '/voice/intent' && method === 'POST')) {
      const db = readStore();

      if (p === '/health' && method === 'GET') {
        return json({
          status: 'healthy',
          service: 'Crisis Twin Next.js API',
          version: '1.1.0',
          environment: process.env.NODE_ENV || 'development',
        });
      }

      if (p === '/portfolio' && method === 'GET') {
        return json(portfolio(db));
      }

      if (p === '/paper/orders' && method === 'GET') {
        let orders = [...db.paper_trades];
        const status = url.searchParams.get('status');
        if (status) orders = orders.filter((o) => o.status === status.toUpperCase());
        return json(orders);
      }

      if (p === '/propagate') {
        const shockId = body.shock_id || url.searchParams.get('shock_id') || 'oil';
        const pData = portfolio(db);
        const propagationResult = runPropagation(shockId, pData.holdings);
        return json(propagationResult);
      }

      let m = p.match(/^\/replay\/([^/]+)$/);
      if (m && method === 'GET') {
        const cid = m[1];
        const base = HISTORICAL_CRISES[cid] || HISTORICAL_CRISES['2020'];
        const pData = portfolio(db);
        if (pData.holdings.length > 0) {
          const sim = runQuantSimulation(pData, {
            scenario_name: base.label,
            shocks: base.shocks,
            horizon_days: base.horizon_days,
          });
          const rawLoss = Math.max(4, Math.round(Math.abs(sim.p05) * 1.35 * 10) / 10);
          const adjLoss = Math.max(
            2,
            Math.round(Math.abs(sim.after_fix_pct ?? sim.expected_move_pct * 0.65) * 1.15 * 10) / 10
          );
          return json({
            crisis: base.crisis,
            label: base.label,
            span: base.span,
            raw: rawLoss,
            adj: Math.min(rawLoss - 1.5, adjLoss),
            recover: base.recover,
            miss: base.miss,
            confidence: sim.confidence || base.confidence,
            portfolio_customized: true,
            benchmark_raw: base.raw,
            benchmark_adj: base.adj,
          });
        }
        return json({ ...base, portfolio_customized: false });
      }

      if (p === '/why' && method === 'GET') {
        const pData = portfolio(db);
        const latestRun = db.runs[0] ? asAudit(db, db.runs[0]) : null;
        const holdingDrivers = pData.holdings
          .map((h) => ({
            id: h.id,
            name: h.name,
            ticker: h.ticker,
            sector: h.sector,
            weight_pct: h.weight,
            day_change_pct: h.day_change_pct,
            unrealized_pnl: h.unrealized_pnl,
            return_pct: h.return_pct,
            contribution_pct: Math.round(((h.weight || 0) * (h.day_change_pct || 0)) / 10) / 10,
          }))
          .sort((a, b) => Math.abs(b.contribution_pct) - Math.abs(a.contribution_pct));

        return json({
          date: url.searchParams.get('date') || new Date().toISOString().slice(0, 10),
          drivers: holdingDrivers,
          latest_simulation: latestRun,
          message: holdingDrivers.length
            ? 'Attribution computed from stored holdings and latest stress simulation.'
            : 'No holdings or simulation runs saved yet.',
        });
      }

      if (p === '/voice/intent' && method === 'POST') {
        const text = String(body.text || '');
        const scenario = parseScenarioRules(text);
        return json({
          intent: scenario ? 'simulate_scenario' : 'portfolio_question',
          scenario,
          transcript: text,
          requires_confirmation: false,
        });
      }

      if (p === '/profile' && method === 'GET') {
        const saved = db.profiles.find((x) => x.user_id === 'user_default');
        if (saved) {
          return json({
            comfort_threshold_pct: saved.comfort_threshold_pct,
            breaking_point_pct: saved.breaking_point_pct,
            reaction_style: saved.reaction_style,
            questions: JSON.parse(saved.answers_json || '[]'),
            strategies: [],
          });
        }
        return json({
          comfort_threshold_pct: null,
          breaking_point_pct: null,
          reaction_style: null,
          questions: [],
          strategies: [],
          profile_status: 'not_configured',
          note: 'No saved risk-profile answers are available. No default answers were inferred.',
        });
      }

      if (p.startsWith('/report/') && method === 'GET') {
        const id = decodeURIComponent(p.split('/')[2]);
        const r = db.runs.find((x) => x.id === id) || db.runs[0];
        if (!r) return err('No simulation runs found.', 404);
        const derived = deriveRunMitigation(r);
        return json({
          run_id: r.id,
          scenario_name: r.scenario_name,
          survival_score: r.survival_score,
          expected_move_pct: r.expected_move_pct,
          likely_range: [r.p05, r.p95],
          after_fix_pct: derived.after_fix_pct,
          after_fix_status: derived.after_fix_pct !== null ? 'simulated' : 'not_simulated',
          confidence: String(r.confidence || 'medium').replace(/^./, (c) => c.toUpperCase()),
          hidden_risk: derived.hidden_risk,
          fix_description: derived.fix_description,
          timestamp: r.created_at,
        });
      }

      if (p === '/audit/runs' && method === 'GET') {
        let runs = [...db.runs];
        const confidence = url.searchParams.get('confidence');
        const model = url.searchParams.get('model');
        const limit = Math.max(1, Math.min(100, num(url.searchParams.get('limit'), 20)));
        if (confidence) runs = runs.filter((r) => r.confidence === confidence.toLowerCase());
        if (model) runs = runs.filter((r) => r.model_version === model);
        return json({ runs: runs.slice(0, limit).map((r) => asAudit(db, r)), total: runs.length });
      }

      m = p.match(/^\/audit\/runs\/([^/]+)$/);
      if (m && method === 'GET') {
        const r = db.runs.find((x) => x.id === decodeURIComponent(m[1]));
        return r ? json(asAudit(db, r)) : err(`Run '${m[1]}' not found.`, 404);
      }
    }

    // -------------------------------------------------------------
    // State-Mutating Endpoints (uses mutateStore() for atomic writes)
    // -------------------------------------------------------------
    return mutateStore((db) => {
      if (p === '/portfolio/import' && method === 'POST') {
        const items = Array.isArray(body.holdings) ? body.holdings.slice(0, 100) : [];
        const cashBalance = num(body.cash_balance, 0);
        if (cashBalance < 0) return err('Cash balance cannot be negative.');
        const valid = [];
        for (const item of items) {
          const name = String(item?.name || '').trim().slice(0, 100);
          const quantity = num(item?.quantity, -1);
          const avgBuyPrice = num(item?.avg_buy_price ?? item?.price, -1);
          const currentPrice = num(item?.current_price ?? item?.price, -1);
          if (
            !name ||
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !Number.isFinite(avgBuyPrice) ||
            avgBuyPrice <= 0 ||
            !Number.isFinite(currentPrice) ||
            currentPrice <= 0
          ) {
            continue;
          }
          const ticker = String(item?.ticker || '').trim().toUpperCase().slice(0, 24);
          const sector = String(item?.sector || 'other').toLowerCase().slice(0, 32);
          valid.push({
            id: `holding-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
            portfolio_id: 'default',
            ticker: ticker || name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
            name,
            sector,
            quantity,
            avg_buy_price: avgBuyPrice,
            current_price: currentPrice,
            purchase_date: DATE_RE.test(String(item?.purchase_date || ''))
              ? String(item.purchase_date)
              : null,
            beta: resolveBeta(sector, item?.beta),
            weight: 0,
            day_change_pct: num(item?.day_change_pct, 0),
            updated_at: now(),
          });
        }
        if (!valid.length && cashBalance === 0) {
          return err('Add at least one valid holding or a cash balance greater than zero.');
        }
        db.holdings = db.holdings.filter((h) => h.portfolio_id !== 'default').concat(valid);
        const account = db.portfolios.find((x) => x.id === 'default');
        if (account) {
          account.cash_balance = cashBalance;
          account.name = 'My Portfolio';
          account.price_status = 'manual_or_imported';
          account.updated_at = now();
        } else {
          db.portfolios.push({
            id: 'default',
            name: 'My Portfolio',
            user_id: 'user_default',
            cash_balance: cashBalance,
            price_status: 'manual_or_imported',
            created_at: now(),
          });
        }
        db.paper_trades = db.paper_trades.filter((t) => t.portfolio_id !== 'default');
        return json({ success: true, holdings_count: valid.length, portfolio: portfolio(db) });
      }

      if (p === '/portfolio/holdings' && method === 'POST') {
        const name = String(body?.name || '').trim().slice(0, 100);
        const quantity = num(body?.quantity, -1);
        const avgBuyPrice = num(body?.avg_buy_price ?? body?.price, -1);
        const currentPrice = num(body?.current_price ?? body?.price, -1);
        if (
          !name ||
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          !Number.isFinite(avgBuyPrice) ||
          avgBuyPrice <= 0 ||
          !Number.isFinite(currentPrice) ||
          currentPrice <= 0
        ) {
          return err(
            'Enter a company name, positive quantity, average purchase price, and current price.',
            400
          );
        }
        const ticker =
          String(body?.ticker || '').trim().toUpperCase().slice(0, 24) ||
          name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        const sector = String(body?.sector || 'other').toLowerCase().slice(0, 32);
        const created = {
          id: `holding-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          portfolio_id: 'default',
          ticker,
          name,
          sector,
          quantity,
          avg_buy_price: avgBuyPrice,
          current_price: currentPrice,
          purchase_date: DATE_RE.test(String(body?.purchase_date || ''))
            ? String(body.purchase_date)
            : null,
          beta: resolveBeta(sector, body?.beta),
          weight: 0,
          day_change_pct: num(body?.day_change_pct, 0),
          updated_at: now(),
        };
        db.holdings.push(created);
        return json({ success: true, holding: created, portfolio: portfolio(db) });
      }

      let m = p.match(/^\/portfolio\/holdings\/([^/]+)$/);
      if (m && (method === 'PUT' || method === 'PATCH')) {
        const targetId = decodeURIComponent(m[1]);
        const existing = db.holdings.find(
          (h) => h.id === targetId && h.portfolio_id === 'default'
        );
        if (!existing) return err('Holding not found.', 404);
        const name = String(body?.name ?? existing.name ?? '').trim().slice(0, 100);
        const quantity = num(body?.quantity ?? existing.quantity, -1);
        const avgBuyPrice = num(body?.avg_buy_price ?? existing.avg_buy_price, -1);
        const currentPrice = num(body?.current_price ?? existing.current_price, -1);
        if (
          !name ||
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          !Number.isFinite(avgBuyPrice) ||
          avgBuyPrice <= 0 ||
          !Number.isFinite(currentPrice) ||
          currentPrice <= 0
        ) {
          return err(
            'Enter a company name, positive quantity, average purchase price, and current price.',
            400
          );
        }
        const sector = String(body?.sector ?? existing.sector ?? 'other')
          .toLowerCase()
          .slice(0, 32);
        existing.name = name;
        existing.ticker =
          String(body?.ticker ?? existing.ticker ?? '')
            .trim()
            .toUpperCase()
            .slice(0, 24) || name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
        existing.sector = sector;
        existing.quantity = quantity;
        existing.avg_buy_price = avgBuyPrice;
        existing.current_price = currentPrice;
        existing.purchase_date = DATE_RE.test(String(body?.purchase_date || ''))
          ? String(body.purchase_date)
          : existing.purchase_date || null;
        existing.beta = resolveBeta(sector, body?.beta ?? existing.beta);
        existing.updated_at = now();
        return json({ success: true, holding: existing, portfolio: portfolio(db) });
      }

      if (m && method === 'DELETE') {
        const targetId = decodeURIComponent(m[1]);
        const before = db.holdings.length;
        db.holdings = db.holdings.filter(
          (h) => !(h.id === targetId && h.portfolio_id === 'default')
        );
        if (db.holdings.length === before) return err('Holding not found.', 404);
        db.paper_trades = db.paper_trades.filter(
          (t) => !(t.holding_id === targetId && t.status === 'PENDING')
        );
        return json({ success: true, portfolio: portfolio(db) });
      }

      if (p === '/paper/trade' && method === 'POST') {
        if (body.confirmed !== true) return err('Explicit trade confirmation is required.', 400);
        const defaultHoldings = db.holdings.filter((x) => x.portfolio_id === 'default');
        const h = findHoldingForTrade(defaultHoldings, body.holding_id, body.action_title);
        if (!h) return err('Holding not found in your portfolio.', 404);
        let qty = Math.floor(num(body.quantity));
        const side = String(body.side || '').toLowerCase();
        if (qty < 1 || !['buy', 'sell'].includes(side)) {
          return err('Provide a valid side and positive integer quantity.');
        }

        const pft = db.portfolios.find((x) => x.id === 'default') || { cash_balance: 0 };
        const reservedCash = db.paper_trades
          .filter((x) => x.portfolio_id === 'default' && x.status === 'PENDING' && x.side === 'buy')
          .reduce((s, x) => s + num(x.total_val), 0);
        const availableCash = Math.max(0, num(pft.cash_balance) - reservedCash);

        const reservedShares = db.paper_trades
          .filter(
            (x) =>
              x.portfolio_id === 'default' &&
              x.status === 'PENDING' &&
              x.side === 'sell' &&
              x.holding_id === h.id
          )
          .reduce((s, x) => s + num(x.quantity), 0);
        const availableShares = Math.max(0, num(h.quantity) - reservedShares);

        // If trade originated from a fuzzy Debate Room quick-action, clamp sell quantity to available shares
        if (h.id !== body.holding_id && side === 'sell' && availableShares > 0 && qty > availableShares) {
          qty = Math.max(1, Math.floor(availableShares * 0.25));
        }

        const marketPrice = num(h.current_price, num(h.avg_buy_price));
        const price = num(body.price, marketPrice);
        if (price <= 0) return err('A valid price is required.');
        const total = qty * price;
        const type = body.order_type === 'limit' ? 'limit' : 'market';
        const limit = num(body.limit_price, price);
        const executes =
          type === 'market' || (side === 'buy' ? marketPrice <= limit : marketPrice >= limit);
        const executionPrice = executes ? (type === 'market' ? price : marketPrice) : null;
        const executionTotal = executes ? qty * executionPrice : total;

        if (side === 'buy' && availableCash < executionTotal) {
          return err(
            `Insufficient available cash (₹${Math.round(availableCash).toLocaleString('en-IN')} available after pending orders).`,
            409
          );
        }
        if (side === 'sell' && availableShares < qty) {
          return err(
            `Insufficient available shares (${availableShares} available after pending orders).`,
            409
          );
        }

        const order = {
          id: `order-${Date.now()}`,
          portfolio_id: 'default',
          holding_id: h.id,
          holding_name: h.name,
          ticker: h.ticker,
          side,
          order_type: type,
          quantity: qty,
          price: executes ? executionPrice : price,
          limit_price: type === 'limit' ? limit : null,
          executed_price: executionPrice,
          market_price: marketPrice,
          total_val: executionTotal,
          status: executes ? 'EXECUTED' : 'PENDING',
          confirmed: true,
          created_at: now(),
          executed_at: executes ? now() : null,
        };

        if (executes) {
          if (side === 'buy') {
            const old = num(h.quantity);
            const newq = old + qty;
            h.avg_buy_price = (old * num(h.avg_buy_price) + qty * executionPrice) / newq;
            h.quantity = newq;
            pft.cash_balance = Math.max(0, num(pft.cash_balance) - executionTotal);
          } else {
            h.quantity = Math.max(0, num(h.quantity) - qty);
            pft.cash_balance = num(pft.cash_balance) + executionTotal;
            const hasOtherPending = db.paper_trades.some(
              (x) => x.status === 'PENDING' && x.holding_id === h.id
            );
            if (h.quantity === 0 && !hasOtherPending) {
              db.holdings = db.holdings.filter((item) => item.id !== h.id);
            }
          }
        }
        db.paper_trades.unshift(order);
        return json({
          success: true,
          status: order.status,
          order,
          executed_price: order.executed_price,
          price: order.price,
          message: executes ? 'Paper trade executed.' : 'Limit order queued.',
        });
      }

      m = p.match(/^\/paper\/orders\/([^/]+)\/cancel$/);
      if (m && method === 'POST') {
        const o = db.paper_trades.find((x) => x.id === m[1]);
        if (!o) return err('Order not found.', 404);
        if (o.status !== 'PENDING') return err('Only pending orders can be cancelled.', 409);
        o.status = 'CANCELLED';
        return json({ success: true, message: 'Pending order cancelled.' });
      }

      if (p === '/paper/orders/process' && method === 'POST') {
        let count = 0;
        const executedOrders = [];
        const pendingList = db.paper_trades.filter((x) => x.status === 'PENDING');
        for (const o of pendingList) {
          const h = db.holdings.find((x) => x.id === o.holding_id);
          const price = num(h?.current_price);
          if (!h || price <= 0) continue;
          const ok = o.side === 'buy' ? price <= num(o.limit_price) : price >= num(o.limit_price);
          if (!ok) continue;
          const pf = db.portfolios.find((x) => x.id === 'default');
          if (o.side === 'buy' && num(pf?.cash_balance) < price * o.quantity) continue;
          if (o.side === 'sell' && num(h.quantity) < o.quantity) continue;
          if (o.side === 'buy') {
            const old = num(h.quantity);
            const q = old + o.quantity;
            h.avg_buy_price = (old * num(h.avg_buy_price) + o.quantity * price) / q;
            h.quantity = q;
            pf.cash_balance -= price * o.quantity;
          } else {
            h.quantity -= o.quantity;
            pf.cash_balance += price * o.quantity;
          }
          o.status = 'EXECUTED';
          o.executed_price = price;
          o.executed_at = now();
          o.total_val = price * o.quantity;
          executedOrders.push(o);
          count++;
        }
        return json({
          success: true,
          processed_count: pendingList.length,
          executed_count: count,
          executed_orders: executedOrders,
          message: `Processed pending orders; ${count} executed.`,
        });
      }

      if (p === '/simulate' && method === 'POST') {
        const idempotencyKey = String(body.idempotency_key || '').trim().slice(0, 120);
        if (idempotencyKey) {
          const existing = db.runs.find((saved) => saved.idempotency_key === idempotencyKey);
          if (existing) {
            let existingShocks = {};
            let existingPerHolding = [];
            let existingRisk = [];
            try {
              existingShocks = JSON.parse(existing.shocks_json || '{}');
            } catch {}
            try {
              existingPerHolding = JSON.parse(existing.per_holding_json || '[]');
            } catch {}
            try {
              existingRisk = JSON.parse(existing.risk_contribution_json || '[]');
            } catch {}
            const derived = deriveRunMitigation(existing);
            return json({
              run_id: existing.id,
              scenario_name: existing.scenario_name,
              shocks: existingShocks.shocks || [],
              horizon_days: existing.horizon_days,
              expected_move_pct: existing.expected_move_pct,
              after_fix_pct: derived.after_fix_pct,
              p05: existing.p05,
              p95: existing.p95,
              cvar95: existing.cvar95,
              survival_score: existing.survival_score,
              confidence: existing.confidence,
              hidden_risk: derived.hidden_risk,
              fix_description: derived.fix_description,
              per_holding: existingPerHolding,
              risk_contribution: existingRisk,
              created_at: existing.created_at,
              idempotent_replay: true,
            });
          }
        }
        const pData = portfolio(db);
        if (!pData.holdings.length) return err('A portfolio with holdings is required.', 422);
        const shockObj = body.shock_object || body;
        const run = runQuantSimulation(pData, shockObj);
        if (!run) return err('Failed to run simulation.', 422);

        db.runs.unshift({
          id: run.run_id,
          ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
          scenario_name: run.scenario_name,
          shocks_json: JSON.stringify({ shocks: run.shocks, horizon_days: run.horizon_days }),
          horizon_days: run.horizon_days,
          expected_move_pct: run.expected_move_pct,
          after_fix_pct: run.after_fix_pct,
          p05: run.p05,
          p95: run.p95,
          cvar95: run.cvar95,
          survival_score: run.survival_score,
          confidence: run.confidence,
          in_fitted_range: run.in_fitted_range ? 1 : 0,
          hidden_risk: run.hidden_risk,
          fix_description: run.fix_description,
          model_version: 'quant-factor-sensitivity-v1',
          methodology: 'Sector factor sensitivity stress engine',
          per_holding_json: JSON.stringify(run.per_holding),
          risk_contribution_json: JSON.stringify(run.risk_contribution),
          created_at: run.created_at,
        });

        return json(run);
      }

      if (p === '/profile' && method === 'POST') {
        const allowedAnswers = {
          reaction: ['Hold and review', 'Trim some positions', 'Move mostly to cash'],
          horizon: ['Within 1 year', 'In 1–5 years', 'In 5+ years'],
          loss: ['Up to 5%', 'About 10–15%', 'More than 15%'],
        };
        if (
          !Array.isArray(body.answers) ||
          !['reaction', 'horizon', 'loss'].every((key) =>
            body.answers.some(
              (item) => item?.key === key && allowedAnswers[key].includes(item?.answer)
            )
          )
        ) {
          return err('Please provide valid answers to all three risk-profile questions.', 400);
        }
        const row = db.profiles.find((x) => x.user_id === 'user_default');
        const vals = {
          user_id: 'user_default',
          comfort_threshold_pct: num(body.comfort_threshold_pct, -8),
          breaking_point_pct: num(body.breaking_point_pct, -15),
          reaction_style: body.reaction_style || 'holds then sells late',
          answers_json: JSON.stringify(body.answers || []),
          updated_at: now(),
        };
        if (row) Object.assign(row, vals);
        else db.profiles.push(vals);
        return json({
          comfort_threshold_pct: vals.comfort_threshold_pct,
          breaking_point_pct: vals.breaking_point_pct,
          reaction_style: vals.reaction_style,
          questions: body.answers || [],
          strategies: [],
        });
      }

      if (p === '/drill/result' && method === 'POST') {
        const id = `drill-${Date.now().toString(16)}`;
        const loss = num(body.loss_at_decision);
        const seconds = num(body.seconds, 30);
        const option = String(body.option || 'Hold');
        const outcome = /trim|hedge/i.test(option) ? loss * 0.75 : loss;
        const debrief =
          seconds < 15
            ? `Decided rapidly in ${seconds}s: chosen action '${option}' mitigated loss to ${outcome.toFixed(1)}%.`
            : seconds < 35
            ? `Measured response in ${seconds}s at ${loss}% loss. Realized outcome was ${outcome.toFixed(1)}%.`
            : `Slow to act (${seconds}s), approaching panic boundary before executing '${option}'.`;
        db.drill_results.push({
          id,
          user_id: 'user_default',
          drill_name: body.drill_name || 'Market shock drill',
          option_chosen: option,
          seconds_taken: seconds,
          loss_at_decision_pct: loss,
          outcome_pct: outcome,
          debrief_sentence: debrief,
          created_at: now(),
        });
        return json({ success: true, id, recorded_at: now(), debrief_sentence: debrief });
      }

      m = p.match(/^\/audit\/runs\/([^/]+)$/);
      if (m && method === 'DELETE') {
        const targetId = decodeURIComponent(m[1]);
        const before = db.runs.length;
        db.runs = db.runs.filter((r) => r.id !== targetId);
        if (db.runs.length === before) return err(`Run '${targetId}' not found.`, 404);
        db.agent_logs = db.agent_logs.filter((l) => l.run_id !== targetId);
        return json({ success: true, deleted_id: targetId });
      }

      return err(`Route not found: ${method} ${p}`, 404);
    });
  } catch (error) {
    console.error(`[Crisis Twin API] ${method} ${p} failed:`, error);
    return err(
      process.env.NODE_ENV === 'production'
        ? 'The request could not be completed. Please try again; if the problem persists, contact the workspace administrator.'
        : `The request could not be completed: ${error?.message || 'Unknown server error'}`,
      500
    );
  }
}

export async function GET(req, ctx) {
  return handle(req, ctx);
}
export async function POST(req, ctx) {
  return handle(req, ctx);
}
export async function PUT(req, ctx) {
  return handle(req, ctx);
}
export async function PATCH(req, ctx) {
  return handle(req, ctx);
}
export async function DELETE(req, ctx) {
  return handle(req, ctx);
}
