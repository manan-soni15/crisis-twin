"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import { Panel, Readout, Tag, TextLink, Button } from "@/components/ui";
import { DivergingBar } from "@/components/viz/Charts";
import { SHOCKS, inr, pct } from "@/lib/sample";
import PortfolioSetup from "@/components/PortfolioSetup";

const SECTOR_COLORS = ["#1a2fd4", "#4a5de0", "#8c9bf0", "#0e1433", "#1fa98a", "#ff5a2c", "#cbd8ff"];

const FALLBACK_HOLDINGS = [];

const SECTORS_MAP = {
  energy: "Energy",
  airlines: "Airlines",
  banks: "Banks",
  auto: "Autos",
  it: "IT services",
  pharma: "Pharma",
  fmcg: "Consumer",
};

export default function DashboardExperience() {
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [portfolioLoaded, setPortfolioLoaded] = useState(false);
  const [holdings, setHoldings] = useState([]);
  const [latestRun, setLatestRun] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);

  useEffect(() => {
    // 1. Fetch live portfolio
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setPortfolioValue(Number(data.portfolio_value || 0));
          if (Array.isArray(data.holdings)) {
            const mapped = data.holdings.map((h) => ({
              id: h.id,
              name: h.name,
              sector: h.sector,
              weight: Number(h.weight || 0),
              day: Number(h.day || 0),
              impact: h.impact ?? 0,
            }));
            setHoldings(mapped);
          }
        }
      })
      .catch(() => {})
      .finally(() => setPortfolioLoaded(true));

    // 2. Fetch latest runs
    fetch("/api/audit/runs")
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.runs) && d.runs.length > 0) {
          const mappedRuns = d.runs.map((r, i) => ({
            name: r.scenario || "Stress scenario",
            range: r.p05 == null || r.p95 == null ? "Not provided" : `${pct(Number(r.p05))} to ${pct(Number(r.p95))}`,
            score: r.survival_score == null ? null : Number(r.survival_score),
            expected_move: Number(r.expected_move_pct || -3.5),
            confidence: r.confidence || "Medium",
            when: i === 0 ? "Today" : i === 1 ? "Yesterday" : `${i + 1} days ago`,
          }));
          setRecentRuns(mappedRuns.slice(0, 5));
          setLatestRun(mappedRuns[0]);
        }
      })
      .catch(() => {});
  }, []);

  if (!portfolioLoaded) {
    return <><PageHeader title="Overview" description="Loading your portfolio workspace." /><Panel title="Loading">Loading your saved portfolio…</Panel></>;
  }
  if (holdings.length === 0) {
    return <><PageHeader title="Welcome to Crisis Twin" description="Start by importing your own portfolio. No holdings or balances are preloaded." /><PortfolioSetup onImported={() => window.location.reload()} /></>;
  }

  const dayMove = Math.round(holdings.reduce((s, h) => s + (h.weight / 100) * (h.day || 0), 0) * 10) / 10;
  const lastLoss = latestRun?.expected_move;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Your imported portfolio at a glance, and how it responds to stress scenarios."
        actions={<Button href="/simulator" icon="arrow">Run a crisis</Button>}
      />

      <Panel bodyClass="!p-0">
        <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
          <Readout className="p-5" label="Portfolio value" value={inr(portfolioValue)} note={`${holdings.length} holdings`} />
          <Readout className="p-5" label="Today" value={pct(dayMove)} tone={dayMove < 0 ? "loss" : "gain"} note="Before any scenario" />
          <Readout className="p-5" label="Last crisis" value={lastLoss == null ? "—" : pct(lastLoss)} tone="loss" note={latestRun?.name ? latestRun.name.slice(0, 24) : "No saved simulation"} />
          <Readout className="p-5" label="Survival score" value={latestRun?.score == null ? "—" : String(latestRun.score)} tone="ultra" note={latestRun ? "Out of 100" : "Run a simulation first"} />
          <Readout className="p-5" label="Confidence" value={latestRun?.confidence || "—"} note={latestRun ? "Scenario estimate" : "No result yet"} />
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-7" title="Latest stress test" aside={<TextLink href="/simulator">Open</TextLink>}>
          <p className="max-w-[56ch] text-slate">
            {latestRun?.name || "No saved simulation yet"}. {holdings.length ? "These are the holdings that moved most." : "Add your portfolio in Holdings to see portfolio-specific risk analysis."}
          </p>
          <ul className="mt-5 space-y-3.5">
            {[...holdings]
              .sort((a, b) => a.impact - b.impact)
              .slice(0, 5)
              .map((h) => (
                <li key={h.id} className="grid grid-cols-[110px_minmax(0,1fr)_64px] items-center gap-4">
                  <span className="font-medium truncate">{h.name}</span>
                  <DivergingBar value={h.impact} max={14} />
                  <span className={`num text-right font-semibold ${h.impact < 0 ? "text-ember-deep" : "text-mint-deep"}`}>
                    {pct(h.impact)}
                  </span>
                </li>
              ))}
          </ul>
        </Panel>

        <Panel className="lg:col-span-5" title="Where the money sits">
          <div className="flex h-4 overflow-hidden rounded-full" role="img" aria-label="Portfolio weight by sector">
            {holdings.map((h, i) => (
              <div key={h.id} style={{ width: `${h.weight}%`, background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
            ))}
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 text-[0.95rem]">
            {holdings.map((h, i) => (
              <li key={h.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                  {SECTORS_MAP[h.sector] || h.sector}
                </span>
                <span className="num text-slate">{h.weight}%</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-7" title="Recent runs" aside={<TextLink href="/audit">Audit trail</TextLink>} bodyClass="!px-0 !pb-2">
          <div className="scroll-x">
            <table className="w-full min-w-[520px] text-left text-[0.95rem]">
              <thead className="text-sm text-slate">
                <tr className="border-b border-line">
                  <th className="px-5 py-2 font-medium">Scenario</th>
                  <th className="py-2 font-medium">Loss range</th>
                  <th className="py-2 font-medium">Score</th>
                  <th className="px-5 py-2 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.length ? recentRuns.map((r) => (
                  <tr key={r.name + r.when} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-3 font-medium truncate max-w-[200px]">{r.name}</td>
                    <td className="num py-3 text-ember-deep">{r.range}</td>
                    <td className="num py-3">{r.score == null ? "N/A" : r.score}</td>
                    <td className="px-5 py-3 text-right text-slate">{r.when}</td>
                  </tr>
                )) : <tr><td colSpan={4} className="px-5 py-6 text-sm text-slate">No saved simulations yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="lg:col-span-5" tone="ink" title="Start from a shock">
          <ul className="divide-y divide-white/10">
            {SHOCKS.map((s) => (
              <li key={s.id}>
                <Link href="/simulator" className="group flex items-center justify-between py-3 text-white">
                  <span className="head text-[1.15rem]">{s.name}</span>
                  <Tag tone="neutral">{s.label}</Tag>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <NextSteps href="/dashboard" />
    </>
  );
}

