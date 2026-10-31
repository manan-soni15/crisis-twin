 "use client";

import { useState } from "react";
import { Panel, Button } from "@/components/ui";
import StockSearchField from "@/components/StockSearchField";

const SECTORS = ["energy", "airlines", "banks", "auto", "it", "pharma", "fmcg", "financials", "consumer", "healthcare", "industrials", "other"];
const blank = () => ({ name: "", ticker: "", sector: "other", exchange: "", quantity: "", avg_buy_price: "", current_price: "", purchase_date: "" });

export default function PortfolioSetup({ onImported }) {
  const [mode, setMode] = useState("");
  const [rows, setRows] = useState([blank()]);
  const [cash, setCash] = useState("0");
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function updateRow(index, key, value) {
    setRows((current) => current.map((row, i) => i === index ? { ...row, [key]: value } : row));
  }

  async function importRows(items = rows) {
    const valid = items.filter((r) => String(r.name || "").trim() && Number.isFinite(Number(r.quantity)) && Number(r.quantity) > 0 && Number.isFinite(Number(r.avg_buy_price)) && Number(r.avg_buy_price) > 0 && Number.isFinite(Number(r.current_price)) && Number(r.current_price) > 0);
    if (items.some((r) => String(r.name || "").trim()) && valid.length !== items.filter((r) => String(r.name || "").trim()).length) {
      setStatus("Each named holding needs a positive quantity, average purchase price, and current price. Missing prices are not guessed.");
      return;
    }
    if (!Number.isFinite(Number(cash)) || Number(cash) < 0) {
      setStatus("Cash balance must be a valid non-negative number.");
      return;
    }
    if (!valid.length && Number(cash) <= 0) {
      setStatus("Add at least one holding or a cash balance greater than zero.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/portfolio/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cash_balance: Number(cash) || 0, holdings: valid }),
      });
      // Some server/runtime failures can return an empty or non-JSON body.
      // Read as text first so the UI can show a useful message instead of
      // surfacing the confusing "Unexpected end of JSON input" parser error.
      const responseText = await response.text();
      let data = {};
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(
            response.ok
              ? "The server returned an unreadable response while saving. Please retry; if it continues, check the server terminal."
              : `Portfolio could not be saved (server error ${response.status}). Please check the server terminal for details.`
          );
        }
      } else if (!response.ok) {
        throw new Error(`Portfolio could not be saved (server error ${response.status}). Please check the server terminal for details.`);
      } else {
        throw new Error("The server returned an empty response while saving. Please retry; if it continues, check the server terminal.");
      }
      if (!response.ok) throw new Error(data.detail || data.message || data.error || `Portfolio could not be saved (server error ${response.status}).`);
      if (data.success === false) throw new Error(data.detail || data.message || "Portfolio could not be saved.");
      setStatus(`Portfolio saved: ${Number(data.holdings_count) || 0} holding(s) imported.`);
      onImported?.();
    } catch (error) {
      setStatus(error.message || "Could not save portfolio.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePdf(file) {
    if (!file) return;
    setFileName(file.name);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setStatus("Unsupported file type. Please choose a PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus("This PDF is larger than 10 MB. Export a smaller statement or enter holdings manually.");
      return;
    }
    setStatus("Reading PDF text. Scanned/image-only PDFs may need manual entry.");
    setBusy(true);
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data: bytes, maxImageSize: 10000000 }).promise;
      if (!pdf.numPages || pdf.numPages > 100) {
        await pdf.destroy();
        throw new Error("PDF must contain between 1 and 100 pages.");
      }
      let fullText = "";
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        const lineMap = new Map();
        for (const item of content.items) {
          const y = Math.round(item.transform?.[5] || 0);
          const current = lineMap.get(y) || [];
          current.push(item.str);
          lineMap.set(y, current);
        }
        fullText += [...lineMap.entries()].sort((a, b) => b[0] - a[0]).map(([, parts]) => parts.join(" ")).join("\n") + "\n";
      }
      const lines = fullText.split(/\n+/).flatMap((line) => line.split(/(?<=\s{2,})/)).map((line) => line.trim()).filter(Boolean);
      const parsed = [];
      const knownSectors = SECTORS;
      for (const line of lines) {
        // Accept common broker statement layouts containing name/ticker, quantity and average/current price.
        const match = line.match(/^(.{2,60}?)\s+([A-Z][A-Z0-9.&-]{1,14}(?:\.NS|\.BO)?)?\s+([\d,]+(?:\.\d+)?)\s+₹?\s*([\d,]+(?:\.\d{1,2})?)/);
        if (!match) continue;
        const name = match[1].replace(/[|•]/g, "").trim();
        const ticker = (match[2] || "").trim();
        const quantity = Number(match[3].replace(/,/g, ""));
        const price = Number(match[4].replace(/,/g, ""));
        if (name && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(price) && price >= 0) {
          parsed.push({ name, ticker, sector: "other", quantity: String(quantity), avg_buy_price: String(price), current_price: "", purchase_date: "" });
        }
      }
      const unique = parsed.filter((row, index) => parsed.findIndex((x) => x.name === row.name && x.ticker === row.ticker) === index).slice(0, 100);
      if (!unique.length) {
        setStatus("No holdings could be confidently extracted from this PDF. You can enter them manually below. Scanned PDFs require OCR, which is not enabled.");
      } else {
        setRows(unique);
        setMode("manual");
        setStatus(`Extracted ${unique.length} possible holding(s). The parsed price is only a candidate average purchase price; current prices were left blank rather than guessed. Review every field and enter a verified current price before saving.`);
      }
    } catch (error) {
      setStatus(`Could not read this PDF (${error.message || "unsupported format"}). Use manual entry instead.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ultra">Get started</p>
        <h2 className="display mt-2 text-3xl">Build your portfolio</h2>
        <p className="mt-2 max-w-2xl text-slate">Your workspace starts empty. Import a text-based portfolio PDF or enter holdings yourself. Nothing is assumed or preloaded.</p>
      </div>
      {!mode && <div className="grid gap-4 md:grid-cols-2">
        <button type="button" onClick={() => setMode("pdf")} className="rounded-2xl border border-line bg-white p-6 text-left transition hover:border-ultra">
          <span className="text-2xl">↥</span><h3 className="head mt-3 text-xl">Upload portfolio PDF</h3><p className="mt-2 text-sm text-slate">Extract possible holdings from a text-based broker statement, then review before importing.</p>
        </button>
        <button type="button" onClick={() => setMode("manual")} className="rounded-2xl border border-line bg-white p-6 text-left transition hover:border-ultra">
          <span className="text-2xl">＋</span><h3 className="head mt-3 text-xl">Enter manually</h3><p className="mt-2 text-sm text-slate">Add tickers, sectors, quantities, average purchase prices and current prices yourself.</p>
        </button>
      </div>}
      {mode === "pdf" && <Panel title="Upload portfolio statement">
        <label className="block text-sm font-medium">Portfolio PDF</label>
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => void handlePdf(e.target.files?.[0])} className="mt-2 block w-full rounded-xl border border-line bg-white p-3 text-sm" />
        {fileName && <p className="mt-2 text-xs text-slate">Selected: {fileName}</p>}
        <p className="mt-2 text-xs text-slate">PDF text is extracted in your browser (maximum 10 MB and 100 pages). Scanned/image-only PDFs are not OCR-processed. Parsed values are suggestions only; current prices are never inferred from purchase prices. Review extracted rows before saving.</p>
        <Button variant="ghost" onClick={() => setMode("manual")}>Enter manually instead</Button>
      </Panel>}
      {mode === "manual" && <Panel title="Portfolio holdings">
        <div className="mb-4 max-w-xs"><label className="block text-sm font-medium">Cash balance (₹)</label><input type="number" min="0" value={cash} onChange={(e) => setCash(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" /></div>
        <div className="space-y-3">
          {rows.map((row, i) => <div key={i} className="grid gap-2 rounded-xl border border-line p-3 md:grid-cols-4">
            <StockSearchField name={row.name} ticker={row.ticker} onChange={(item) => setRows((current) => current.map((existing, index) => index === i ? { ...existing, ...item } : existing))} />
            <input aria-label="Ticker" placeholder="Ticker (manual override)" value={row.ticker} onChange={(e) => updateRow(i, "ticker", e.target.value)} className="rounded-lg border border-line px-2 py-2 text-sm" />
            <select aria-label="Sector" value={row.sector} onChange={(e) => updateRow(i, "sector", e.target.value)} className="rounded-lg border border-line px-2 py-2 text-sm">{SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <input aria-label="Quantity" type="number" min="0" placeholder="Quantity" value={row.quantity} onChange={(e) => updateRow(i, "quantity", e.target.value)} className="rounded-lg border border-line px-2 py-2 text-sm" />
            <input aria-label="Average purchase price" type="number" min="0.01" step="any" placeholder="Avg buy price ₹" value={row.avg_buy_price} onChange={(e) => updateRow(i, "avg_buy_price", e.target.value)} className="rounded-lg border border-line px-2 py-2 text-sm" />
            <input aria-label="Current price" type="number" min="0.01" step="any" placeholder="Current price ₹" value={row.current_price} onChange={(e) => updateRow(i, "current_price", e.target.value)} className="rounded-lg border border-line px-2 py-2 text-sm" />
            <input aria-label="Purchase date" type="date" value={row.purchase_date} onChange={(e) => updateRow(i, "purchase_date", e.target.value)} className="rounded-lg border border-line px-2 py-2 text-sm" />
            <button type="button" onClick={() => setRows((current) => current.filter((_, index) => index !== i))} className="text-left text-xs text-red-600 md:col-span-4">Remove row</button>
          </div>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setRows((current) => [...current, blank()])}>Add holding</Button>
          <Button onClick={() => void importRows()} disabled={busy}>{busy ? "Saving…" : "Save portfolio"}</Button>
          <Button variant="ghost" onClick={() => setMode("")}>Back</Button>
        </div>
      </Panel>}
      {status && <p role="status" className="rounded-xl bg-white p-3 text-sm text-slate">{status}</p>}
    </div>
  );
}

