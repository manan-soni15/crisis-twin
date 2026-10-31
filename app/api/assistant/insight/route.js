import { readStore } from '@/lib/server/store';

const n = (value) => {
  const parsed = Number(value);
  return value !== null && value !== '' && Number.isFinite(parsed) ? parsed : 0;
};
const money = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const pct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

export async function POST(request) {
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON body.' }, { status: 400 }); }
  const message = String(body?.message || '').trim().toLowerCase();
  if (!message) return Response.json({ handled: false });
  let db;
  try { db = readStore(); }
  catch { return Response.json({ handled: false }); }

  const account = (db.portfolios || []).find((p) => p.id === 'default') || { cash_balance: 0 };
  const holdings = (db.holdings || []).filter((h) => h.portfolio_id === 'default').map((h) => {
    const quantity = Math.max(0, n(h.quantity));
    const currentPrice = n(h.current_price);
    const avgPrice = n(h.avg_buy_price);
    const value = quantity * currentPrice;
    const invested = quantity * avgPrice;
    const pnl = value - invested;
    return {
      name: String(h.name || h.ticker || h.id || 'Unknown holding'),
      ticker: String(h.ticker || ''),
      sector: String(h.sector || 'unspecified'),
      quantity, currentPrice, avgPrice, value, invested, pnl,
      returnPct: invested > 0 ? pnl / invested * 100 : null,
    };
  });
  const cash = Math.max(0, n(account.cash_balance));
  const equity = holdings.reduce((sum, h) => sum + h.value, 0);
  const invested = holdings.reduce((sum, h) => sum + h.invested, 0);
  const total = equity + cash;
  const ranked = [...holdings].sort((a, b) => b.value - a.value);
  const moneyFor = (h) => `${h.name}${h.ticker ? ` (${h.ticker})` : ''}: market value ${money(h.value)}`;
  let text = null;

  if (/\b(highest|largest|biggest|top)\b.*\b(holding|holdings|position|positions|stock|stocks|investment|investments)\b|\bwhat (?:is|are) my (?:highest|largest|biggest) holdings\b/.test(message)) {
    text = !ranked.length ? 'There are no holdings in the saved portfolio yet.' : `Your highest-value holdings by stored market value are: ${ranked.slice(0, 5).map(moneyFor).join('; ')}. Prices are saved manual/imported values, not live quotes.`;
  } else if (/\b(stocks?|holdings?)\b.*\b(profit|profits|gain|gains|green)\b|\b(in profit|profitable stocks?)\b/.test(message)) {
    const winners = holdings.filter((h) => h.pnl > 0);
    text = winners.length ? `Holdings currently in unrealized profit: ${winners.map((h) => `${h.name}${h.ticker ? ` (${h.ticker})` : ''}: ${money(h.pnl)} (${h.returnPct === null ? 'return unavailable' : pct(h.returnPct)})`).join('; ')}. Calculated from saved average cost and current price; quotes are not live.` : 'No saved holding currently shows an unrealized profit based on its stored average cost and current price.';
  } else if (/\b(stocks?|holdings?)\b.*\b(loss|losses|losing|red)\b|\b(in loss|loss-making stocks?)\b/.test(message)) {
    const losers = holdings.filter((h) => h.pnl < 0);
    text = losers.length ? `Holdings currently in unrealized loss: ${losers.map((h) => `${h.name}${h.ticker ? ` (${h.ticker})` : ''}: ${money(h.pnl)} (${h.returnPct === null ? 'return unavailable' : pct(h.returnPct)})`).join('; ')}. Calculated from saved average cost and current price; quotes are not live.` : 'No saved holding currently shows an unrealized loss based on its stored average cost and current price.';
  } else if (/\b(invested amount|amount invested|total invested|invested value)\b/.test(message)) {
    text = `Total invested amount based on saved average purchase prices is ${money(invested)}. Current holding market value is ${money(equity)}; unrealized P/L is ${money(equity - invested)}. Saved prices may be stale and are not live quotes.`;
  } else if (/\b(profit.?loss|p\s*\/\s*l|return percentage|percentage return|unrealized|profit and loss)\b/.test(message) && holdings.length) {
    text = `Across saved holdings, unrealized P/L is ${money(equity - invested)} (${invested ? pct((equity - invested) / invested * 100) : 'return unavailable'}). ${holdings.map((h) => `${h.name}: ${money(h.pnl)}${h.returnPct === null ? '' : ` (${pct(h.returnPct)})`}`).join('; ')}. Based on stored prices, not live quotes.`;
  } else if (/\b(portfolio value|how much is my portfolio|total portfolio|net portfolio value|portfolio composition)\b/.test(message)) {
    text = `Your saved portfolio totals ${money(total)}: ${money(equity)} in holdings and ${money(cash)} in cash. Invested amount by saved average cost is ${money(invested)}; unrealized P/L is ${money(equity - invested)}. Prices are saved manual/imported values, not live market quotes.`;
  } else if (/\b(how much cash|cash balance|available cash)\b/.test(message)) {
    text = `Your saved cash balance is ${money(cash)}, ${total ? (cash / total * 100).toFixed(1) : '0.0'}% of the portfolio. This is a local shared demo workspace, not a connected brokerage account.`;
  } else if (/\b(individual|specific|holding)\b.*\b(return|profit|loss|p\s*\/\s*l)\b|\b(return|profit|loss)\b.*\b(holding|stock|ticker)\b/.test(message)) {
    text = holdings.length ? holdings.map((h) => `${h.name}${h.ticker ? ` (${h.ticker})` : ''}: quantity ${h.quantity}, average cost ${h.avgPrice ? money(h.avgPrice) : 'not recorded'}, current price ${h.currentPrice ? money(h.currentPrice) : 'not recorded'}, P/L ${money(h.pnl)}${h.returnPct === null ? '' : ` (${pct(h.returnPct)})`}`).join('; ') + '. Prices are stored values, not live quotes.' : 'There are no saved holdings yet.';
  } else if (/\b(list|show|name)\b.*\b(my )?(holdings|stocks|positions)\b/.test(message)) {
    text = ranked.length ? `Your saved holdings are: ${ranked.map(moneyFor).join('; ')}. Values use saved prices.` : 'There are no saved holdings yet.';
  } else if (/\b(sector exposure|exposure by sector|sector allocation|largest sector)\b/.test(message)) {
    const sectors = new Map();
    for (const h of holdings) sectors.set(h.sector, (sectors.get(h.sector) || 0) + h.value);
    const sorted = [...sectors.entries()].sort((a, b) => b[1] - a[1]);
    text = sorted.length ? `Sector allocation by saved market value: ${sorted.map(([sector, value]) => `${sector}: ${money(value)}, ${total ? (value / total * 100).toFixed(1) : '0.0'}% of total portfolio`).join('; ')}. Largest sector is ${sorted[0][0]}. Based on stored sector labels and prices.` : 'No sector allocation is available because the saved portfolio has no holdings.';
  }
  if (!text) return Response.json({ handled: false });
  return Response.json({ handled: true, who: 'Crisis Twin AI', text, source: 'local', portfolio_context_loaded: true, price_status: 'manual_or_imported', tool_calls: [] });
}
