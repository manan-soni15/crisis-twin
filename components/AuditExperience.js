"use client";

import { useState, useEffect } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import AuditTable from "@/components/AuditTable";
import { Panel, Tag } from "@/components/ui";

export default function AuditExperience() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

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
          model: r.model || "local-quant-engine",
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
        description="Every simulation is logged with its inputs, each advisor's reasoning, the model version and the confidence level, so any recommendation can be traced and checked."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="Runs" bodyClass="!px-0 !pb-0">
          {loading ? <p className="px-5 py-6 text-sm text-slate">Loading saved runs…</p> : rows.length ? <AuditTable rows={rows} /> : <div className="px-5 py-8 text-sm text-slate"><p className="font-semibold text-ink">No saved runs yet</p><p className="mt-1">Run a simulation or ask Crisis Twin AI for a portfolio analysis, then choose “Save to Audit Trail &amp; Report Card”.</p></div>}
        </Panel>
        <div className="space-y-5 lg:col-span-4">
          <Panel title="Saved result details">
            <p className="text-[0.95rem] text-slate">
              Saved assistant analyses include the original question, the response, and any structured simulation metrics that were returned. If a metric was not provided by the engine, it is left blank rather than estimated here.
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

