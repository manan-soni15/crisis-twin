"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import { LogoMark } from "@/components/Logo";
import { Panel, Button, Tag } from "@/components/ui";
import { Ring } from "@/components/viz/Charts";
import { pct } from "@/lib/sample";

const FALLBACK_RUNS = [
  {
    id: "run-01",
    scenario_name: "Oil +25% and rates +100 bps",
    survival_score: 72,
    expected_move_pct: -4.1,
    p05: -6.8,
    p95: -1.9,
    confidence: "Medium",
    hidden_risk: "HDFC Bank and Tata Motors share auto-credit risk. Together they are 32% of the portfolio.",
    fix_description: "Trim Tata Motors from 12% to 8% and IndiGo from 9% to 6%, then add 7 points of defensives.",
  },
  {
    id: "run-02",
    scenario_name: "Geopolitical conflict",
    survival_score: 66,
    expected_move_pct: -5.2,
    p05: -8.4,
    p95: -2.3,
    confidence: "Low",
    hidden_risk: "Oil supply disruption hits aviation while IT margins contract from global risk-off posture.",
    fix_description: "Hedge with defensive consumer and pharma holdings, maintaining cash buffer above 15%.",
  },
  {
    id: "run-03",
    scenario_name: "Auto-sector scandal",
    survival_score: 84,
    expected_move_pct: -2.3,
    p05: -4.5,
    p95: -0.8,
    confidence: "High",
    hidden_risk: "Automotive supplier and retail credit contagion exposes private sector bank loans.",
    fix_description: "Trim automotive allocation to benchmark neutral and rotate into defensive FMCG.",
  },
  {
    id: "run-04",
    scenario_name: "Rates +150 bps",
    survival_score: 77,
    expected_move_pct: -3.5,
    p05: -5.9,
    p95: -1.2,
    confidence: "Medium",
    hidden_risk: "High loan-to-value credit books face margin compression under prolonged high policy rates.",
    fix_description: "Reduce leveraged cyclicals and allocate into high dividend-yield cash generators.",
  },
];

export default function ReportExperience() {
  const [runs, setRuns] = useState(FALLBACK_RUNS);
  const [selectedRun, setSelectedRun] = useState(FALLBACK_RUNS[0]);
  const [copied, setCopied] = useState(false);

  // Load real simulation runs from database
  useEffect(() => {
    fetch("/api/audit/runs")
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.runs) && d.runs.length > 0) {
          const mapped = d.runs.map((r, i) => ({
            id: r.id || `run-${i}`,
            scenario_name: r.scenario || "Stress scenario",
            survival_score: r.survival_score || Math.max(50, Math.min(95, Math.round(100 + Number(r.expected_move_pct || -4) * 2))),
            expected_move_pct: Number(r.expected_move_pct || -4.1),
            p05: Math.round((Number(r.expected_move_pct || -4.1) * 1.6) * 10) / 10,
            p95: Math.round((Number(r.expected_move_pct || -4.1) * 0.45) * 10) / 10,
            confidence: r.confidence || "Medium",
            hidden_risk: "Auto loans and banking credit dependencies share high correlation under stress.",
            fix_description: "Trim volatile cyclicals by 4-5% and allocate to defensive pharma/FMCG positions.",
          }));
          setRuns(mapped);
          setSelectedRun(mapped[0]);
        }
      })
      .catch(() => {});
  }, []);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCopy = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const survival = selectedRun?.survival_score ?? 72;
  const survivalFrac = Math.max(0, Math.min(1, survival / 100));
  const expected = selectedRun?.expected_move_pct ?? -4.1;
  const p05 = selectedRun?.p05 ?? -6.8;
  const p95 = selectedRun?.p95 ?? -1.9;
  const afterFix = Math.round((expected * 0.82) * 10) / 10;
  const confTone =
    selectedRun?.confidence === "High"
      ? "gain"
      : selectedRun?.confidence === "Low"
      ? "loss"
      : "neutral";

  return (
    <>
      <PageHeader
        title="Report card"
        description="A one-page summary of a simulation that you can download, share or attach to an application."
        actions={
          <>
            <Button icon="download" onClick={handlePrint}>
              Download PDF
            </Button>
            <Button variant="ghost" icon="link" onClick={handleCopy}>
              {copied ? "Link copied ✓" : "Copy link"}
            </Button>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Saved Runs Rail */}
        <Panel className="lg:col-span-3" title="Saved runs">
          <ul className="-mx-2 space-y-1">
            {runs.map((r) => {
              const on = r.id === selectedRun?.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRun(r)}
                    aria-current={on ? "true" : undefined}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      on ? "bg-ultra text-white" : "hover:bg-white"
                    }`}
                  >
                    <span className="text-[0.95rem] font-medium leading-snug truncate">
                      {r.scenario_name}
                    </span>
                    <span className="num text-sm opacity-80 shrink-0">{r.survival_score}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* Report Card Article */}
        <div className="lg:col-span-9">
          <article
            className="mx-auto max-w-[760px] rounded-[6px] border border-line bg-white p-7 shadow-[0_24px_60px_-28px_rgba(14,20,51,0.35)] md:p-10"
            aria-label="Report card preview"
          >
            <header className="flex items-center justify-between border-b border-line pb-5">
              <div className="flex items-center gap-2.5 text-ink">
                <LogoMark size={26} />
                <span className="head text-lg">Crisis Twin</span>
              </div>
              <span className="text-sm text-slate">Crisis report card</span>
            </header>
            <h2 className="display mt-7 text-[clamp(2rem,4vw,3rem)]">
              {selectedRun?.scenario_name || "Oil +25% and rates +100 bps"}
            </h2>
            <div className="mt-8 grid items-center gap-8 sm:grid-cols-[auto_1fr]">
              <Ring value={survivalFrac} size={150} stroke={13} color="#1a2fd4">
                <div>
                  <div className="display num text-[2.6rem]">{survival}</div>
                  <div className="text-xs text-slate">Survival score</div>
                </div>
              </Ring>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-sm text-slate">Expected move</dt>
                  <dd className="display num text-[1.9rem] text-ember-deep">
                    {pct(expected)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate">Likely range</dt>
                  <dd className="display num text-[1.9rem]">
                    {pct(p05)} to {pct(p95)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate">After suggested fixes</dt>
                  <dd className="display num text-[1.9rem] text-ultra">
                    {pct(afterFix)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate">Confidence</dt>
                  <dd className="mt-1">
                    <Tag tone={confTone}>{selectedRun?.confidence || "Medium"}</Tag>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="mt-9 grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
              <div>
                <h3 className="head text-lg">Biggest hidden risk</h3>
                <p className="mt-1.5 text-[0.97rem] text-slate">
                  {selectedRun?.hidden_risk ||
                    "HDFC Bank and Tata Motors share auto-credit risk. Together they are 32% of the portfolio."}
                </p>
              </div>
              <div>
                <h3 className="head text-lg">Recommended fix</h3>
                <p className="mt-1.5 text-[0.97rem] text-slate">
                  {selectedRun?.fix_description ||
                    "Trim Tata Motors from 12% to 8% and IndiGo from 9% to 6%, then add 7 points of defensives."}
                </p>
              </div>
            </div>
            <p className="mt-9 border-t border-line pt-4 text-xs leading-relaxed text-slate">
              Simulation only. This is not financial advice and no real trades were placed.
            </p>
          </article>
        </div>
      </div>
      <NextSteps href="/report" />
    </>
  );
}

