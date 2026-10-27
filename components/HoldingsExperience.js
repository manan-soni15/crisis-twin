"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import Segmented from "@/components/Segmented";
import { Panel, Button, Tag } from "@/components/ui";
import { DivergingBar } from "@/components/viz/Charts";
import { SECTORS, inr, pct, holdingImpact } from "@/lib/sample";
import { getPortfolio, submitPaperTrade } from "@/lib/api";

const stress = (h) => Math.round((holdingImpact("oil", h) + holdingImpact("rates", h)) * 10) / 10;

export default function HoldingsExperience() {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState("Buy");
  const [selectedHoldingId, setSelectedHoldingId] = useState("reliance");
  const [quantity, setQuantity] = useState(10);
  const [orderType, setOrderType] = useState("Market");
  const [tradeStatus, setTradeStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function reloadPortfolio() {
    setLoading(true);
    try {
      const data = await getPortfolio();
      if (data) {
        setPortfolio(data);
        if (data.holdings?.length > 0 && !selectedHoldingId) {
          setSelectedHoldingId(data.holdings[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load portfolio:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    getPortfolio().then((data) => {
      if (!ignore && data) {
        setPortfolio(data);
        setLoading(false);
      }
    }).catch((e) => {
      console.error(e);
      if (!ignore) setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const holdings = portfolio?.holdings || [];
  const totalValue = portfolio?.portfolio_value || 4820500;
  const cashBalance = portfolio?.cash_balance || 750000;
  const isLive = portfolio?.is_live ?? false;

  const top3 = [...holdings].sort((a, b) => b.weight - a.weight).slice(0, 3);
  const selectedHolding = holdings.find((h) => h.id === selectedHoldingId) || holdings[0];
  const estPrice = selectedHolding?.current_price || 2500;
  const estTotal = quantity > 0 ? quantity * estPrice : 0;

  async function handleTradeSubmit(e) {
    e.preventDefault();
    if (!selectedHoldingId || quantity <= 0) return;

    setIsSubmitting(true);
    setTradeStatus(null);

    try {
      const res = await submitPaperTrade({
        holding_id: selectedHoldingId,
        side: side.toLowerCase(),
        quantity: parseInt(quantity, 10),
        price: estPrice,
        confirmed: true,
      });

      if (res && res.success) {
        setTradeStatus({ type: "success", message: res.message });
        // Reload portfolio to update weights and shares on table
        await reloadPortfolio();
      } else {
        setTradeStatus({ type: "error", message: res?.detail || "Order could not be executed." });
      }
    } catch (err) {
      setTradeStatus({ type: "error", message: err.message || "Failed to submit trade." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Holdings"
        description="What the portfolio owns, real-time stress reaction, and an interactive paper trading ticket."
        actions={
          <div className="flex items-center gap-3">
            <Tag tone={isLive ? "gain" : "neutral"}>
              {isLive ? "Live API Connected" : "Local Mock Mode"}
            </Tag>
            <Button variant="ghost" onClick={reloadPortfolio} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh Prices"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-8" bodyClass="!px-0 !pb-2 !pt-1">
          <div className="scroll-x">
            <table className="w-full min-w-[680px] text-left text-[0.95rem]">
              <thead className="text-sm text-slate">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-medium">Holding</th>
                  <th className="py-3 font-medium">Weight</th>
                  <th className="py-3 text-right font-medium">Shares</th>
                  <th className="py-3 text-right font-medium">Price</th>
                  <th className="py-3 text-right font-medium">Value</th>
                  <th className="py-3 text-right font-medium">Today</th>
                  <th className="w-[150px] px-5 py-3 font-medium">Under shock</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const secObj = SECTORS.find((s) => s.id === h.sector);
                  return (
                    <tr key={h.id} className="border-b border-line/70 last:border-0 hover:bg-mist/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold">{h.name}</div>
                        <div className="text-sm text-slate">{secObj ? secObj.label : h.sector}</div>
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-mist">
                            <div className="h-full rounded-full bg-ultra" style={{ width: `${Math.min(100, h.weight * 4)}%` }} />
                          </div>
                          <span className="num w-9 text-xs text-slate">{h.weight}%</span>
                        </div>
                      </td>
                      <td className="num py-3.5 text-right font-mono text-xs">{h.quantity.toLocaleString("en-IN")}</td>
                      <td className="num py-3.5 text-right font-medium">{inr(h.current_price || 0)}</td>
                      <td className="num py-3.5 text-right font-semibold">{inr(h.value || (totalValue * h.weight) / 100)}</td>
                      <td className={`num py-3.5 text-right font-semibold ${h.day < 0 ? "text-ember-deep" : "text-mint-deep"}`}>
                        {pct(h.day)}
                      </td>
                      <td className="px-5 py-3.5">
                        <DivergingBar value={stress(h)} max={12} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5 lg:col-span-4">
          <Panel title="Paper trade" aside={<Tag tone="gain">Simulated</Tag>}>
            <form onSubmit={handleTradeSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate uppercase tracking-wider">Side</label>
                <div className="flex rounded-lg border border-line p-1 bg-bone">
                  {["Buy", "Sell"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSide(s)}
                      className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-all ${
                        side === s ? "bg-ultra text-white shadow-sm" : "text-slate hover:text-ink"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="sym" className="mb-1.5 block text-sm text-slate">Holding</label>
                <select
                  id="sym"
                  value={selectedHoldingId}
                  onChange={(e) => setSelectedHoldingId(e.target.value)}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium focus:border-ultra focus:outline-none"
                >
                  {holdings.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({inr(h.current_price || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="qty" className="mb-1.5 block text-sm text-slate">Quantity</label>
                  <input
                    id="qty"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    className="num w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium focus:border-ultra focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="ot" className="mb-1.5 block text-sm text-slate">Order</label>
                  <select
                    id="ot"
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium focus:border-ultra focus:outline-none"
                  >
                    <option>Market</option>
                    <option>Limit</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg bg-mist/50 p-3 text-xs space-y-1">
                <div className="flex justify-between text-slate">
                  <span>Estimated Total</span>
                  <span className="font-semibold text-ink">{inr(estTotal)}</span>
                </div>
                <div className="flex justify-between text-slate">
                  <span>Available Cash</span>
                  <span className="font-semibold text-ink">{inr(cashBalance)}</span>
                </div>
              </div>

              {tradeStatus && (
                <div
                  className={`rounded-lg p-3 text-xs ${
                    tradeStatus.type === "success"
                      ? "bg-mint-soft text-mint-deep border border-mint/40"
                      : "bg-ember-soft text-ember-deep border border-ember/40"
                  }`}
                >
                  {tradeStatus.message}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Executing Order..." : `Place Paper ${side}`}
              </Button>

              <p className="text-xs text-slate leading-relaxed">
                No real money moves. Confirmed simulated orders are immediately logged to the audit trail.
              </p>
            </form>
          </Panel>

          <Panel title="Concentration" tone="flat">
            <p className="text-[0.95rem] text-slate leading-relaxed">
              Your three largest holdings are{" "}
              <span className="font-medium text-ink">
                {top3.map((h) => h.name).join(", ")}
              </span>
              , together representing{" "}
              <span className="font-semibold text-ultra">
                {top3.reduce((s, h) => s + h.weight, 0).toFixed(1)}%
              </span>{" "}
              of the portfolio equity.
            </p>
          </Panel>
        </div>
      </div>

      <NextSteps href="/holdings" />
    </>
  );
}
