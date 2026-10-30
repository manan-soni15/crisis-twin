"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import Sliders from "@/components/Sliders";
import Segmented from "@/components/Segmented";
import { Panel, Button, Readout, Tag, TextLink } from "@/components/ui";
import { DivergingBar, RangeBar } from "@/components/viz/Charts";
import { SHOCKS, inr, pct } from "@/lib/sample";

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
  const [scenarioText, setScenarioText] = useState(
    "What if oil jumps 25% and the central bank raises rates by a full point?"
  );
  const [sliderVals, setSliderVals] = useState({
    oil: 25,
    rate: 100,
    fx: 4,
    vol: 35,
  });
  const [horizon, setHorizon] = useState("10 days");
  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef(null);

  const horizonDays = parseInt(horizon, 10) || 10;

  // Execute simulation against backend with given parameters
  const runSimulation = useCallback(async (text, sliders, days) => {
    setLoading(true);
    try {
      const shockVector = [
        { factor: "oil_price", change_pct: sliders.oil },
        { factor: "policy_rate", change_bps: sliders.rate },
        { factor: "usd_inr", change_pct: sliders.fx },
        { factor: "volatility", change_pct: sliders.vol },
      ];

      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_name: text.slice(0, 80),
          shocks: shockVector,
          horizon_days: days,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
        if (typeof window !== "undefined" && data.run_id) {
          window.sessionStorage?.setItem("crisis_twin_last_run_id", data.run_id);
          window.sessionStorage?.setItem("crisis_twin_last_scenario", text);
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
    runSimulation(scenarioText, sliderVals, horizonDays);
  }, []);

  // Preset click handler
  const handlePreset = (preset) => {
    setScenarioText(preset.text);
    setSliderVals(preset.sliders);
    setHorizon(preset.horizon);
    const days = parseInt(preset.horizon, 10) || 10;
    runSimulation(preset.text, preset.sliders, days);
  };

  // Slider change handler
  const handleSliderChange = (newVals) => {
    setSliderVals(newVals);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      runSimulation(scenarioText, newVals, horizonDays);
    }, 350);
  };

  // Horizon change handler
  const handleHorizonChange = (newH) => {
    setHorizon(newH);
    const days = parseInt(newH, 10) || 10;
    runSimulation(scenarioText, sliderVals, days);
  };

  // Reset handler
  const handleReset = () => {
    const defaultText = "What if oil jumps 25% and the central bank raises rates by a full point?";
    const defaultSliders = { oil: 25, rate: 100, fx: 4, vol: 35 };
    const defaultHorizon = "10 days";
    setScenarioText(defaultText);
    setSliderVals(defaultSliders);
    setHorizon(defaultHorizon);
    runSimulation(defaultText, defaultSliders, 10);
  };

  // Debounced natural language typing parser
  const handleTextChange = (e) => {
    const val = e.target.value;
    setScenarioText(val);

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      if (val.trim().length > 8) {
        try {
          const res = await fetch("/api/scenario/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: val }),
          });
          if (res.ok) {
            const parsed = await res.json();
            const shocks = parsed.shocks || [];
            const newSliders = { ...sliderVals };

            const oil = shocks.find((s) => s.factor === "oil_price");
            if (oil && Number.isFinite(oil.change_pct)) newSliders.oil = oil.change_pct;

            const rate = shocks.find((s) => s.factor === "policy_rate");
            if (rate && Number.isFinite(rate.change_bps)) newSliders.rate = rate.change_bps;

            const fx = shocks.find((s) => s.factor === "usd_inr");
            if (fx && Number.isFinite(fx.change_pct)) newSliders.fx = fx.change_pct;

            const vol = shocks.find((s) => s.factor === "volatility");
            if (vol && Number.isFinite(vol.change_pct)) newSliders.vol = vol.change_pct;

            setSliderVals(newSliders);
            const days = parsed.horizon_days || horizonDays;
            if (days <= 1) setHorizon("1 day");
            else if (days >= 25) setHorizon("30 days");
            else setHorizon("10 days");

            runSimulation(val, newSliders, days);
            return;
          }
        } catch {
          // ignore
        }
      }
      runSimulation(val, sliderVals, horizonDays);
    }, 600);
  };

  // Computed display values
  const expected = simResult ? simResult.expected_move_pct : -4.1;
  const p05 = simResult ? simResult.p05 : -6.8;
  const p95 = simResult ? simResult.p95 : -1.9;
  const portfolioBefore = simResult ? simResult.portfolio_value_before : 4820500;
  const portfolioAfter = simResult ? simResult.portfolio_value_after : 4622860;
  const confidence = simResult?.confidence || "medium";
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
              placeholder="What if oil jumps 25% and the central bank raises rates by a full point?"
              className="w-full resize-none rounded-lg border border-line bg-white p-3.5 text-[1.02rem] leading-relaxed focus:border-ultra focus:outline-none"
            />
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
          <Panel title="Fine-tune the shocks">
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
            <div className="mt-6 flex gap-3">
              <Button
                className="flex-1"
                icon="play"
                onClick={() => runSimulation(scenarioText, sliderVals, horizonDays)}
              >
                {loading ? "Simulating..." : "Run simulation"}
              </Button>
              <Button variant="ghost" onClick={handleReset}>Reset</Button>
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
              <TextLink href={`/propagation?run_id=${simResult?.run_id || ""}`}>See how it spreads</TextLink>
              <TextLink href={`/debate?run_id=${simResult?.run_id || ""}`}>Hear the debate</TextLink>
            </div>
          </Panel>
        </div>
      </div>
      <NextSteps href="/simulator" />
    </>
  );
}

