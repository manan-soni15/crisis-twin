"use client";

import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import ShockGraph from "@/components/viz/ShockGraph";
import { Panel, Path, TextLink } from "@/components/ui";
import { SHOCKS, SECTORS, HOLDINGS, SECTOR_IMPACT, HIDDEN_LINKS, holdingImpact, pct } from "@/lib/sample";

export default function PropagationExperience() {
  const [activeShockId, setActiveShockId] = useState("oil");
  const [propagationData, setPropagationData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch propagation data from API
  const fetchPropagation = useCallback(async (shockId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/propagate?shock_id=${shockId}`);
      if (res.ok) {
        const data = await res.json();
        setPropagationData(data);
      }
    } catch (e) {
      console.error("Propagation fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check if a scenario was stored from the simulator
    if (typeof window !== "undefined") {
      const storedScenario = window.sessionStorage?.getItem("crisis_twin_last_scenario");
      if (storedScenario) {
        const lower = storedScenario.toLowerCase();
        if (lower.includes("scandal") || lower.includes("accounting")) {
          setActiveShockId("scandal");
          fetchPropagation("scandal");
          return;
        }
        if (lower.includes("conflict") || lower.includes("war") || lower.includes("geopolitical")) {
          setActiveShockId("conflict");
          fetchPropagation("conflict");
          return;
        }
        if (lower.includes("rate") || lower.includes("repo") || lower.includes("inflation")) {
          setActiveShockId("rates");
          fetchPropagation("rates");
          return;
        }
      }
    }
    fetchPropagation(activeShockId);
  }, []);

  const handleTabChange = (shockId) => {
    setActiveShockId(shockId);
    fetchPropagation(shockId);
  };

  const activeShockMeta =
    propagationData?.shock || SHOCKS.find((s) => s.id === activeShockId) || SHOCKS[0];

  // Strongest paths fallback
  const paths =
    propagationData?.strongest_paths ||
    HOLDINGS.map((h) => ({
      holding_id: h.id,
      name: h.name,
      sector: SECTORS.find((s) => s.id === h.sector)?.label || h.sector,
      path_nodes: [activeShockMeta.label || activeShockMeta.name, SECTORS.find((s) => s.id === h.sector)?.label || h.sector, h.name],
      impact_pct: holdingImpact(activeShockId, h),
    }))
      .filter((x) => Math.abs(x.impact_pct) >= 0.5)
      .sort((a, b) => Math.abs(b.impact_pct) - Math.abs(a.impact_pct))
      .slice(0, 4);

  // Hidden exposures fallback
  const hidden =
    propagationData?.hidden_exposures ||
    HIDDEN_LINKS.filter((l) => Math.abs((SECTOR_IMPACT[activeShockId] || {})[l.from] || 0) >= 1).map((l) => ({
      from: l.from,
      to: l.to,
      path_nodes: [SECTORS.find((s) => s.id === l.from)?.label || l.from, HOLDINGS.find((h) => h.id === l.to)?.name || l.to],
      note: l.note,
    }));

  return (
    <>
      <PageHeader
        title="Propagation map"
        description="Follow a shock from its cause, through sectors, into the stocks you own. Dashed lines are links a sector view would miss."
      />

      {/* Tabs */}
      <div role="tablist" aria-label="Shock" className="scroll-x mb-5 flex gap-1.5 pb-1">
        {SHOCKS.map((t) => {
          const on = t.id === activeShockId;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[0.92rem] font-semibold transition-colors ${
                on ? "bg-ink text-white" : "border border-line bg-bone text-slate hover:text-ink"
              }`}
            >
              {t.name}
            </button>
          );
        })}
      </div>

      {/* Active Shock Propagation View */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title={activeShockMeta.name} aside="Hover or focus a name to isolate its paths">
          <div className="scroll-x">
            <div className="min-w-[620px] pt-2">
              <ShockGraph
                scenario={activeShockId}
                holdingsData={propagationData?.holding_impacts}
                sectorImpactData={propagationData?.sector_impact}
                hiddenLinksData={propagationData?.hidden_exposures}
                interactive
                loss="#ff5a2c"
                gain="#1fa98a"
                className="text-ink"
                showRings={false}
              />
            </div>
          </div>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-sm text-slate">
            <li className="flex items-center gap-2">
              <span className="h-1 w-6 rounded bg-ember" />
              Loss
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1 w-6 rounded bg-mint" />
              Gain
            </li>
            <li className="flex items-center gap-2">
              <span className="w-6 border-t-2 border-dashed border-ember" />
              Indirect link
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-6 rounded bg-slate/50" />
              Thicker means stronger
            </li>
          </ul>
        </Panel>

        <div className="space-y-5 lg:col-span-4">
          <Panel title="Strongest paths">
            <ul className="space-y-4">
              {paths.map((p) => (
                <li key={p.holding_id || p.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <Path nodes={p.path_nodes} className="text-[0.95rem]" />
                    <span
                      className={`num font-bold ${
                        p.impact_pct < 0 ? "text-ember-deep" : "text-mint-deep"
                      }`}
                    >
                      {pct(p.impact_pct)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Hidden exposures" tone="ink">
            {hidden.length ? (
              <ul className="space-y-4">
                {hidden.map((l, idx) => (
                  <li key={l.to + idx}>
                    <Path nodes={l.path_nodes} className="text-white" />
                    <p className="mt-1 text-[0.95rem] text-ice/80">{l.note}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ice/80">
                This shock has no indirect links that the sector view would miss.
              </p>
            )}
          </Panel>

          <TextLink href={`/debate?shock=${activeShockId}`}>Ask the advisors about these paths</TextLink>
        </div>
      </div>

      <NextSteps href="/propagation" />
    </>
  );
}

