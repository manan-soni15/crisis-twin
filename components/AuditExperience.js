"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import AuditTable from "@/components/AuditTable";
import { Panel, Tag } from "@/components/ui";

export default function AuditExperience() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState("");

  async function deleteRun(runId) {
    if (typeof window !== "undefined" && !window.confirm("Delete this saved run from Audit Trail and Report Card? This cannot be undone.")) return;
    setDeletingId(runId);
    setActionError("");
    try {
      const response = await fetch(`/api/audit/runs/${encodeURIComponent(runId)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.detail || "Could not delete this saved run.");
      setRows((current) => current.filter((row) => row.id !== runId));
    } catch (error) {
      setActionError(error.message || "Could not delete this saved run.");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    fetch("/api/audit/runs")
      .then((r) => r.json())
      .then((data) => {
        const mapped = (Array.isArray(data?.runs) ? data.runs : []).map((r, i) => ({
          id: r.id || `run-${i + 1}`,
          scenario: r.scenario || "Saved analysis",
          when: r.when || (r.created_at ? String(r.created_at).slice(0, 10) : "Recent"),
          agents: Number(r.agents || (Array.isArray(r.log) ? r.log.length : 0)),
          confidence: r.confidence || "Unrated",
          model: r.methodology || "Quantitative scenario engine",
          shocks: typeof r.shocks === "string" ? r.shocks : JSON.stringify(r.shocks ?? {}, null, 2),
          log: Array.isArray(r.log) ? r.log : [],
        }));
        setRows(mapped);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Saved analyses include their inputs, available reasoning, calculation method and confidence level, so results can be reviewed."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="Runs" bodyClass="!px-0 !pb-0">
          {actionError && <p role="alert" className="px-5 pt-4 text-sm text-ember-deep">{actionError}</p>}
          {loading ? <p className="px-5 py-6 text-sm text-slate">Loading saved runs…</p> : rows.length ? <AuditTable rows={rows} onDelete={deleteRun} deletingId={deletingId} /> : <div className="px-5 py-8 text-sm text-slate"><p className="font-semibold text-ink">No saved runs yet</p><p className="mt-1">Run a simulation and save its completed result to see it here.</p></div>}
        </Panel>
        <div className="space-y-5 lg:col-span-4">
          <Panel title="Saved result details">
            <p className="text-[0.95rem] text-slate">
              Saved simulation runs include their inputs, calculation method, available reasoning and returned metrics. Delete a run here to remove it from both Audit Trail and Report Card.
            </p>
          </Panel>
          <Panel title="What the confidence levels mean" tone="flat">
            <ul className="space-y-3 text-[0.95rem]">
              <li className="flex gap-3">
                <Tag tone="gain">High</Tag>
                <span className="text-slate">Inside the fitted data range, well covered.</span>
              </li>
              <li className="flex gap-3">
                <Tag>Medium</Tag>
                <span className="text-slate">Inside the range, but data is thin for one input.</span>
              </li>
              <li className="flex gap-3">
                <Tag tone="loss">Low</Tag>
                <span className="text-slate">Outside what the model has seen. Treat as a rough guide.</span>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
      <NextSteps href="/audit" />
    </>
  );
}

