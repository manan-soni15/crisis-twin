"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import { Panel, Tag } from "@/components/ui";
import { pct, inr } from "@/lib/sample";

export default function Page() {
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/audit/runs?limit=1")
      .then((response) => response.json())
      .then((data) => setRun(Array.isArray(data.runs) ? data.runs[0] || null : null))
      .catch(() => setRun(null))
      .finally(() => setLoading(false));
  }, []);

  const holdings = Array.isArray(run?.per_holding) ? [...run.per_holding].sort((a, b) => Number(a.impact_pct || 0) - Number(b.impact_pct || 0)) : [];
  return <>
    <PageHeader title="Why it moved" description="Inspect the drivers from your latest saved stress simulation. This page does not invent daily market attribution when verified market data is unavailable." />
    <Panel title="Latest saved simulation" aside={run ? <Tag>{run.confidence || "Unrated"} confidence</Tag> : null}>
      {loading ? <p className="text-sm text-slate">Loading saved simulation…</p> : !run ? <div className="py-4"><p className="font-semibold">No saved simulation yet</p><p className="mt-1 text-sm text-slate">Add your holdings, run a stress test, and save the result. Its holding-level impacts will appear here.</p></div> : <>
        <h2 className="head text-xl">{run.scenario || "Stress scenario"}</h2>
        <p className="mt-2 text-sm text-slate">Scenario estimate: <strong>{run.expected_move_pct == null ? "Not available" : pct(Number(run.expected_move_pct))}</strong>. These are simulated impacts, not observed daily returns.</p>
        {holdings.length ? <div className="mt-5 divide-y divide-line">
          {holdings.map((holding) => <div key={holding.id || holding.ticker || holding.name} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><p className="font-medium">{holding.name || holding.ticker || "Holding"}</p><p className="text-xs text-slate">Current value {holding.current_value == null ? "not provided" : inr(Number(holding.current_value))}</p></div>
            <div className={`num font-semibold ${Number(holding.impact_pct) < 0 ? "text-ember-deep" : "text-mint-deep"}`}>{holding.impact_pct == null ? "N/A" : pct(Number(holding.impact_pct))}</div>
          </div>)}
        </div> : <p className="mt-4 text-sm text-slate">The saved run did not include holding-level impact data.</p>}
      </>}
    </Panel>
    <NextSteps href="/why" />
  </>;
}
