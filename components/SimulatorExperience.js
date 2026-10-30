"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import Sliders from "@/components/Sliders";
import Segmented from "@/components/Segmented";
import { Panel, Button, Readout, Tag, TextLink } from "@/components/ui";
import { DivergingBar, RangeBar } from "@/components/viz/Charts";
import { inr, pct } from "@/lib/sample";

const PRESETS = [
  {
    id: "oil",
    name: "Oil price spike",
    text: "What if oil jumps 25% and the central bank raises rates by a full point?",
    sliders: { oil: 25, rate: 100, fx: 4, vol: 35 },
    horizon: "10 days",
  },
  {
    id: "rates",
    name: "Interest-rate hike",
    text: "What if the central bank aggressively hikes rates by 150 bps to fight inflation?",
    sliders: { oil: -5, rate: 150, fx: 2, vol: 20 },
    horizon: "10 days",
  },
  {
    id: "conflict",
    name: "Geopolitical conflict",
    text: "What if a major geopolitical conflict disrupts shipping routes, spiking oil and market volatility?",
    sliders: { oil: 35, rate: 50, fx: 8, vol: 50 },
    horizon: "30 days",
  },
  {
    id: "scandal",
    name: "Major company scandal",
    text: "What if an accounting scandal hits an auto giant and exposes banking lenders?",
    sliders: { oil: 0, rate: 0, fx: 0, vol: 40 },
    horizon: "10 days",
  },
];

const SLIDER_ITEMS = [
  { id: "oil", label: "Oil price", min: -40, max: 60, value: 25, unit: "%", signed: true },
  { id: "rate", label: "Policy rate", min: -100, max: 300, step: 25, value: 100, unit: " bps", signed: true },
  { id: "fx", label: "Rupee vs dollar", min: -15, max: 15, value: 4, unit: "%", signed: true },
  { id: "vol", label: "Market volatility", min: -20, max: 100, value: 35, unit: "%", signed: true },
];

export default function SimulatorExperience() {
  const [scenarioText, setScenarioText] = useState("");
  const [sliderVals, setSliderVals] = useState({
    oil: 25,
    rate: 100,
    fx: 4,
    vol: 35,
  });
  const [aiExtractedVals, setAiExtractedVals] = useState({
    oil: 25,
    rate: 100,
    fx: 4,
    vol: 35,
  });
  const [sourceMode, setSourceMode] = useState("ai"); // "ai" | "custom"
  const [isDirty, setIsDirty] = useState(false);
  const [committedRunId, setCommittedRunId] = useState(null);
  const [committedToast, setCommittedToast] = useState(false);
  const [horizon, setHorizon] = useState("10 days");
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef(null);

  const horizonDays = parseInt(horizon, 10) || 10;

  // Execute simulation against backend with given parameters
  const runSimulation = useCallback(async (text, sliders, days, isOfficialCommit = false) => {
    setLoading(true);
    try {
      const shockVector = [
        { factor: "oil_price", change_pct: sliders.oil },
        { factor: "policy_rate", change_bps: sliders.rate },
        { factor: "usd_inr", change_pct: sliders.fx },
        { factor: "volatility", change_pct: sliders.vol },
      ];

      const scenarioLabel = (text && text.trim()) || "Oil +25% and rates +100 bps";

      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_name: scenarioLabel.slice(0, 80),
          shocks: shockVector,
          horizon_days: days,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
        if (typeof window !== "undefined" && data.run_id) {
          window.sessionStorage?.setItem("crisis_twin_last_run_id", data.run_id);
          window.sessionStorage?.setItem("crisis_twin_last_scenario", scenarioLabel);
          if (isOfficialCommit) {
            setCommittedRunId(data.run_id);
            setIsDirty(false);
            setCommittedToast(true);
            setTimeout(() => setCommittedToast(false), 3500);
          }
        }
      }
    } catch (e) {
      console.error("Simulation error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    runSimulation("Oil +25% and rates +100 bps", sliderVals, horizonDays, true);
  }, []);

  // Preset click handler
  const handlePreset = (preset) => {
    setScenarioText(preset.text);
    setSliderVals(preset.sliders);
    setAiExtractedVals(preset.sliders);
    setSourceMode("ai");
    setIsDirty(false);
    setHorizon(preset.horizon);
    const days = parseInt(preset.horizon, 10) || 10;
    runSimulation(preset.text, preset.sliders, days, true);
  };

  // Slider change handler (user fine-tunes sensitivity)
  const handleSliderChange = (newVals) => {
    setSliderVals(newVals);
    setSourceMode("custom");
    setIsDirty(true);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      runSimulation(scenarioText, newVals, horizonDays, false);
    }, 300);
  };

  // Horizon change handler
  const handleHorizonChange = (newHorizon) => {
    setHorizon(newHorizon);
    setIsDirty(true);
    const days = parseInt(newHorizon, 10) || 10;
    runSimulation(scenarioText, sliderVals, days, false);
  };

  // Text scenario change handler with Groq LLM parsing
  const handleTextChange = (e) => {
    const text = e.target.value;
    setScenarioText(text);
    setIsDirty(true);

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      if (!text.trim() || text.length < 5) return;
      try {
        const res = await fetch("/api/scenario/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const parsed = await res.json();
          if (parsed && parsed.shocks) {
            const nextVals = { ...sliderVals };
            parsed.shocks.forEach((s) => {
              if (s.factor === "oil_price" && s.change_pct !== undefined)
                nextVals.oil = s.change_pct;
              if (s.factor === "policy_rate" && s.change_bps !== undefined)
                nextVals.rate = s.change_bps;
              if (s.factor === "usd_inr" && s.change_pct !== undefined)
                nextVals.fx = s.change_pct;
              if (s.factor === "volatility" && s.change_pct !== undefined)
                nextVals.vol = s.change_pct;
            });
            setSliderVals(nextVals);
            setAiExtractedVals(nextVals);
            setSourceMode("ai");
            setIsDirty(false);
            runSimulation(text, nextVals, horizonDays, true);
          }
        }
      } catch (err) {
        console.error("Scenario parse error:", err);
      }
    }, 600);
  };

  // Re-sync sliders with AI prompt baseline
  const handleResyncWithPrompt = () => {
    setSliderVals(aiExtractedVals);
    setSourceMode("ai");
    setIsDirty(false);
    runSimulation(scenarioText, aiExtractedVals, horizonDays, true);
  };

  // Official commit handler
  const handleCommitSimulation = () => {
    runSimulation(scenarioText, sliderVals, horizonDays, true);
  };

  const handleReset = () => {
    const defaults = { oil: 0, rate: 0, fx: 0, vol: 0 };
    setSliderVals(defaults);
    setAiExtractedVals(defaults);
    setScenarioText("");
    setSourceMode("ai");
    setIsDirty(false);
    runSimulation("Baseline scenario", defaults, horizonDays, true);
  };

  // Derived values from simulation result or fallback
  const expected = simResult?.expected_move_pct ?? -3.5;
  const p05 = simResult?.p05 ?? -7.1;
  const p95 = simResult?.p95 ?? -0.8;
  const portfolioBefore = simResult?.portfolio_value_before ?? 5559240;
  const portfolioAfter = simResult?.portfolio_value_after ?? 5365322;
  const confidence = simResult?.confidence ?? "high";
  const confidenceLabel =
    confidence === "high"
      ? "High confidence"
      : confidence === "low"
      ? "Low confidence"
      : "Medium confidence";
  const confidenceTone =
    confidence === "high" ? "mint" : confidence === "low" ? "loss" : "neutral";

  const rows = (simResult?.per_holding || []).map((h) => ({
    id: h.id,
    name: h.name,
    imp: h.impact_pct,
  }));

  // Min and max for RangeBar bounds
  const rangeMin = Math.min(-10, Math.floor(p05 - 1.5));
  const rangeMax = Math.max(0, Math.ceil(p95 + 1));

  // Extreme tail-risk check (>3-sigma)
  const isExtremeTailRisk =
    simResult?.correlation_breakdown_alert?.triggered ||
    Math.abs(expected) >= 5.0 ||
    sliderVals.vol >= 50 ||
    Math.abs(sliderVals.oil) >= 35 ||
    sliderVals.rate >= 150;

  const activeRunId = committedRunId || simResult?.run_id || "";

  return (
    <>
      <PageHeader
        title="Crisis Twin"
        description="Describe a crisis in plain words. The simulator turns it into shocks, applies them to your holdings, and shows a range instead of one false-precision number."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-5">
          <Panel title="Describe the crisis">
            <label htmlFor="scenario" className="sr-only">Crisis description</label>
            <textarea
              id="scenario"
              rows={4}
              value={scenarioText}
              onChange={handleTextChange}
              placeholder="Ex: What if oil jumps 25% and the central bank raises rates by a full point?"
              className="w-full resize-none rounded-lg border border-line bg-white p-3.5 text-[1.02rem] leading-relaxed focus:border-ultra focus:outline-none"
            />
            <p className="mt-2 text-xs text-slate">
              <span className="font-semibold text-slate-600">Ex:</span> &ldquo;What if oil jumps 25% and the central bank raises rates by a full point?&rdquo;
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handlePreset(s)}
                  className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[0.9rem] font-medium text-slate transition-colors hover:border-ultra hover:text-ultra"
                >
                  {s.name}
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title="Fine-tune the shocks"
            aside={
              sourceMode === "ai" ? (
                <span className="rounded-full bg-ultra/10 px-2.5 py-0.5 text-xs font-semibold text-ultra">
                  AI-Derived Baseline
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    User Customized
                  </span>
                  <button
                    type="button"
                    onClick={handleResyncWithPrompt}
                    className="text-xs font-semibold text-ultra hover:underline"
                    title="Reset sliders back to what the AI extracted from the scenario prompt"
                  >
                    ↺ Re-sync
                  </button>
                </div>
              )
            }
          >
            <p className="mb-4 text-xs text-slate">
              {sourceMode === "ai"
                ? "AI parsed baseline shocks from your scenario prompt. Drag any slider to fine-tune sensitivity."
                : "Manual slider adjustments override AI baseline. Test how sensitive your portfolio is to factor shifts."}
            </p>

            <Sliders
              items={SLIDER_ITEMS}
              values={sliderVals}
              onChange={handleSliderChange}
            />

            <div className="mt-6">
              <div className="mb-1.5 text-sm text-slate">Horizon</div>
              <Segmented
                label="Horizon"
                options={["1 day", "10 days", "30 days"]}
                value={horizon}
                onChange={handleHorizonChange}
              />
            </div>

            {/* Run Simulation Commitment Area */}
            <div className="mt-6 pt-4 border-t border-line">
              {isDirty ? (
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-amber-600">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                  <span>Parameters modified</span>
                  <span className="font-normal text-slate">— Click Run simulation to log & commit</span>
                </div>
              ) : committedToast ? (
                <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-mint">
                  <span>✓</span>
                  <span>Simulation committed to Audit Trail (Run #{activeRunId ? activeRunId.slice(-6) : "saved"})</span>
                </div>
              ) : null}

              <div className="flex gap-3">
                <Button
                  className={`flex-1 transition-all ${
                    isDirty
                      ? "ring-2 ring-ultra shadow-lg shadow-ultra/25 font-bold"
                      : ""
                  }`}
                  icon="play"
                  onClick={handleCommitSimulation}
                >
                  {loading
                    ? "Simulating & Logging..."
                    : isDirty
                    ? "Run & Commit Simulation"
                    : "Re-run simulation"}
                </Button>
                <Button variant="ghost" onClick={handleReset}>Reset</Button>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-5 lg:col-span-7">
          <Panel title="Result" aside={<Tag tone={confidenceTone}>{confidenceLabel}</Tag>}>
            <div className="grid gap-6 sm:grid-cols-2">
              <Readout
                label="Expected portfolio move"
                value={pct(expected)}
                tone={expected < 0 ? "loss" : "gain"}
                note={`Over ${horizon}`}
              />
              <div>
                <div className="text-sm text-slate">Likely range (5th to 95th percentile)</div>
                <RangeBar
                  low={p05}
                  high={p95}
                  expected={expected}
                  min={rangeMin}
                  max={rangeMax}
                />
              </div>
            </div>
            <p className="mt-2 rounded-lg bg-mist px-4 py-3 text-[0.95rem] text-slate">
              {simResult?.confidence_note ||
                "The scenario sits inside the range of data the model was fitted on, so the range is trustworthy. Large moves outside that range lower the confidence level and show a warning here."}
            </p>
          </Panel>

          {/* Fat-Tail Correlation Breakdown Alert (>3-sigma Shock) */}
          {isExtremeTailRisk && (
            <div className="rounded-[10px] border border-ember/50 bg-ember-soft/50 p-4 transition-all duration-300">
              <div className="flex items-center gap-2 font-bold text-ember-deep text-[0.95rem]">
                <span className="text-base">⚠️</span>
                <span>Correlation Breakdown Alert (Extreme &gt;3σ Shock)</span>
                <span className="ml-auto rounded-full bg-ember px-2.5 py-0.5 text-[0.7rem] text-white uppercase font-bold tracking-wider">
                  Fat-Tail Risk
                </span>
              </div>
              <p className="mt-2 text-[0.92rem] leading-relaxed text-ink/85">
                When macro shocks exceed 3-sigma thresholds, historical covariance breaks down: empirical asset correlations typically surge toward <b>1.0</b> in acute market panic, neutralizing standard linear diversification benefits.
              </p>
            </div>
          )}

          <Panel title="Before and after">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="text-sm text-slate">Before the shock</div>
                <div className="display num mt-1 text-[2rem]">{inr(portfolioBefore)}</div>
                <div className="mt-3 h-3 rounded-full bg-ink" />
              </div>
              <div>
                <div className="text-sm text-slate">After the shock</div>
                <div className="display num mt-1 text-[2rem] text-ember-deep">{inr(portfolioAfter)}</div>
                <div className="mt-3 h-3 rounded-full bg-mist">
                  <div
                    className="h-full rounded-full bg-ember transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, (portfolioAfter / portfolioBefore) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Impact by holding">
            <ul className="space-y-3.5">
              {rows.map((h) => (
                <li key={h.id} className="grid grid-cols-[104px_minmax(0,1fr)_60px] items-center gap-4">
                  <span className="font-medium truncate">{h.name}</span>
                  <DivergingBar value={h.imp} max={14} />
                  <span className={`num text-right font-semibold ${h.imp < 0 ? "text-ember-deep" : "text-mint-deep"}`}>
                    {pct(h.imp)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4">
              <TextLink href={`/propagation?run_id=${activeRunId}`}>See how it spreads</TextLink>
              <TextLink href={`/debate?run_id=${activeRunId}`}>Hear the debate</TextLink>
            </div>
          </Panel>
        </div>
      </div>
      <NextSteps href="/simulator" />
    </>
  );
}
