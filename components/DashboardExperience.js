"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import { Panel, Readout, Tag, TextLink, Button } from "@/components/ui";
import { DivergingBar } from "@/components/viz/Charts";
import { SHOCKS, inr, pct } from "@/lib/sample";

const SECTOR_COLORS = ["#1a2fd4", "#4a5de0", "#8c9bf0", "#0e1433", "#1fa98a", "#ff5a2c", "#cbd8ff"];

const FALLBACK_HOLDINGS = [
  { id: "reliance", name: "Reliance Industries", sector: "energy", weight: 15.6, day: 0.4, impact: 3.4 },
  { id: "indigo", name: "InterGlobe Aviation", sector: "airlines", weight: 7.7, day: -1.6, impact: -12.4 },
  { id: "hdfc", name: "HDFC Bank", sector: "banks", weight: 17.2, day: -0.5, impact: -5.2 },
  { id: "tata", name: "Tata Motors", sector: "auto", weight: 10.4, day: -0.9, impact: -10.2 },
  { id: "infy", name: "Infosys", sector: "it", weight: 14.8, day: 0.2, impact: -1.8 },
  { id: "sun", name: "Sun Pharma", sector: "pharma", weight: 8.7, day: 0.7, impact: 0.1 },
  { id: "itc", name: "ITC", sector: "fmcg", weight: 12.2, day: 0.1, impact: -2.0 },
];

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
  const [portfolioValue, setPortfolioValue] = useState(5559240);
  const [holdings, setHoldings] = useState(FALLBACK_HOLDINGS);
  const [latestRun, setLatestRun] = useState({
    name: "Oil +25% and rates +100 bps",
    range: "−6.4% to −0.9%",
    expected_move: -3.5,
    score: 93,
    confidence: "Medium",
    when: "Today",
  });
  const [recentRuns, setRecentRuns] = useState([
    { name: "Oil +25% and rates +100 bps", range: "−6.4% to −0.9%", score: 93, when: "Today" },
    { name: "Geopolitical conflict", range: "−7.9% to −2.6%", score: 66, when: "Yesterday" },
    { name: "Auto-sector scandal", range: "−3.4% to −0.9%", score: 84, when: "3 days ago" },
    { name: "Rates +150 bps", range: "−5.2% to −1.7%", score: 77, when: "Last week" },
  ]);

  useEffect(() => {
    // 1. Fetch live portfolio
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.portfolio_value) {
          setPortfolioValue(data.portfolio_value);
          if (Array.isArray(data.holdings) && data.holdings.length > 0) {
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
      .catch(() => {});

    // 2. Fetch latest runs
    fetch("/api/audit/runs")
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.runs) && d.runs.length > 0) {
          const mappedRuns = d.runs.map((r, i) => ({
            name: r.scenario || "Stress scenario",
            range: `${pct(r.expected_move_pct * 1.6)} to ${pct(r.expected_move_pct * 0.45)}`,
            score: r.survival_score || Math.max(50, Math.min(95, Math.round(100 + Number(r.expected_move_pct || -4) * 2))),
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

  const dayMove = Math.round(holdings.reduce((s, h) => s + (h.weight / 100) * (h.day || 0), 0) * 10) / 10;
  const lastLoss = latestRun.expected_move;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Your sample portfolio at a glance, and how it held up in the last stress test."
        actions={<Button href="/simulator" icon="arrow">Run a crisis</Button>}
      />

      <Panel bodyClass="!p-0">
        <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
          <Readout className="p-5" label="Portfolio value" value={inr(portfolioValue)} note={`${holdings.length} holdings`} />
          <Readout className="p-5" label="Today" value={pct(dayMove)} tone={dayMove < 0 ? "loss" : "gain"} note="Before any scenario" />
          <Readout className="p-5" label="Last crisis" value={pct(lastLoss)} tone="loss" note={latestRun.name.slice(0, 24)} />
          <Readout className="p-5" label="Survival score" value={String(latestRun.score)} tone="ultra" note="Out of 100" />
          <Readout className="p-5" label="Confidence" value={latestRun.confidence} note="Inside fitted range" />
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-7" title="Latest stress test" aside={<TextLink href="/simulator">Open</TextLink>}>
          <p className="max-w-[56ch] text-slate">
            {latestRun.name}. These are the holdings that moved most.
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
                {recentRuns.map((r, idx) => (
                  <tr key={idx} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-3 font-medium truncate max-w-[200px]">{r.name}</td>
                    <td className="num py-3 text-ember-deep">{r.range}</td>
                    <td className="num py-3">{r.score}</td>
                    <td className="px-5 py-3 text-right text-slate">{r.when}</td>
                  </tr>
                ))}
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

