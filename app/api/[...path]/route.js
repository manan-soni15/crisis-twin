import { handleGroqChatBody } from '@/lib/server/groq-voice-war-room-chat.js';
import { readStore, mutateStore, now } from '@/lib/server/store';
import { runQuantSimulation } from '@/lib/server/quant-engine.js';
import { runPropagation } from '@/lib/server/propagation-engine.js';
import { generateAdversarialDebate } from '@/lib/server/debate-orchestrator.js';
import { parseScenarioWithLlama, parseScenarioRules } from '@/lib/server/scenario-parser.js';

const json = (data, status = 200) => Response.json(data, { status });
const err = (message, status = 400) => json({ detail: message, message }, status);
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

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
      const hasCurrentPrice = Number.isFinite(Number(h.current_price)) && h.current_price !== null && h.current_price !== '' && Number(h.current_price) > 0;
      const price = hasCurrentPrice ? num(h.current_price) : null;
      const avgBuyPrice = Number.isFinite(Number(h.avg_buy_price)) && Number(h.avg_buy_price) > 0 ? num(h.avg_buy_price) : null;
      const val = price === null ? null : num(h.quantity) * price;
      const investedValue = avgBuyPrice === null ? null : num(h.quantity) * avgBuyPrice;
      const unrealizedPnl = val === null || investedValue === null ? null : val - investedValue;
      const reserved = db.paper_trades
        .filter((x) => x.status === 'PENDING' && x.side === 'sell' && x.holding_id === h.id)
        .reduce((s, x) => s + num(x.quantity), 0);
      return {
        id: h.id,
        name: h.name,
        ticker: h.ticker,
        sector: h.sector,
        weight: h.weight,
        beta: h.beta,
        day: h.day_change_pct,
        quantity: h.quantity,
        reserved_quantity: reserved,
        available_quantity: Math.max(0, h.quantity - reserved),
        current_price: price,
        current_price_available: price !== null,
        avg_buy_price: avgBuyPrice,
        invested_value: investedValue === null ? null : Math.round(investedValue * 100) / 100,
        unrealized_pnl: unrealizedPnl === null ? null : Math.round(unrealizedPnl * 100) / 100,
        return_pct: unrealizedPnl === null || investedValue === null || investedValue <= 0 ? null : Math.round((unrealizedPnl / investedValue) * 10000) / 100,
        value: val === null ? null : Math.round(val * 100) / 100,
      };
    });
  const equity = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const investedKnown = holdings.every((h) => h.invested_value !== null);
  const invested = holdings.reduce((s, h) => s + (h.invested_value ?? 0), 0);
  const unrealizedPnl = holdings.every((h) => h.current_price_available && h.invested_value !== null) ? equity - invested : null;
  const total = equity + cash;
  holdings.forEach((h) => (h.weight = total > 0 && h.value !== null ? Math.round((h.value / total) * 10000) / 100 : 0));
  return {
    portfolio_id: 'default',
    portfolio_value: Math.round(total * 100) / 100,
    invested_amount: investedKnown ? Math.round(invested * 100) / 100 : null,
    unrealized_pnl: unrealizedPnl === null ? null : Math.round(unrealizedPnl * 100) / 100,
    return_pct: unrealizedPnl === null || !investedKnown || invested <= 0 ? null : Math.round(unrealizedPnl / invested * 10000) / 100,
    cash_balance: cash,
    reserved_cash: reservedCash,
    available_cash: Math.max(0, cash - reservedCash),
    total_equity_value: Math.round(equity * 100) / 100,
    valuation_complete: holdings.every((h) => h.current_price_available),
    valuation_note: holdings.every((h) => h.current_price_available) ? 'All holdings have stored current prices; values are not live quotes.' : 'One or more holdings lack a current price. Portfolio totals exclude unpriced holdings and are incomplete.',
    holdings,
    pending_orders_count: trades.filter((x) => x.status === 'PENDING').length,
    last_updated: now(),
    is_live: false,
    price_status: 'manual_or_imported',
    price_source: 'manual_or_imported',
    price_as_of: null,
  };
}

function asAudit(db, r) {
  const logs = db.agent_logs
    .filter((l) => l.run_id === r.id)
    .map((l) => ({ agent: l.agent, text: l.response, confidence: l.confidence }));
  return {
    id: r.id,
    scenario: r.scenario_name,
    when: String(r.created_at || '').slice(0, 10),
    agents: logs.length,
    confidence: String(r.confidence || 'low').replace(/^./, (c) => c.toUpperCase()),
    methodology: r.methodology || "Quantitative scenario engine",
    shocks: r.shocks_json,
    expected_move_pct: r.expected_move_pct,
    survival_score: r.survival_score,
    log: logs.length ? logs : (r.assistant_answer ? [{ agent: 'Crisis Twin AI', text: r.assistant_answer, confidence: r.confidence }] : []),
    original_question: r.original_question || null,
    assistant_answer: r.assistant_answer || null,
    record_type: r.record_type || 'simulation',
    saved_by_user: Boolean(r.saved_by_user),
    expected_move_pct: r.expected_move_pct ?? null,
    p05: r.p05 ?? null,
    p95: r.p95 ?? null,
    survival_score: r.survival_score ?? null,
    created_at: r.created_at || null,
    per_holding: (() => { try { return typeof r.per_holding_json === 'string' ? JSON.parse(r.per_holding_json) : (r.per_holding || []); } catch { return []; } })(),
  };
}

async function handle(req, ctx) {
  const { path = [] } = await ctx.params;
  const p = '/' + path.join('/');
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

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
          p05: sim.p05,
          p95: sim.p95,
          cvar95: sim.cvar95,
          survival_score: 93,
          confidence: sim.confidence,
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
      per_holding: typeof run.per_holding_json === 'string' ? JSON.parse(run.per_holding_json) : (run.per_holding || []),
      risk_contribution: typeof run.risk_contribution_json === 'string' ? JSON.parse(run.risk_contribution_json) : (run.risk_contribution || []),
    };

    const includeRebuttal = Boolean(
      body.include_rebuttal ?? body.includeRebuttal ?? (url.searchParams.get('rebuttal') === 'true')
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

  try {
    return mutateStore((db) => {
    if (p === '/health' && method === 'GET') {
      return json({ status: 'healthy', service: 'Crisis Twin Next.js API', version: '1.0.0', environment: process.env.NODE_ENV || 'development' });
    }
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
        if (!name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0 || !Number.isFinite(currentPrice) || currentPrice <= 0) continue;
        const ticker = String(item?.ticker || '').trim().toUpperCase().slice(0, 24);
        const sector = String(item?.sector || 'other').toLowerCase().slice(0, 32);
        valid.push({
          id: `holding-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          portfolio_id: 'default', ticker: ticker || name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12),
          name, sector, quantity, avg_buy_price: avgBuyPrice, current_price: currentPrice,
          purchase_date: /^\\d{4}-\\d{2}-\\d{2}$/.test(String(item?.purchase_date || '')) ? String(item.purchase_date) : null,
          beta: 1, weight: 0, day_change_pct: 0, updated_at: now(),
        });
      }
      if (!valid.length && cashBalance === 0) return err('Add at least one valid holding or a cash balance greater than zero.');
      db.holdings = db.holdings.filter((h) => h.portfolio_id !== 'default').concat(valid);
      const account = db.portfolios.find((p) => p.id === 'default');
      if (account) { account.cash_balance = cashBalance; account.name = 'My Portfolio'; account.updated_at = now(); }
      else db.portfolios.push({ id: 'default', name: 'My Portfolio', user_id: 'user_default', cash_balance: cashBalance, created_at: now() });
      db.paper_trades = db.paper_trades.filter((t) => t.portfolio_id !== 'default');
      return json({ success: true, holdings_count: valid.length, portfolio: portfolio(db) });
    }

    if (p === '/portfolio' && method === 'GET') return json(portfolio(db));
    if (p === '/portfolio/refresh' && method === 'POST') {
      return json({ success: true, updated_count: 0, message: 'No live market-data provider is configured; manually entered/imported prices were not refreshed.', price_status: 'manual_or_imported' });
    }

    if (p === '/paper/trade' && method === 'POST') {
      if (body.confirmed !== true) return err('Explicit trade confirmation is required.', 400);
      const h = db.holdings.find((x) => x.id === body.holding_id);
      if (!h) return err('Holding not found.', 404);
      const qty = Math.floor(num(body.quantity));
      const side = String(body.side || '').toLowerCase();
      if (qty < 1 || !['buy', 'sell'].includes(side)) return err('Provide a valid side and positive integer quantity.');
      const price = num(body.price, num(h.current_price));
      if (price <= 0) return err('A valid price is required.');
      const total = qty * price;
      const pft = db.portfolios.find((x) => x.id === 'default');
      const type = body.order_type === 'limit' ? 'limit' : 'market';
      const limit = num(body.limit_price, price);
      const executes = type === 'market' || (side === 'buy' ? price <= limit : price >= limit);
      const order = {
        id: `order-${Date.now()}`,
        portfolio_id: 'default',
        holding_id: h.id,
        holding_name: h.name,
        ticker: h.ticker,
        side,
        order_type: type,
        quantity: qty,
        price,
        limit_price: type === 'limit' ? limit : null,
        executed_price: executes ? price : null,
        market_price: price,
        total_val: total,
        status: executes ? 'EXECUTED' : 'PENDING',
        confirmed: true,
        created_at: now(),
        executed_at: executes ? now() : null,
      };
      if (side === 'buy' && executes && pft.cash_balance < total) return err('Insufficient available cash.', 409);
      if (side === 'sell' && executes && h.quantity < qty) return err('Insufficient shares.', 409);
      if (executes) {
        if (side === 'buy') {
          const old = num(h.quantity);
          const newq = old + qty;
          h.avg_buy_price = (old * num(h.avg_buy_price) + qty * price) / newq;
          h.quantity = newq;
          pft.cash_balance -= total;
        } else {
          h.quantity -= qty;
          pft.cash_balance += total;
        }
      } else {
        if (side === 'buy' && pft.cash_balance < total) return err('Insufficient cash to reserve this limit order.', 409);
        if (side === 'sell' && h.quantity < qty) return err('Insufficient shares to reserve this limit order.', 409);
      }
      db.paper_trades.unshift(order);
      return json({ success: true, status: order.status, order, message: executes ? 'Paper trade executed.' : 'Limit order queued.' });
    }

    if (p === '/paper/orders' && method === 'GET') {
      let orders = [...db.paper_trades];
      const status = url.searchParams.get('status');
      if (status) orders = orders.filter((o) => o.status === status.toUpperCase());
      return json(orders);
    }

    let m = p.match(/^\/paper\/orders\/([^/]+)\/cancel$/);
    if (m && method === 'POST') {
      const o = db.paper_trades.find((x) => x.id === m[1]);
      if (!o) return err('Order not found.', 404);
      if (o.status !== 'PENDING') return err('Only pending orders can be cancelled.', 409);
      o.status = 'CANCELLED';
      return json({ success: true, message: 'Pending order cancelled.' });
    }

    if (p === '/paper/orders/process' && method === 'POST') {
      let count = 0;
      for (const o of db.paper_trades.filter((x) => x.status === 'PENDING')) {
        const h = db.holdings.find((x) => x.id === o.holding_id);
        const price = num(h?.current_price);
        const ok = o.side === 'buy' ? price <= num(o.limit_price) : price >= num(o.limit_price);
        if (!ok || !h) continue;
        const pf = db.portfolios.find((x) => x.id === 'default');
        if (o.side === 'buy' && pf.cash_balance < price * o.quantity) continue;
        if (o.side === 'sell' && h.quantity < o.quantity) continue;
        if (o.side === 'buy') {
          let old = num(h.quantity);
          let q = old + o.quantity;
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
        count++;
      }
      return json({ success: true, processed_count: db.paper_trades.filter((x) => x.status === 'PENDING').length + count, executed_count: count, executed_orders: [], message: `Processed pending orders; ${count} executed.` });
    }

    if (p === '/simulate' && method === 'POST') {
      const idempotencyKey = String(body.idempotency_key || '').trim().slice(0, 120);
      if (idempotencyKey) {
        const existing = db.runs.find((saved) => saved.idempotency_key === idempotencyKey);
        if (existing) {
          let existingShocks = {}; let existingPerHolding = []; let existingRisk = [];
          try { existingShocks = JSON.parse(existing.shocks_json || '{}'); } catch {}
          try { existingPerHolding = JSON.parse(existing.per_holding_json || '[]'); } catch {}
          try { existingRisk = JSON.parse(existing.risk_contribution_json || '[]'); } catch {}
          return json({ run_id: existing.id, scenario_name: existing.scenario_name, shocks: existingShocks.shocks || [], horizon_days: existing.horizon_days, expected_move_pct: existing.expected_move_pct, p05: existing.p05, p95: existing.p95, cvar95: existing.cvar95, survival_score: existing.survival_score, confidence: existing.confidence, per_holding: existingPerHolding, risk_contribution: existingRisk, created_at: existing.created_at, idempotent_replay: true });
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
        p05: run.p05,
        p95: run.p95,
        cvar95: run.cvar95,
        survival_score: Math.max(0, Math.min(100, Math.round(100 + run.expected_move_pct * 2))),
        confidence: run.confidence,
        in_fitted_range: run.in_fitted_range ? 1 : 0,
        model_version: 'quant-factor-sensitivity-v1',
        methodology: 'Sector factor sensitivity stress engine',
        per_holding_json: JSON.stringify(run.per_holding),
        risk_contribution_json: JSON.stringify(run.risk_contribution),
        created_at: run.created_at,
      });

      return json(run);
    }

    if (p === '/propagate' && (method === 'GET' || method === 'POST')) {
      const shockId = body.shock_id || url.searchParams.get('shock_id') || 'oil';
      const pData = portfolio(db);
      const propagationResult = runPropagation(shockId, pData.holdings);
      return json(propagationResult);
    }

    m = p.match(/^\/replay\/([^/]+)$/);
    if (m && method === 'GET') {
      const cid = m[1];
      const replays = {
        '2008': { crisis: '2008', label: '2008 financial crisis', span: 'Sep to Nov 2008', raw: 40, adj: 22, recover: 0.3, miss: 6, confidence: 'medium' },
        '2020': { crisis: '2020', label: '2020 pandemic crash', span: 'Feb to Apr 2020', raw: 28.5, adj: 11.5, recover: 0.5, miss: 4, confidence: 'high' },
        '2022': { crisis: '2022', label: '2022 rate hikes', span: 'Jan to Jun 2022', raw: 19, adj: 10, recover: 0.2, miss: 2, confidence: 'high' },
        'oil': { crisis: 'oil', label: 'Oil spike episode', span: 'Historical window', raw: 13, adj: 7, recover: 0.4, miss: 2, confidence: 'high' },
      };
      const found = replays[cid] || replays['2020'];
      return json(found);
    }

    if (p === '/why' && method === 'GET') {
      return json({ date: url.searchParams.get('date') || new Date().toISOString().slice(0, 10), drivers: [], message: 'No verified daily attribution data is available.' });
    }


    if (p === '/voice/intent' && method === 'POST') {
      const text = String(body.text || '');
      const scenario = parseScenarioRules(text);
      return json({ intent: scenario ? 'simulate_scenario' : 'portfolio_question', scenario, transcript: text, requires_confirmation: false });
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
      return json({ comfort_threshold_pct: null, breaking_point_pct: null, reaction_style: null, questions: [], strategies: [], profile_status: 'not_configured', note: 'No saved risk-profile answers are available. No default answers were inferred.' });
    }

    if (p === '/profile' && method === 'POST') {
      const allowedAnswers = {
        reaction: ['Hold and review', 'Trim some positions', 'Move mostly to cash'],
        horizon: ['Within 1 year', 'In 1–5 years', 'In 5+ years'],
        loss: ['Up to 5%', 'About 10–15%', 'More than 15%'],
      };
      if (!Array.isArray(body.answers) || !['reaction', 'horizon', 'loss'].every((key) => body.answers.some((item) => item?.key === key && allowedAnswers[key].includes(item?.answer)))) {
        return err('Please provide valid answers to all three risk-profile questions.', 400);
      }
      let row = db.profiles.find((x) => x.user_id === 'user_default');
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
      return json({ comfort_threshold_pct: vals.comfort_threshold_pct, breaking_point_pct: vals.breaking_point_pct, reaction_style: vals.reaction_style, questions: body.answers || [], strategies: [] });
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
      db.drill_results.push({ id, user_id: 'user_default', drill_name: body.drill_name || 'Market shock drill', option_chosen: option, seconds_taken: seconds, loss_at_decision_pct: loss, outcome_pct: outcome, debrief_sentence: debrief, created_at: now() });
      return json({ success: true, id, recorded_at: now(), debrief_sentence: debrief });
    }

    if (p.startsWith('/report/') && method === 'GET') {
      const id = decodeURIComponent(p.split('/')[2]);
      const r = db.runs.find((x) => x.id === id);
      if (!r) return err('No simulation runs found.', 404);
      return json({
        run_id: r.id,
        scenario_name: r.scenario_name,
        survival_score: r.survival_score,
        expected_move_pct: r.expected_move_pct,
        likely_range: [r.p05, r.p95],
        after_fix_pct: null,
        after_fix_status: 'not_simulated',
        confidence: r.confidence,
        hidden_risk: 'Scenario estimates are heuristic and should be reviewed carefully.',
        fix_description: 'Review the largest negative contributors and concentration before changing the portfolio.',
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
      const r = db.runs.find((x) => x.id === m[1]);
      return r ? json(asAudit(db, r)) : err(`Run '${m[1]}' not found.`, 404);
    }

    return err(`Route not found: ${method} ${p}`, 404);
    });
  } catch (error) {
    // Always return JSON from API failures so clients can display a useful
    // error instead of failing while parsing an empty/non-JSON response.
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


