"use client";

import { useState } from "react";
import { Tag } from "@/components/ui";
import { Icon } from "@/components/Icons";

const TONE = { High: "gain", Medium: "neutral", Low: "loss" };

export default function AuditTable({ rows }) {
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState(rows[0]?.id);
  const shown = rows.filter((r) => filter === "All" || r.confidence === filter);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 px-5" role="group" aria-label="Filter by confidence">
        {["All", "High", "Medium", "Low"].map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-[0.9rem] font-semibold ${filter === f ? "bg-ink text-white" : "border border-line text-slate hover:text-ink"}`}
          >
            {f === "All" ? "All runs" : `${f} confidence`}
          </button>
        ))}
      </div>
      <ul className="border-t border-line">
        {shown.map((r) => {
          const isOpen = open === r.id;
          return (
            <li key={r.id} className="border-b border-line/70 last:border-0">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : r.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 text-left hover:bg-white sm:grid-cols-[110px_minmax(0,1fr)_120px_auto]"
              >
                <span className="num hidden text-sm text-slate sm:block">{r.id}</span>
                <span>
                  <span className="block font-semibold">{r.scenario}</span>
                  <span className="text-sm text-slate">{r.when}, {r.agents} agents</span>
                </span>
                <span className="hidden sm:block"><Tag tone={TONE[r.confidence]}>{r.confidence}</Tag></span>
                <Icon name="chevron" size={18} className={`text-slate transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>
              {isOpen && (
                <div className="grid gap-4 bg-white px-5 pb-5 pt-1 md:grid-cols-2">
                  <div>
                    <div className="mb-1.5 text-sm text-slate">Parsed shocks</div>
                    <pre className="scroll-x rounded-lg bg-ink p-3.5 text-[0.82rem] leading-relaxed text-ice">{r.shocks}</pre>
                  </div>
                  <div>
                    <div className="mb-1.5 text-sm text-slate">Agent log</div>
                    <ul className="space-y-2 text-[0.92rem]">
                      {r.log.map((l, index) => (
                        <li key={`${l.agent || "agent"}-${index}`} className="flex gap-3"><span className="w-28 shrink-0 font-semibold">{l.agent}</span><span className="text-slate">{l.text}</span></li>
                      ))}
                    </ul>
                    <div className="mt-3 text-sm text-slate">Method: {r.model || "Not recorded"}</div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
