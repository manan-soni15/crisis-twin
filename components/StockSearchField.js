"use client";

import { useEffect, useRef, useState } from "react";

/** Search-assisted name/ticker entry. Prices are deliberately never auto-filled. */
export default function StockSearchField({ name, ticker, onChange }) {
  const [query, setQuery] = useState(name || ticker || "");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef(null);
  const chosenRef = useRef(false);

  useEffect(() => {
    setQuery(name || ticker || "");
  }, [name, ticker]);

  useEffect(() => {
    const value = query.trim();
    if (chosenRef.current) { chosenRef.current = false; return; }
    if (value.length < 2) { setResults([]); setStatus(""); setLoading(false); return; }
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    const timer = setTimeout(async () => {
      setLoading(true);
      setStatus("");
      try {
        const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Search unavailable.");
        if (controller.signal.aborted) return;
        setResults(Array.isArray(data.results) ? data.results : []);
        setStatus(data.results?.length ? "Choose a matching listing, or keep manual entry." : "No match found. Manual entry is available.");
        setOpen(true);
      } catch (error) {
        if (error.name !== "AbortError") { setResults([]); setStatus(error.message || "Search unavailable. Enter details manually."); setOpen(true); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  function choose(item) {
    chosenRef.current = true;
    setQuery(item.name);
    setResults([]);
    setOpen(false);
    setStatus(`${item.exchange} · ${item.market} listing selected. Confirm details; sector may be unavailable. Prices were not filled in.`);
    onChange({ name: item.name, ticker: item.symbol, exchange: item.exchange, sector: "other" });
  }

  return <div className="relative md:col-span-2">
    <label className="sr-only" htmlFor="stock-search">Company name or ticker</label>
    <input id="stock-search" aria-label="Company name or ticker" autoComplete="off" placeholder="Company name / ticker (search)" value={query} onChange={(event) => {
      const value = event.target.value;
      setQuery(value); setOpen(true); setStatus("");
      onChange({ name: value, ticker: "" });
    }} onFocus={() => { if (results.length) setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)} className="w-full rounded-lg border border-line px-2 py-2 text-sm" />
    {loading && <p className="mt-1 text-xs text-slate" role="status">Searching listings…</p>}
    {open && results.length > 0 && <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-line bg-white shadow-xl" role="listbox" aria-label="Stock search results">
      {results.map((item) => <button key={`${item.symbol}:${item.exchange}`} type="button" role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)} className="block w-full border-b border-line px-3 py-2 text-left last:border-0 hover:bg-slate-50">
        <span className="block text-sm font-semibold">{item.name} <span className="text-slate">({item.symbol})</span></span>
        <span className="block text-xs text-slate">{item.exchange} · {item.market} · sector not provided by search</span>
      </button>)}
    </div>}
    {status && <p className="mt-1 text-xs text-slate" role="status">{status}</p>}
    <p className="mt-1 text-[11px] text-slate">Unofficial search metadata; not a live quote. Verify the listing. You can enter any symbol manually.</p>
  </div>;
}
