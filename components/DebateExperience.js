"use client";

import { useState, useEffect, useCallback } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import AgentMark from "@/components/AgentMark";
import { Panel, Button, Meter, Tag, TextLink } from "@/components/ui";

const INITIAL_MESSAGES = [
  {
    agent: "bull",
    name: "Bull",
    role: "Finds opportunity",
    conf: 3,
    evidence: "holding_impact.reliance, holding_impact.sun, dii_sip_support",
    text: "Reliance gains 4.0% on gross refining margin (GRM) expansion and Sun Pharma holds steady. Domestic mutual fund SIP inflows (~₹20,000+ Cr/month) create a persistent valuation floor. Panic-selling the core locks in temporary factor drawdowns.",
  },
  {
    agent: "bear",
    name: "Bear",
    role: "Attacks the plan",
    conf: 4,
    evidence: "holding_impact.hdfc, holding_impact.tata, weights, cad_expansion",
    text: "Two resilient names cannot cancel three heavy cyclical losers. HDFC Bank falls 6.3% on the rate move, and Tata Motors and IndiGo plunge over 12%. Together they make up 41% of the book as crude expands India's CAD.",
  },
  {
    agent: "audit",
    name: "Risk Auditor",
    role: "Checks hidden exposure",
    conf: 4,
    evidence: "risk_contribution, correlation_in_stress, auto_credit_spillover",
    wide: true,
    text: "HDFC Bank and Tata Motors share retail vehicle-financing exposure, representing 32% of total capital. In stress their correlation spikes towards 0.82, rendering nominal diversification ineffective. Reallocation toward defensives is essential.",
  },
];

const INITIAL_ACTIONS = [
  { t: "Trim Tata Motors", d: "12% to 8%", e: "+0.5 pts" },
  { t: "Trim IndiGo", d: "9% to 6%", e: "+0.4 pts" },
  { t: "Add defensives", d: "Sun Pharma and ITC, +7 points", e: "−0.1 pts" },
];

const RECORD = [
  { agent: "bull", name: "Bull", v: 54 },
  { agent: "bear", name: "Bear", v: 63 },
  { agent: "audit", name: "Risk Auditor", v: 71 },
];

export default function DebateExperience() {
  const [debateData, setDebateData] = useState(null);
  const [rebuttals, setRebuttals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rebuttalLoading, setRebuttalLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeakerIdx, setActiveSpeakerIdx] = useState(null);
  const [appliedActions, setAppliedActions] = useState({});
  const [applyingIdx, setApplyingIdx] = useState(null);

  // Stop audio speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Fetch live debate from backend
  const fetchDebate = useCallback(async (includeRebuttal = false) => {
    if (includeRebuttal) setRebuttalLoading(true);
    else setLoading(true);

    try {
      let runId = null;
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        runId = params.get("run_id") || window.sessionStorage?.getItem("crisis_twin_last_run_id");
      }

      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: runId,
          include_rebuttal: includeRebuttal,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDebateData(data);
        if (Array.isArray(data.rebuttals) && data.rebuttals.length > 0) {
          setRebuttals(data.rebuttals);
        } else if (!includeRebuttal) {
          setRebuttals([]);
        }
      }
    } catch (e) {
      console.error("Debate fetch error:", e);
    } finally {
      setLoading(false);
      setRebuttalLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDebate(false);
  }, [fetchDebate]);

  // Execute recommended rebalancing paper trade
  const handleApplyAction = async (action, idx) => {
    setApplyingIdx(idx);
    try {
      const title = (action.t || "").toLowerCase();
      let holdingId = "tata";
      let side = "sell";
      let qty = 30;

      if (title.includes("indigo") || title.includes("aviation")) {
        holdingId = "indigo";
        side = "sell";
        qty = 15;
      } else if (title.includes("tata") || title.includes("auto")) {
        holdingId = "tata";
        side = "sell";
        qty = 40;
      } else if (title.includes("hdfc") || title.includes("bank")) {
        holdingId = "hdfc";
        side = "sell";
        qty = 25;
      } else if (title.includes("sun") || title.includes("pharma")) {
        holdingId = "sun";
        side = "buy";
        qty = 20;
      } else if (title.includes("itc") || title.includes("fmcg") || title.includes("defensive")) {
        holdingId = "itc";
        side = "buy";
        qty = 50;
      }

      const res = await fetch("/api/paper/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holding_id: holdingId,
          quantity: qty,
          side: side,
          confirmed: true,
        }),
      });

      if (res.ok) {
        setAppliedActions((prev) => ({ ...prev, [idx]: true }));
      }
    } catch (err) {
      console.error("Failed to execute paper trade:", err);
    } finally {
      setApplyingIdx(null);
    }
  };

  // Web Speech Text-to-Speech audio reader with active speaker tracking
  const handleToggleAudio = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setActiveSpeakerIdx(null);
      return;
    }

    const allMessages = [
      ...(debateData?.messages || INITIAL_MESSAGES),
      ...rebuttals,
    ];

    window.speechSynthesis.cancel();
    setIsSpeaking(true);

    const utterances = allMessages.map((m) => {
      const u = new SpeechSynthesisUtterance(`${m.name} says: ${m.text}`);
      if (m.agent === "bear") {
        u.pitch = 0.85;
        u.rate = 0.95;
      } else if (m.agent === "bull") {
        u.pitch = 1.15;
        u.rate = 1.05;
      } else {
        u.pitch = 1.0;
        u.rate = 1.0;
      }
      return u;
    });

    utterances.forEach((u, i) => {
      u.onstart = () => {
        setActiveSpeakerIdx(i);
      };
      u.onend = () => {
        if (i === utterances.length - 1) {
          setIsSpeaking(false);
          setActiveSpeakerIdx(null);
        }
      };
      u.onerror = () => {
        if (i === utterances.length - 1) {
          setIsSpeaking(false);
          setActiveSpeakerIdx(null);
        }
      };
      window.speechSynthesis.speak(u);
    });
  };

  const messages = debateData?.messages || INITIAL_MESSAGES;
  const actions = debateData?.recommendations?.actions || INITIAL_ACTIONS;
  const beforeMove = debateData?.recommendations?.before_move_pct ?? -4.1;
  const afterMove = debateData?.recommendations?.after_move_pct ?? -3.4;
  const dissentText =
    debateData?.recommendations?.dissent || "The Bear wanted a larger trim of Tata Motors.";
  const scenarioTitle = debateData?.scenario_name || "Oil +25% and rates +100 bps";
  const expectedMove = debateData?.expected_move_pct ?? -4.1;

  return (
    <>
      <PageHeader
        title="Debate room"
        description="A Bull proposes, a Bear attacks, and an independent Risk Auditor checks the numbers with Dalal Street macro grounding."
        actions={
          <>
            <Button
              icon="play"
              onClick={() => fetchDebate(false)}
            >
              {loading ? "Running..." : "Run debate"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => fetchDebate(true)}
            >
              {rebuttalLoading ? "Adding..." : "Add a rebuttal round"}
            </Button>
            <Button
              variant={isSpeaking ? "primary" : "ghost"}
              onClick={handleToggleAudio}
            >
              {isSpeaking ? "Pause audio 🔊" : "Listen to debate 🎙️"}
            </Button>
          </>
        }
      />

      {/* Scenario Bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-bone px-5 py-3">
        <span className="text-slate">Scenario</span>
        <span className="font-semibold">{scenarioTitle}</span>
        <Tag tone={expectedMove < 0 ? "loss" : "gain"}>
          Expected move {expectedMove > 0 ? "+" : "−"}{Math.abs(expectedMove)}%
        </Tag>
        {debateData?.model && (
          <span className="rounded-full bg-mist px-2.5 py-0.5 text-xs text-slate">
            Analysis method: adversarial review
          </span>
        )}
        <span className="ml-auto">
          <TextLink href="/simulator">Change scenario</TextLink>
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left Column: Debate Cards */}
        <div className="space-y-5 lg:col-span-8">
          {messages.map((m, idx) => {
            const isActiveSpeaker = isSpeaking && activeSpeakerIdx === idx;
            return (
              <article
                key={m.agent + m.name}
                className={`rounded-[10px] border p-5 transition-all duration-300 ${
                  isActiveSpeaker
                    ? "ring-2 ring-ultra shadow-lg shadow-ultra/20 border-ultra scale-[1.01]"
                    : m.wide
                    ? "border-mint/50 bg-mint-soft/60"
                    : "border-line bg-bone"
                } ${
                  m.agent === "bear"
                    ? "sm:ml-12"
                    : m.agent === "bull"
                    ? "sm:mr-12"
                    : ""
                }`}
              >
                <header className="flex items-center gap-3">
                  <AgentMark agent={m.agent} />
                  <div>
                    <h2 className="head text-[1.15rem] flex items-center gap-2">
                      {m.name}
                      {isActiveSpeaker && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-ultra/30 bg-ultra/10 px-2 py-0.5 text-ultra text-[0.7rem] font-bold uppercase tracking-wider">
                          <span className="inline-block h-2 w-1 animate-pulse rounded-full bg-ultra" />
                          <span className="inline-block h-3.5 w-1 animate-pulse rounded-full bg-ultra" />
                          <span className="inline-block h-1.5 w-1 animate-pulse rounded-full bg-ultra" />
                          <span>Speaking</span>
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-slate">{m.role}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-sm text-slate">
                    Confidence{" "}
                    <Meter
                      value={m.conf}
                      tone={
                        m.agent === "bear"
                          ? "ember"
                          : m.agent === "audit"
                          ? "mint"
                          : "ultra"
                      }
                    />
                  </div>
                </header>
                <p className="serif mt-4 text-[1.22rem] leading-snug">{m.text}</p>
                <p className="mt-3 text-sm text-slate">Evidence: {m.evidence}</p>
              </article>
            );
          })}

          {/* Rebuttal Round Messages */}
          {rebuttals.map((r, idx) => {
            const rebuttalSpeakerIdx = messages.length + idx;
            const isActiveSpeaker = isSpeaking && activeSpeakerIdx === rebuttalSpeakerIdx;
            return (
              <article
                key={`rebuttal-${idx}`}
                className={`rounded-[10px] border p-5 border-ultra/40 bg-ice/40 transition-all duration-300 ${
                  isActiveSpeaker
                    ? "ring-2 ring-ultra shadow-lg shadow-ultra/20 border-ultra scale-[1.01]"
                    : ""
                } ${
                  r.agent === "bear" ? "sm:ml-12" : "sm:mr-12"
                }`}
              >
                <header className="flex items-center gap-3">
                  <AgentMark agent={r.agent} />
                  <div>
                    <h2 className="head text-[1.15rem] flex items-center gap-2">
                      {r.name}
                      {isActiveSpeaker && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-ultra/30 bg-ultra/10 px-2 py-0.5 text-ultra text-[0.7rem] font-bold uppercase tracking-wider">
                          <span className="inline-block h-2 w-1 animate-pulse rounded-full bg-ultra" />
                          <span className="inline-block h-3.5 w-1 animate-pulse rounded-full bg-ultra" />
                          <span className="inline-block h-1.5 w-1 animate-pulse rounded-full bg-ultra" />
                          <span>Speaking</span>
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-slate">{r.role}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2 text-sm text-slate">
                    Confidence{" "}
                    <Meter
                      value={r.conf}
                      tone={r.agent === "bear" ? "ember" : "ultra"}
                    />
                  </div>
                </header>
                <p className="serif mt-4 text-[1.22rem] leading-snug">{r.text}</p>
                <p className="mt-3 text-sm text-slate">Evidence: {r.evidence}</p>
              </article>
            );
          })}
        </div>

        {/* Right Column: Recommendations & Record */}
        <div className="space-y-5 lg:col-span-4">
          <Panel tone="ink" title="Portfolio Manager recommends">
            <ul className="divide-y divide-white/10">
              {actions.map((a, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="head text-[1.1rem] text-white">{a.t}</span>
                      {appliedActions[i] ? (
                        <span className="rounded-full bg-mint/20 px-2 py-0.5 text-xs font-semibold text-mint">
                          Applied ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApplyAction(a, i)}
                          disabled={applyingIdx === i}
                          className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-ice/80 transition-colors hover:border-white hover:text-white"
                        >
                          {applyingIdx === i ? "Applying..." : "Apply trade"}
                        </button>
                      )}
                    </div>
                    <div className="text-[0.95rem] text-ice/75">{a.d}</div>
                  </div>
                  <span className="num font-semibold text-white">{a.e}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-white/10 p-3.5 text-[0.95rem]">
              Expected move changes from{" "}
              <b className="text-white">
                {beforeMove > 0 ? "+" : "−"}{Math.abs(beforeMove)}%
              </b>{" "}
              to{" "}
              <b className="text-white">
                {afterMove > 0 ? "+" : "−"}{Math.abs(afterMove)}%
              </b>
              .
            </div>
            <div className="mt-4 text-[0.95rem]">
              <span className="font-semibold text-white">Dissent on record.</span>{" "}
              {dissentText}
            </div>
          </Panel>

          <Panel title="Advisor track record" aside="Sample">
            <ul className="space-y-4">
              {(debateData?.advisor_record || RECORD).map((r) => (
                <li key={r.agent}>
                  <div className="mb-1.5 flex items-center justify-between text-[0.95rem]">
                    <span className="flex items-center gap-2">
                      <AgentMark agent={r.agent} size={26} />
                      {r.name}
                    </span>
                    <span className="num font-semibold">{r.v}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-mist">
                    <div
                      className="h-full rounded-full bg-ink"
                      style={{ width: `${r.v}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate">
              Share of past crisis calls that held up in replay.
            </p>
          </Panel>
        </div>
      </div>

      <NextSteps href="/debate" />
    </>
  );
}
