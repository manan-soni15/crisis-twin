"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import { Panel, Button, Tag } from "@/components/ui";
import { DivergingBar } from "@/components/viz/Charts";
import PortfolioSetup from "@/components/PortfolioSetup";
import { SECTORS, inr, pct, holdingImpact } from "@/lib/sample";
import {
  getPortfolio,
  submitPaperTrade,
  getPaperOrders,
  cancelPaperOrder,
  processPendingOrders,
  refreshPortfolioPrices,
} from "@/lib/api";

const stress = (h) => Math.round((holdingImpact("oil", h) + holdingImpact("rates", h)) * 10) / 10;

export default function HoldingsExperience() {
  const [portfolio, setPortfolio] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [side, setSide] = useState("Buy");
  const [selectedHoldingId, setSelectedHoldingId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [orderType, setOrderType] = useState("Market");
  const [customLimitPrice, setCustomLimitPrice] = useState("");
  const [tradeStatus, setTradeStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function reloadPortfolio() {
    setLoading(true);
    try {
      const [portData, ordersData] = await Promise.all([
        getPortfolio(),
        getPaperOrders(),
      ]);
      if (portData) {
        setPortfolio(portData);
        if (portData.holdings?.length > 0 && !selectedHoldingId) {
          setSelectedHoldingId(portData.holdings[0].id);
        }
      }
      if (Array.isArray(ordersData)) {
        setOrders(ordersData);
      }
    } catch (e) {
      console.error("Failed to load portfolio:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    Promise.all([getPortfolio(), getPaperOrders()])
      .then(([portData, ordersData]) => {
        if (!ignore) {
          if (portData) setPortfolio(portData);
          if (Array.isArray(ordersData)) setOrders(ordersData);
          setLoading(false);
        }
      })
      .catch((e) => {
        console.error(e);
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const holdings = portfolio?.holdings || [];
  const totalValue = portfolio?.portfolio_value || 0;
  const cashBalance = portfolio?.cash_balance ?? 0;
  const reservedCash = portfolio?.reserved_cash ?? 0;
  const availableCash = portfolio?.available_cash ?? Math.max(0, cashBalance - reservedCash);
  const isLive = portfolio?.is_live ?? false;

  if (loading) {
    return <><PageHeader title="Holdings" description="Set up your portfolio to begin." /><Panel title="Loading portfolio">Loading your saved portfolio…</Panel></>;
  }
  if (holdings.length === 0) {
    return <><PageHeader title="Holdings" description="Your portfolio is empty until you add or import your own holdings." /><PortfolioSetup onImported={reloadPortfolio} /></>;
  }

  const top3 = [...holdings].sort((a, b) => b.weight - a.weight).slice(0, 3);
  const selectedHolding = holdings.find((h) => h.id === selectedHoldingId) || holdings[0];
  const currentMarketPrice = selectedHolding?.current_price || 0;

  const effectivePrice =
    orderType === "Limit"
      ? (customLimitPrice !== "" && !isNaN(parseFloat(customLimitPrice))
          ? parseFloat(customLimitPrice)
          : currentMarketPrice)
      : currentMarketPrice;

  const estTotal = quantity > 0 ? quantity * effectivePrice : 0;

  function handleHoldingSelect(e) {
    const newId = e.target.value;
    setSelectedHoldingId(newId);
    const target = holdings.find((h) => h.id === newId);
    if (target?.current_price) {
      setCustomLimitPrice(target.current_price.toString());
    }
  }

  // Projected execution status
  const projectedStatus = (() => {
    if (orderType === "Market") {
      return {
        label: "Immediate execution",
        tone: "gain",
        desc: `Executes immediately at current market price (₹${inr(currentMarketPrice)}).`,
      };
    }
    const lim = parseFloat(customLimitPrice) || 0;
    if (lim <= 0) {
      return {
        label: "Specify limit price",
        tone: "neutral",
        desc: "Please enter a valid limit price greater than ₹0.",
      };
    }
    if (side === "Buy") {
      if (currentMarketPrice <= lim) {
        return {
          label: "Immediate execution eligible",
          tone: "gain",
          desc: `Market (₹${inr(currentMarketPrice)}) ≤ Limit (₹${inr(lim)}). Will execute immediately upon placement.`,
        };
      } else {
        return {
          label: "Will be PENDING",
          tone: "neutral",
          desc: `Market (₹${inr(currentMarketPrice)}) > Limit (₹${inr(lim)}). Order will queue as PENDING and await lower price.`,
        };
      }
    } else {
      if (currentMarketPrice >= lim) {
        return {
          label: "Immediate execution eligible",
          tone: "gain",
          desc: `Market (₹${inr(currentMarketPrice)}) ≥ Limit (₹${inr(lim)}). Will execute immediately upon placement.`,
        };
      } else {
        return {
          label: "Will be PENDING",
          tone: "neutral",
          desc: `Market (₹${inr(currentMarketPrice)}) < Limit (₹${inr(lim)}). Order will queue as PENDING and await higher price.`,
        };
      }
    }
  })();

  const pendingOrders = orders.filter((o) => o.status?.toUpperCase() === "PENDING");
  const pastOrders = orders.filter((o) => o.status?.toUpperCase() !== "PENDING");

  async function handleRefreshPrices() {
    setLoading(true);
    try {
      if (isLive) {
        await refreshPortfolioPrices();
      }
      await reloadPortfolio();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleProcessPendingOrders() {
    setIsProcessing(true);
    try {
      const res = await processPendingOrders();
      if (res && res.executed_count > 0) {
        setTradeStatus({
          type: "success",
          message: `${res.executed_count} pending order(s) reached limit price and executed!`,
        });
      } else {
        setTradeStatus({
          type: "pending",
          message: "Checked pending orders: current market prices have not met limit triggers yet.",
        });
      }
      await reloadPortfolio();
    } catch (err) {
      setTradeStatus({ type: "error", message: err.message || "Failed to process orders." });
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleCancelOrder(orderId) {
    setCancellingOrderId(orderId);
    try {
      const res = await cancelPaperOrder(orderId);
      if (res && res.success) {
        setTradeStatus({
          type: "pending",
          message: `Order #${orderId} was cancelled. Reserved cash/shares have been freed.`,
        });
        await reloadPortfolio();
      } else {
        setTradeStatus({
          type: "error",
          message: res?.message || "Failed to cancel order.",
        });
      }
    } catch (err) {
      setTradeStatus({ type: "error", message: err.message || "Failed to cancel order." });
    } finally {
      setCancellingOrderId(null);
    }
  }

  async function handleTradeSubmit(e) {
    e.preventDefault();
    if (!selectedHoldingId || quantity <= 0) return;

    setIsSubmitting(true);
    setTradeStatus(null);

    try {
      const payload = {
        holding_id: selectedHoldingId,
        side: side.toLowerCase(),
        quantity: parseInt(quantity, 10),
        order_type: orderType.toLowerCase(),
        confirmed: true,
      };

      if (orderType === "Limit") {
        const lim = parseFloat(customLimitPrice);
        payload.limit_price = lim;
        payload.price = lim;
      } else {
        payload.price = currentMarketPrice;
      }

      const res = await submitPaperTrade(payload);

      if (res && res.success) {
        if (res.status === "PENDING") {
          setTradeStatus({
            type: "pending",
            message: res.message || "Limit order placed and awaiting execution.",
          });
        } else {
          setTradeStatus({
            type: "success",
            message: res.message || `Limit order executed at ${inr(res.executed_price || res.price)}.`,
          });
        }
        await reloadPortfolio();
      } else {
        setTradeStatus({
          type: "error",
          message: res?.message || res?.detail || "Order could not be executed.",
        });
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
              {isLive ? "Live Market Data" : "Manual / Imported Prices"}
            </Tag>
            <Button variant="ghost" onClick={handleRefreshPrices} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh Prices"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {/* Holdings Table */}
          <Panel bodyClass="!px-0 !pb-2 !pt-1">
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
                        <td className="num py-3.5 text-right font-mono text-xs">
                          <div>{h.quantity.toLocaleString("en-IN")}</div>
                          {h.reserved_quantity > 0 && (
                            <div className="text-[10px] text-slate font-sans">
                              {h.reserved_quantity} reserved
                            </div>
                          )}
                        </td>
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

          {/* Pending Limit Orders Section */}
          <Panel
            title="Pending Limit Orders"
            aside={
              <div className="flex items-center gap-2">
                <Tag tone={pendingOrders.length > 0 ? "ultra" : "neutral"}>
                  {pendingOrders.length} Pending
                </Tag>
                {pendingOrders.length > 0 && (
                  <Button
                    variant="ghost"
                    className="!px-3 !py-1 text-xs"
                    onClick={handleProcessPendingOrders}
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Checking..." : "Check & Execute"}
                  </Button>
                )}
              </div>
            }
            bodyClass="!px-0 !pb-2 !pt-1"
          >
            <div className="px-5 py-2.5 text-xs text-slate border-b border-line bg-mist/30 flex items-center justify-between">
              <span>
                Pending limit orders are saved in the database and execute when market prices reach your limit condition.
              </span>
              {pastOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="font-medium text-ultra hover:underline ml-2 whitespace-nowrap"
                >
                  {showHistory ? "Hide order history" : `View past trades (${pastOrders.length})`}
                </button>
              )}
            </div>

            {pendingOrders.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate">
                No pending orders awaiting execution. Limit orders that cannot immediately fill at current market price are queued here.
              </div>
            ) : (
              <div className="scroll-x">
                <table className="w-full min-w-[640px] text-left text-[0.9rem]">
                  <thead className="text-xs text-slate border-b border-line">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Order</th>
                      <th className="py-2.5 font-medium">Side</th>
                      <th className="py-2.5 text-right font-medium">Shares</th>
                      <th className="py-2.5 text-right font-medium">Limit</th>
                      <th className="py-2.5 text-right font-medium">Market</th>
                      <th className="py-2.5 text-right font-medium">Committed</th>
                      <th className="py-2.5 text-center font-medium">Condition</th>
                      <th className="px-5 py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrders.map((o) => {
                      const isBuy = o.side.toLowerCase() === "buy";
                      const canExecuteNow =
                        o.market_price != null &&
                        (isBuy ? o.market_price <= o.limit_price : o.market_price >= o.limit_price);
                      return (
                        <tr key={o.id} className="border-b border-line/70 last:border-0 hover:bg-mist/30 transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-semibold text-ink">{o.holding_name || o.ticker}</div>
                            <div className="text-xs text-slate font-mono">{o.ticker}</div>
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                isBuy ? "bg-mint-soft text-mint-deep" : "bg-ember-soft text-ember-deep"
                              }`}
                            >
                              {o.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="num py-3 text-right font-mono text-xs">{o.quantity.toLocaleString("en-IN")}</td>
                          <td className="num py-3 text-right font-medium">{inr(o.limit_price || o.price)}</td>
                          <td className="num py-3 text-right font-medium text-slate">
                            {o.market_price ? inr(o.market_price) : "—"}
                          </td>
                          <td className="num py-3 text-right font-semibold">{inr(o.total_val)}</td>
                          <td className="py-3 text-center">
                            <Tag tone={canExecuteNow ? "gain" : "neutral"}>
                              {canExecuteNow
                                ? "Eligible"
                                : isBuy
                                ? `≤ ${inr(o.limit_price)}`
                                : `≥ ${inr(o.limit_price)}`}
                            </Tag>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleCancelOrder(o.id)}
                              disabled={cancellingOrderId === o.id}
                              className="text-xs font-medium text-ember-deep hover:underline disabled:opacity-50"
                            >
                              {cancellingOrderId === o.id ? "Cancelling..." : "Cancel"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Optional Past Orders Audit View */}
            {showHistory && pastOrders.length > 0 && (
              <div className="border-t border-line mt-2">
                <div className="px-5 py-2 text-xs font-semibold text-slate uppercase tracking-wider bg-mist/40">
                  Past Executed / Cancelled Orders
                </div>
                <div className="scroll-x">
                  <table className="w-full min-w-[640px] text-left text-[0.85rem]">
                    <thead className="text-xs text-slate border-b border-line">
                      <tr>
                        <th className="px-5 py-2 font-medium">Holding</th>
                        <th className="py-2 font-medium">Side / Type</th>
                        <th className="py-2 text-right font-medium">Shares</th>
                        <th className="py-2 text-right font-medium">Price</th>
                        <th className="py-2 text-right font-medium">Total</th>
                        <th className="px-5 py-2 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastOrders.slice(0, 5).map((po) => (
                        <tr key={po.id} className="border-b border-line/50 last:border-0 hover:bg-mist/20">
                          <td className="px-5 py-2 font-medium">{po.holding_name || po.ticker}</td>
                          <td className="py-2 capitalize text-slate">
                            {po.side} • {po.order_type}
                          </td>
                          <td className="num py-2 text-right">{po.quantity}</td>
                          <td className="num py-2 text-right">{inr(po.executed_price || po.price)}</td>
                          <td className="num py-2 text-right font-medium">{inr(po.total_val)}</td>
                          <td className="px-5 py-2 text-center">
                            <Tag tone={po.status === "EXECUTED" ? "gain" : "loss"}>
                              {po.status}
                            </Tag>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Panel>
        </div>

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
                  onChange={handleHoldingSelect}
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

              {orderType === "Limit" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="lprice" className="text-sm font-medium text-ink">Limit Price (₹)</label>
                    <span className="text-xs text-slate">Market: {inr(currentMarketPrice)}</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate font-medium text-sm">₹</span>
                    <input
                      id="lprice"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={customLimitPrice !== "" ? customLimitPrice : (selectedHolding?.current_price?.toString() || "")}
                      onChange={(e) => setCustomLimitPrice(e.target.value)}
                      placeholder={currentMarketPrice?.toString() || "0"}
                      className="num w-full rounded-lg border border-line bg-white pl-7 pr-3 py-2.5 text-sm font-medium focus:border-ultra focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Order Summary */}
              <div className="rounded-lg bg-mist/60 border border-line p-3 text-xs space-y-2">
                <div className="flex justify-between items-center text-slate">
                  <span>Order Type</span>
                  <span className="font-semibold text-ink">
                    {orderType === "Limit" ? `Limit @ ${inr(effectivePrice)}` : "Market Order"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate">
                  <span>Market Reference</span>
                  <span className="font-mono text-ink">{inr(currentMarketPrice)}</span>
                </div>

                <div className="flex justify-between items-center text-slate">
                  <span>Quantity</span>
                  <span className="font-medium text-ink">{quantity.toLocaleString("en-IN")} shares</span>
                </div>

                <div className="flex justify-between items-center text-slate border-t border-line/60 pt-1.5">
                  <div>
                    <span className="block font-medium">Estimated Total</span>
                    <span className="text-[10px] text-slate/80">Est. value; actual price may vary</span>
                  </div>
                  <span className="font-semibold text-ink text-sm">{inr(estTotal)}</span>
                </div>

                <div className="flex justify-between items-center text-slate border-t border-line/60 pt-1.5">
                  <div>
                    <span>Available Cash</span>
                    {reservedCash > 0 && (
                      <span className="block text-[10px] text-slate/75">
                        ({inr(reservedCash)} reserved for pending)
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-ink">{inr(availableCash)}</span>
                </div>

                {/* Execution status projection */}
                <div className="border-t border-line/60 pt-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate">Execution Status:</span>
                    <Tag tone={projectedStatus.tone}>{projectedStatus.label}</Tag>
                  </div>
                  <p className="text-[11px] text-slate leading-tight">{projectedStatus.desc}</p>
                </div>
              </div>

              {/* Trade Feedback Alert */}
              {tradeStatus && (
                <div
                  className={`rounded-lg p-3 text-xs flex items-start gap-2.5 ${
                    tradeStatus.type === "success"
                      ? "bg-mint-soft text-mint-deep border border-mint/40"
                      : tradeStatus.type === "pending"
                      ? "bg-mist text-ink border border-line"
                      : "bg-ember-soft text-ember-deep border border-ember/40"
                  }`}
                >
                  <div className="pt-0.5">
                    {tradeStatus.type === "success" && <Tag tone="gain">Executed</Tag>}
                    {tradeStatus.type === "pending" && <Tag tone="neutral">Pending</Tag>}
                    {tradeStatus.type === "error" && <Tag tone="loss">Rejected</Tag>}
                  </div>
                  <div className="flex-1 leading-snug font-medium">{tradeStatus.message}</div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting
                  ? "Placing Order..."
                  : orderType === "Limit"
                  ? `Place Paper ${side} (Limit @ ${inr(effectivePrice)})`
                  : `Place Paper ${side} (Market @ ${inr(currentMarketPrice)})`}
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
