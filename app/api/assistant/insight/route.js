import { readStore } from '@/lib/server/store';

const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  const message = String(body?.message || '').trim().toLowerCase();
  if (!message) return Response.json({ handled: false });
  let db;
  try { db = readStore(); } catch { return Response.json({ handled: false }); }
  const account = (db.portfolios || []).find((p) => p.id === 'default') || { cash_balance: 0 };
  const holdings = (db.holdings || []).filter((h) => h.portfolio_id === 'default').map((h) => {
    const quantity = Math.max(0, n(h.quantity));
    const price = Math.max(0, n(h.current_price) || n(h.avg_buy_price));
    return { name: String(h.name || h.ticker || h.id || 'Unknown holding'), ticker: String(h.ticker || ''), sector: String(h.sector || 'unspecified'), value: quantity * price };
  });
  const cash = Math.max(0, n(account.cash_balance));
  const equity = holdings.reduce((sum, h) => sum + h.value, 0);
  const total = equity + cash;
  const ranked = [...holdings].sort((a, b) => b.value - a.value);
  let text = null;
  if (/\b(biggest|largest|highest)\b.*\b(holding|position|stock|investment)\b|\bwhat (is|are) my (biggest|largest|highest) holdings\b/.test(message)) {
    if (!ranked.length) text = 'There are no holdings in the saved portfolio yet.';
    else { const h = ranked[0]; text = `Your largest holding by stored market value is ${h.name}${h.ticker ? ` (${h.ticker})` : ''}, valued at ${money(h.value)}. That is ${total ? (h.value / total * 100).toFixed(1) : '0.0'}% of the portfolio including cash. Prices are stored demo values, not live market quotes.`; }
  } else if (/\b(portfolio value|how much is my portfolio|total portfolio|net portfolio value)\b/.test(message)) {
    text = `Your portfolio is valued at ${money(total)}, including ${money(equity)} in holdings and ${money(cash)} in cash. These values use stored prices, not live market quotes.`;
  } else if (/\b(how much cash|cash balance|available cash)\b/.test(message)) {
    text = `Your saved cash balance is ${money(cash)}, which is ${total ? (cash / total * 100).toFixed(1) : '0.0'}% of the portfolio. This is the local demo portfolio, not a connected brokerage account.`;
  } else if (/\b(list|show|name)\b.*\b(my )?(holdings|stocks|positions)\b/.test(message)) {
    text = ranked.length ? `Your saved holdings are: ${ranked.map((h) => `${h.name}${h.ticker ? ` (${h.ticker})` : ''}, ${money(h.value)}`).join('; ')}. Values are based on stored/demo prices.` : 'There are no saved holdings yet.';
  } else if (/\b(sector exposure|exposure by sector|sector allocation)\b/.test(message)) {
    const sectors = new Map();
    for (const h of holdings) sectors.set(h.sector, (sectors.get(h.sector) || 0) + h.value);
    text = `Your largest sector exposures by stored value are: ${[...sectors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sector, value]) => `${sector}, ${money(value)}, ${total ? (value / total * 100).toFixed(1) : '0.0'}% of total portfolio`).join('; ')}. These are based on the sector labels and stored prices in the demo portfolio.`;
  }
  if (!text) return Response.json({ handled: false });
  return Response.json({ handled: true, who: 'Crisis Twin AI', text, source: 'local', portfolio_context_loaded: true, price_status: 'seeded_fallback', tool_calls: [] });
}
