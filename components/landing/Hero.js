"use client";

import { useState } from "react";
import ShockGraph from "@/components/viz/ShockGraph";
import { Button } from "@/components/ui";
import { SHOCKS, HERO_HOLDINGS, portfolioImpact, pct } from "@/lib/sample";

export default function Hero() {
  const [scenario, setScenario] = useState("oil");
  const [run, setRun] = useState(0);
  const pick = (id) => {
    setScenario(id);
    setRun((r) => r + 1);
  };
  const total = portfolioImpact(scenario, HERO_HOLDINGS);
  const name = SHOCKS.find((s) => s.id === scenario).name;

  return (
    <section className="relative isolate overflow-hidden bg-ink bg-[radial-gradient(110%_90%_at_72%_18%,#172554_0%,#0b0f19_62%,#070a12_100%)] text-white">
      <div className="wrap grid min-h-[100svh] items-center gap-12 pb-16 pt-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
        <div className="relative z-10">
          <h1 className="display text-[clamp(3.4rem,8.4vw,7.2rem)]">
            Rehearse the crash before it happens.
          </h1>
          <p className="mt-7 max-w-[46ch] text-[1.14rem] leading-relaxed text-ice">
            Crisis Twin is a flight simulator for your money. Describe a shock, watch it travel through the stocks you own, and hear three AI advisors argue over what to do next.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button href="/dashboard" variant="light" icon="arrow">Open the console</Button>
            <Button href="#how" variant="ghostDark">See how it works</Button>
          </div>
          <p className="mt-6 text-sm text-ice/70">Simulation only. No real money, no real trades.</p>
        </div>

        <div className="relative z-0 rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-7">
          <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Choose a shock to simulate">
            <span className="mr-1 text-sm text-ice/80">Try a shock</span>
            {SHOCKS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={scenario === s.id}
                onClick={() => pick(s.id)}
                className={`rounded-full border px-3.5 py-1.5 text-[0.9rem] font-semibold transition-colors ${
                  scenario === s.id ? "border-ember bg-ember text-ink" : "border-white/20 bg-white/5 text-white hover:border-white/40 hover:bg-white/10"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="scroll-x -mx-5 px-5 sm:mx-0 sm:px-0 sm:[overflow:visible]">
            <div className="min-w-[600px] sm:min-w-0">
              <ShockGraph scenario={scenario} runKey={run} holdingsData={HERO_HOLDINGS} loss="#ff5a2c" gain="#10b981" className="text-white" />
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-6 border-t border-white/15 pt-4" aria-live="polite">
            <div className="text-sm text-ice/80">
              {name}
              <br />
              Sample portfolio, 7 holdings
            </div>
            <div className="text-right">
              <div className="text-sm text-ice/80">Expected portfolio move</div>
              <div className={`display num text-[2.6rem] ${total < 0 ? "text-ember" : "text-mint"}`}>{pct(total)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
