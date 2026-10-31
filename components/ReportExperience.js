"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import { LogoMark } from "@/components/Logo";
import { Panel, Button, Tag } from "@/components/ui";
import { Ring } from "@/components/viz/Charts";
import { pct } from "@/lib/sample";

export default function ReportExperience() {
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function deleteRun(runId) {
    if (typeof window !== "undefined" && !window.confirm("Delete this saved run from Report Card and Audit Trail? This cannot be undone.")) return;
    setDeletingId(runId);
    setActionError("");
    try {
      const response = await fetch(`/api/audit/runs/${encodeURIComponent(runId)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.detail || "Could not delete this saved run.");
      const remaining = runs.filter((run) => run.id !== runId);
      setRuns(remaining);
      if (selectedRun?.id === runId) setSelectedRun(remaining[0] || null);
    } catch (error) {
      setActionError(error.message || "Could not delete this saved run.");
    } finally {
      setDeletingId(null);
    }
  }

  // Load real simulation runs from database
  useEffect(() => {
    fetch("/api/audit/runs")
      .then((r) => r.json())
      .then((d) => {
        const mapped = (Array.isArray(d?.runs) ? d.runs : []).map((r, i) => {
          let saved = {};
          try { saved = typeof r.shocks === "string" ? JSON.parse(r.shocks) : (r.shocks || {}); } catch {}
          return {
            id: r.id || `run-${i}`,
            scenario_name: r.scenario || "Saved analysis",
            survival_score: r.survival_score == null ? null : Number(r.survival_score),
            expected_move_pct: r.expected_move_pct == null ? null : Number(r.expected_move_pct),
            p05: r.p05 == null ? null : Number(r.p05),
            p95: r.p95 == null ? null : Number(r.p95),
            confidence: r.confidence || "Unrated",
            hidden_risk: r.assistant_answer || saved.answer || "No narrative explanation was saved for this run. Review the assumptions and holding-level results in the audit trail.",
            original_question: r.original_question || saved.question || null,
            record_type: r.record_type || "simulation",
            fix_description: r.original_question ? `Original request: ${r.original_question}` : "No remediation plan was recorded for this run.",
          };
        });
        setRuns(mapped);
        setSelectedRun(mapped[0] || null);
      })
      .catch(() => { setRuns([]); setSelectedRun(null); })
      .finally(() => setLoading(false));
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

  const survival = selectedRun?.survival_score;
  const survivalFrac = Math.max(0, Math.min(1, Number(survival || 0) / 100));
  const expected = selectedRun?.expected_move_pct;
  const p05 = selectedRun?.p05;
  const p95 = selectedRun?.p95;
  const afterFix = null; // No counterfactual simulation has been run, so do not invent a post-fix result.
  const confTone =
    selectedRun?.confidence === "High"
      ? "gain"
      : selectedRun?.confidence === "Low"
      ? "loss"
      : "neutral";

  if (loading) return <><PageHeader title="Report card" description="Saved simulation and portfolio-analysis reports." /><Panel title="Saved runs">Loading saved reports…</Panel></>;
  if (!runs.length || !selectedRun) return <><PageHeader title="Report card" description="Saved simulation and portfolio-analysis reports." actions={<Button icon="download" onClick={handlePrint}>Download PDF</Button>} /><Panel title="No saved reports yet"><p className="text-sm text-slate">Run a simulation and save its completed result to see it here. Only saved runs appear in this report.</p></Panel><NextSteps href="/report" /></>;

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
      {actionError && <p role="alert" className="mb-4 rounded-lg border border-ember/40 bg-ember-soft p-3 text-sm text-ember-deep">{actionError}</p>}
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
                  <button type="button" disabled={deletingId === r.id} onClick={() => deleteRun(r.id)}
                    className="ml-3 mt-1 rounded-md px-2 py-1 text-xs font-semibold text-ember-deep hover:bg-ember-soft disabled:opacity-50">
                    {deletingId === r.id ? "Deleting…" : "Delete"}
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
                  <div className="display num text-[2.6rem]">{survival == null ? "N/A" : survival}</div>
                  <div className="text-xs text-slate">Survival score</div>
                </div>
              </Ring>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-sm text-slate">Expected move</dt>
                  <dd className="display num text-[1.9rem] text-ember-deep">
                    {expected == null ? "N/A" : pct(expected)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate">Likely range</dt>
                  <dd className="display num text-[1.9rem]">
                    {p05 == null || p95 == null ? "Not provided" : `${pct(p05)} to ${pct(p95)}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate">After suggested fixes</dt>
                  <dd className="display num text-[1.9rem] text-ultra">
                    {afterFix == null ? "Not simulated" : pct(afterFix)}
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
                <h3 className="head text-lg">{selectedRun?.record_type === "assistant_analysis" ? "Saved assistant analysis" : "Biggest hidden risk"}</h3>
                <p className="mt-1.5 text-[0.97rem] text-slate">
                  {selectedRun?.hidden_risk ||
                    "No additional hidden-risk narrative was recorded. Use the holding-level impact table and scenario assumptions to interpret this run."}
                </p>
              </div>
              <div>
                <h3 className="head text-lg">{selectedRun?.record_type === "assistant_analysis" ? "Original request" : "Recommended fix"}</h3>
                <p className="mt-1.5 text-[0.97rem] text-slate">
                  {selectedRun?.record_type === "assistant_analysis" ? (selectedRun?.original_question || selectedRun?.fix_description) : (selectedRun?.fix_description || "Review the scenario assumptions before acting on the result.")}
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

