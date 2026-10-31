// Server-side symbol lookup using Yahoo Finance's public search endpoint.
// This is an unofficial endpoint: availability, completeness, licensing and freshness are not guaranteed.
const CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_INTERVAL_MS = 250;
const cache = new Map();
let lastRequestAt = 0;

function normalizeResult(item) {
  const symbol = String(item?.symbol || '').trim().toUpperCase();
  const name = String(item?.shortname || item?.longname || '').trim();
  if (!symbol || !name) return null;
  const exchange = String(item?.exchDisp || item?.exchange || '').trim();
  const type = String(item?.quoteType || '').toUpperCase();
  if (type && !['EQUITY', 'ETF'].includes(type)) return null;
  let market = 'Other';
  if (/NSE|BSE|NSI|BOM/i.test(`${symbol} ${exchange}`)) market = 'India';
  else if (/NASDAQ|NYSE|NYSE ARCA|NYSE AMERICAN|NMS|NGM|NCM/i.test(exchange)) market = 'US';
  return {
    symbol,
    name,
    exchange: exchange || 'Unknown exchange',
    market,
    sector: null,
    currency: item?.currency || null,
    source: 'Yahoo Finance symbol search (unofficial endpoint)',
    quote_available: false,
    note: 'Search metadata only; no live price is supplied or implied.',
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 80);
  if (q.length < 2) return Response.json({ results: [], source: 'Yahoo Finance symbol search (unofficial endpoint)' });
  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return Response.json({ results: cached.results, cached: true, source: 'Yahoo Finance symbol search (unofficial endpoint)' });
  const now = Date.now();
  if (now - lastRequestAt < MIN_INTERVAL_MS) await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - (now - lastRequestAt)));
  lastRequestAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const endpoint = new URL('https://query1.finance.yahoo.com/v1/finance/search');
    endpoint.searchParams.set('q', q);
    endpoint.searchParams.set('quotesCount', '10');
    endpoint.searchParams.set('newsCount', '0');
    endpoint.searchParams.set('enableFuzzyQuery', 'false');
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'CrisisTwin/1.0 symbol-search' },
      cache: 'no-store',
    });
    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      return Response.json({ error: status === 429 ? 'Stock search is rate limited. Enter the ticker manually or try again shortly.' : 'Stock search provider is temporarily unavailable.', results: [], fallback: true }, { status });
    }
    const data = await response.json();
    const results = (Array.isArray(data?.quotes) ? data.quotes : []).map(normalizeResult).filter(Boolean).slice(0, 10);
    cache.set(key, { results, expires: Date.now() + CACHE_TTL_MS });
    if (cache.size > 250) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    return Response.json({ results, cached: false, source: 'Yahoo Finance symbol search (unofficial endpoint)', note: 'Coverage is not guaranteed. Confirm the exchange and symbol before saving.' });
  } catch (error) {
    return Response.json({ error: error?.name === 'AbortError' ? 'Stock search timed out. Enter the ticker manually.' : 'Stock search failed. Enter the ticker manually.', results: [], fallback: true }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
