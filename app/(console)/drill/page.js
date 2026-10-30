"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/console/PageHeader";
import { Panel, Button, Tag, TextLink } from "@/components/ui";

const SCENARIOS = [
  { id: "oil-rate", name: "Oil shock overnight", level: "Medium", headline: "Oil jumps 25% overnight as markets price in a surprise central-bank rate hike.", description: "Energy prices are rising while borrowing costs may increase. Airlines and auto companies can face margin pressure, while energy exposure may partially offset the shock.", events: [
    { title: "Breaking alert", body: "Crude oil rises 25%. Futures point to a volatile open, and policy rates may rise by 100 basis points.", loss: -4.1, choices: [{id:"hold",label:"Hold positions",detail:"Keep the portfolio unchanged",score:2,why:"Avoids locking in losses, but leaves current concentration and shock exposure unchanged."},{id:"trim",label:"Trim vulnerable holdings",detail:"Reduce the most exposed positions",score:4,why:"Can reduce exposure to the shock, but may lock in losses and requires a clear re-entry plan."},{id:"cash",label:"Raise cash",detail:"Reduce risk broadly",score:3,why:"Lowers market exposure and adds flexibility, but can miss a recovery."},{id:"hedge",label:"Review defensive balance",detail:"Check defensive and energy exposure before acting",score:5,why:"Uses the portfolio's actual exposure to guide a measured response rather than making a blanket trade."}]},
    { title: "Second wave", body: "Airlines warn of higher fuel costs. Banks face uncertainty as bond yields rise; energy shares are volatile.", loss: -6.3, choices: [{id:"hold",label:"Hold positions",detail:"Wait for more information",score:3,why:"Avoids reacting to noise, but needs a defined loss limit and monitoring trigger."},{id:"trim",label:"Trim airlines and auto",detail:"Target the most exposed sectors",score:5,why:"A targeted response is more consistent with the scenario than selling every holding."},{id:"cash",label:"Sell broadly",detail:"Move a large share to cash",score:2,why:"Reduces exposure quickly but can overreact and create concentration or timing risks."},{id:"hedge",label:"Set review thresholds",detail:"Define risk limits and reassess",score:5,why:"Creates a repeatable decision rule and avoids treating an uncertain forecast as a certainty."}]},
    { title: "Market response", body: "The opening sell-off stabilizes, but volatility remains elevated and the rate decision is still uncertain.", loss: -3.2, choices: [{id:"hold",label:"Hold with a trigger",detail:"Keep positions and define a review point",score:5,why:"A clear trigger combines patience with a plan for changing conditions."},{id:"trim",label:"Continue reducing risk",detail:"Cut exposure further",score:3,why:"May be appropriate for a strict risk limit, but the rationale should be tied to portfolio exposure."},{id:"cash",label:"Stay fully defensive",detail:"Prioritize capital preservation",score:3,why:"Can fit a low risk budget, but has opportunity cost if markets recover."},{id:"hedge",label:"Compare outcomes first",detail:"Re-run the scenario with smaller and larger shocks",score:5,why:"Tests whether the decision is robust to different assumptions before acting."}]}
  ]},
  { id: "recession", name: "Recession warning", level: "Medium", headline: "Leading indicators weaken and analysts warn that a recession may be approaching.", description: "Cyclical businesses may face weaker demand, while defensive sectors may be relatively resilient. The path is uncertain.", events: [
    { title:"Breaking alert", body:"New data points to slowing growth. Auto, airline and IT demand expectations weaken.", loss:-3.5, choices:[{id:"hold",label:"Hold positions",detail:"Wait for confirmation",score:3,why:"Avoids reacting to a single signal, but exposure should be monitored."},{id:"trim",label:"Trim cyclical exposure",detail:"Reduce sectors sensitive to growth",score:5,why:"Targets the sectors most exposed to a demand shock."},{id:"cash",label:"Raise cash",detail:"Reduce overall risk",score:4,why:"Adds flexibility, but broad selling may be unnecessary without exposure analysis."},{id:"hedge",label:"Review defensive balance",detail:"Compare cyclical and defensive weights",score:5,why:"A portfolio-aware review is more targeted than a blanket response."}]},
    { title:"Earnings revisions", body:"Several companies lower forward guidance. Defensive demand looks steadier, but no outcome is certain.", loss:-5.8, choices:[{id:"hold",label:"Hold with thresholds",detail:"Monitor earnings and loss limits",score:5,why:"Makes patience conditional on measurable evidence."},{id:"trim",label:"Trim weakest exposures",detail:"Reduce positions with deteriorating fundamentals",score:5,why:"Links action to evidence and exposure rather than market fear."},{id:"cash",label:"Sell broad exposure",detail:"Prioritize liquidity",score:3,why:"Can lower volatility but risks selling sound holdings indiscriminately."},{id:"hedge",label:"Re-run a downside case",detail:"Compare moderate and severe scenarios",score:5,why:"Shows how sensitive the portfolio is to different assumptions."}]},
    { title:"Policy response", body:"Policy makers signal support measures, but recovery timing remains unclear.", loss:-2.6, choices:[{id:"hold",label:"Hold and review",detail:"Use a scheduled review",score:5,why:"Avoids trying to time a recovery while keeping a decision process."},{id:"trim",label:"Keep reduced exposure",detail:"Maintain defensive positioning",score:4,why:"Can fit risk constraints but should be reviewed as evidence changes."},{id:"cash",label:"Remain in cash",detail:"Wait for stronger confirmation",score:3,why:"Reduces immediate risk but may miss a rebound."},{id:"hedge",label:"Compare scenarios",detail:"Check if the portfolio can tolerate another leg down",score:5,why:"Makes the decision explicit about the downside it is designed to withstand."}]}
  ]},
  { id: "flash-crash", name: "Market-wide flash crash", level: "Hard", headline: "A sudden liquidity shock sends broad equity indices sharply lower.", description: "Prices are moving quickly, spreads may widen and headline-driven decisions can be costly.", events: [
    { title:"Liquidity shock", body:"Markets fall sharply in minutes. Quotes may be unstable and liquidity is thinner than usual.", loss:-7.2, choices:[{id:"hold",label:"Pause and verify",detail:"Avoid acting on unverified prices",score:5,why:"A short verification step helps avoid reacting to bad or stale information."},{id:"trim",label:"Trim by risk limits",detail:"Reduce only if a pre-set limit is breached",score:5,why:"Ties action to a predefined risk rule rather than panic."},{id:"cash",label:"Sell immediately",detail:"Move broadly to cash",score:2,why:"May reduce exposure but risks executing into poor liquidity."},{id:"hedge",label:"Check liquidity and exposure",detail:"Review cash needs and vulnerable positions",score:5,why:"Balances market exposure with execution and liquidity risk."}]},
    { title:"Volatility persists", body:"Trading remains volatile and market depth is uneven. The first move may not represent the final outcome.", loss:-9.1, choices:[{id:"hold",label:"Use pre-set triggers",detail:"Follow the risk plan",score:5,why:"A predefined plan reduces impulsive reactions."},{id:"trim",label:"Reduce breached exposures",detail:"Make targeted changes",score:5,why:"Targets risk-limit breaches without assuming every asset behaves the same."},{id:"cash",label:"Exit most positions",detail:"Prioritize immediate capital preservation",score:3,why:"Can fit a very low risk tolerance, but execution and recovery risks remain."},{id:"hedge",label:"Review cash runway",detail:"Check liquidity needs before trades",score:5,why:"Liquidity planning can matter as much as the price move during a shock."}]},
    { title:"Partial recovery", body:"Markets recover part of the move, but volatility remains above normal.", loss:-4.9, choices:[{id:"hold",label:"Reassess calmly",detail:"Use updated information and limits",score:5,why:"Separates the recovery from the longer-term risk plan."},{id:"trim",label:"Keep targeted reduction",detail:"Maintain only risk-limit changes",score:4,why:"Avoids reversing every decision based on one rebound."},{id:"cash",label:"Stay defensive",detail:"Wait for stable conditions",score:3,why:"Provides caution but may keep risk lower than the user's objective requires."},{id:"hedge",label:"Review all assumptions",detail:"Compare the initial shock with current data",score:5,why:"Ensures the response evolves with evidence rather than emotion."}]}
  ]}
];

function speak(text) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text || "").replace(/[*`|#_~]/g, " ").replace(/\s+/g, " ").trim());
  utterance.lang = "en-IN";
  utterance.rate = 0.96;
  window.speechSynthesis.speak(utterance);
}

function cleanTranscript(value) {
  return String(value || "").trim().replace(/[.,!?]+$/, "");
}

function scoreLabel(score) {
  if (score >= 85) return "Disciplined decision-making";
  if (score >= 65) return "Balanced response";
  return "Review your crisis playbook";
}

export default function CrisisDrillPage() {
  const [selectedScenario, setSelectedScenario] = useState("oil-rate");
  const [drill, setDrill] = useState(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [decisions, setDecisions] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(45);
  const [roundStartedAt, setRoundStartedAt] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const autoStartHandledRef = useRef(false);

  const event = drill?.scenario?.events?.[roundIndex] || null;
  const progress = drill ? Math.round(((roundIndex + (completed ? 1 : 0)) / drill.scenario.events.length) * 100) : 0;

  useEffect(() => {
    setVoiceSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!drill || completed || busy || feedback) return;
    setSecondsLeft(45);
    setRoundStartedAt(Date.now());
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [drill, roundIndex, completed, busy, feedback]);

  useEffect(() => {
    if (secondsLeft === 0 && drill && !completed && !busy && !feedback) {
      setFeedback({ timeout: true, title: "Decision window closed", text: "The timer ran out. Review the options and continue with a deliberate choice.", score: 0, choiceLabel: "No decision submitted" });
    }
  }, [secondsLeft, drill, completed, busy, feedback]);

  const startDrill = useCallback(async () => {
    setBusy(true); setVoiceError(""); setFeedback(null); setDecisions([]); setCompleted(false); setDrill(null); setRoundIndex(0);
    try {
      const response = await fetch("/api/drill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario_id: selectedScenario }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || "Could not start drill.");
      const scenario = SCENARIOS.find((item) => item.id === selectedScenario);
      if (!scenario) throw new Error("Selected scenario is unavailable.");
      const activeDrill = { ...data, scenario };
      setDrill(activeDrill);
      speak(`${scenario.name}. ${scenario.events[0].body} Your decision window is 45 seconds.`);
    } catch (error) {
      setVoiceError(error.message || "Could not start the drill.");
    } finally { setBusy(false); }
  }, [selectedScenario]);

  useEffect(() => {
    if (autoStartHandledRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("start") !== "1") return;
    autoStartHandledRef.current = true;
    void startDrill();
    window.history.replaceState({}, "", window.location.pathname);
  }, [startDrill]);

  const submitDecision = useCallback(async (choice, source = "tap") => {
    if (!drill || !event || busy || feedback || completed) return;
    setBusy(true); setVoiceError("");
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const secondsTaken = Math.max(0, Math.round((Date.now() - roundStartedAt) / 1000));
    const decision = { round: roundIndex + 1, event_title: event.title, choice_id: choice.id, choice_label: choice.label, source, seconds_taken: secondsTaken, estimated_loss_pct: event.loss };
    try {
      const response = await fetch("/api/drill/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ drill_id: drill.drill_id, scenario_id: drill.scenario.id, round_index: roundIndex, decision, is_final: roundIndex === drill.scenario.events.length - 1, previous_decisions: decisions }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not record decision.");
      setDecisions((previous) => [...previous, { ...decision, score: data.score, feedback: data.feedback }]);
      setFeedback({ ...data, choiceLabel: choice.label, source });
      if (source === "voice") speak(`${data.feedback} Decision score ${data.score} out of 100.`);
      else speak(data.feedback);
      if (data.completed) setCompleted(true);
    } catch (error) {
      setVoiceError(error.message || "Could not submit decision.");
    } finally { setBusy(false); }
  }, [drill, event, busy, feedback, completed, roundStartedAt, roundIndex, decisions]);

  const advance = useCallback(() => {
    if (!drill || busy) return;
    if (completed) return;
    setFeedback(null);
    setRoundIndex((index) => Math.min(index + 1, drill.scenario.events.length - 1));
  }, [drill, busy, completed]);

  const handleVoiceDecision = useCallback(() => {
    const Recognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!Recognition) { setVoiceError("Voice recognition is not supported in this browser. Use Chrome or Edge, or select a decision card."); return; }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    setVoiceError("");
    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    recognition.onstart = () => setIsListening(true);
    recognition.onerror = (eventError) => { setIsListening(false); setVoiceError(eventError.error === "not-allowed" ? "Microphone permission was denied. Allow microphone access in the browser address bar." : `Voice recognition failed (${eventError.error}). You can still choose an option manually.`); };
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (resultEvent) => {
      const transcript = cleanTranscript(resultEvent.results?.[0]?.[0]?.transcript);
      if (!transcript) { setVoiceError("I didn't catch that. Please try again."); return; }
      const normalized = transcript.toLowerCase();
      const choices = event?.choices || [];
      let matched = choices.find((choice) => normalized.includes(choice.label.toLowerCase()) || normalized.includes(choice.id));
      if (!matched) {
        if (/\b(hold|wait|stay|nothing|do nothing)\b/.test(normalized)) matched = choices.find((choice) => choice.id === "hold");
        else if (/\b(trim|reduce|cut|sell some|losers)\b/.test(normalized)) matched = choices.find((choice) => choice.id === "trim");
        else if (/\b(cash|sell everything|exit)\b/.test(normalized)) matched = choices.find((choice) => choice.id === "cash");
        else if (/\b(hedge|defensive|review|compare|risk limits|liquidity)\b/.test(normalized)) matched = choices.find((choice) => choice.id === "hedge");
      }
      if (!matched) { setVoiceError(`I heard “${transcript}”, but couldn't map it safely to one of the available choices. Please say one option's label or tap a card.`); return; }
      speak(`I heard: ${transcript}. Selecting ${matched.label}.`);
      submitDecision(matched, "voice");
    };
    try { recognition.start(); } catch { setIsListening(false); setVoiceError("Could not start the microphone. Try again or choose a decision card."); }
  }, [isListening, event, submitDecision]);

  const restart = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setDrill(null); setRoundIndex(0); setDecisions([]); setFeedback(null); setCompleted(false); setSecondsLeft(45); setVoiceError("");
  }, []);

  const finishScore = decisions.length ? Math.round(decisions.reduce((sum, item) => sum + Number(item.score || 0), 0) / decisions.length) : 0;

  return (
    <>
      <PageHeader
        title="Crisis drill"
        description="A voice-enabled crisis rehearsal. Hear a breaking scenario, make timed portfolio decisions by speaking or tapping, and review the reasoning behind each choice."
        actions={<Button icon="play" onClick={startDrill} disabled={busy}>{drill ? "Restart drill" : "Start drill"}</Button>}
      />

      {!drill && (
        <Panel title="Choose your drill" aside="3 rounds · 45 seconds per decision">
          <div className="grid gap-3 md:grid-cols-3">
            {SCENARIOS.map((scenario) => (
              <button key={scenario.id} type="button" onClick={() => setSelectedScenario(scenario.id)} className={`rounded-xl border p-4 text-left transition ${selectedScenario === scenario.id ? "border-ultra bg-ultra/5 ring-2 ring-ultra/20" : "border-line bg-white hover:border-ultra/50"}`}>
                <div className="flex items-center justify-between gap-2"><span className="head text-lg">{scenario.name}</span><Tag tone={scenario.level === "Hard" ? "loss" : "neutral"}>{scenario.level}</Tag></div>
                <p className="mt-2 text-sm text-slate">{scenario.description}</p>
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-mist p-4">
            <div><div className="font-semibold">Voice mode</div><p className="text-sm text-slate">{voiceSupported ? "Microphone input and spoken briefings are available in this browser." : "Spoken briefings are available; microphone recognition may require Chrome or Edge."}</p></div>
            <Button icon="play" onClick={startDrill} disabled={busy}>{busy ? "Starting..." : "Start crisis drill"}</Button>
          </div>
        </Panel>
      )}

      {voiceError && <div role="alert" className="mt-4 rounded-lg border border-ember/40 bg-ember/10 px-4 py-3 text-sm">{voiceError}</div>}

      {drill && !completed && event && (
        <>
          <div className="mb-5 rounded-xl bg-ember px-5 py-5 text-ink">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm font-semibold uppercase tracking-wide">Breaking · Round {roundIndex + 1} of {drill.scenario.events.length}</div><Tag tone="loss">{secondsLeft}s left</Tag></div>
            <h2 className="head mt-2 text-2xl">{drill.scenario.name}: {event.title}</h2>
            <p className="mt-2 max-w-4xl text-base leading-relaxed">{event.body}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-ink/80 transition-all" style={{ width: `${progress}%` }} /></div>
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-4">
              <Panel title="Decision clock">
                <div className="flex flex-col items-center py-3">
                  <div className={`flex h-40 w-40 items-center justify-center rounded-full border-[10px] ${secondsLeft <= 10 ? "border-ember" : "border-ultra/20"}`}>
                    <div className="text-center"><div className="display num text-5xl">{`00:${String(secondsLeft).padStart(2, "0")}`}</div><div className="text-sm text-slate">time remaining</div></div>
                  </div>
                  <p className="mt-3 text-center text-sm text-slate">Your response time is recorded for the debrief.</p>
                </div>
              </Panel>
              <Panel title="Portfolio snapshot">
                <div className="space-y-3">
                  <div className="flex justify-between gap-3"><span className="text-slate">Portfolio value</span><strong className="num">{Number(drill.portfolio.portfolio_value || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</strong></div>
                  <div className="flex justify-between gap-3"><span className="text-slate">Cash balance</span><strong className="num">{Number(drill.portfolio.cash_balance || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</strong></div>
                  <div className="flex justify-between gap-3"><span className="text-slate">Largest holding</span><strong className="text-right">{drill.portfolio.largest_holding || "Unavailable"}</strong></div>
                  <div className="border-t border-line pt-3 text-xs text-slate">Price data: {String(drill.portfolio.price_status || "unknown").replaceAll("_", " ")}. Scenario losses are illustrative, not forecasts.</div>
                </div>
              </Panel>
            </div>

            <div className="space-y-5 lg:col-span-8">
              <Panel title="What do you do?" aside="Choose by voice or tap">
                <div className="grid gap-3 sm:grid-cols-2">
                  {event.choices.map((choice) => (
                    <button key={choice.id} type="button" disabled={busy || Boolean(feedback)} onClick={() => submitDecision(choice, "tap")} className="group rounded-xl border border-line bg-white p-4 text-left transition hover:border-ultra hover:bg-ultra hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
                      <span className="head block text-xl">{choice.label}</span>
                      <span className="mt-1 block text-sm text-slate group-hover:text-ice">{choice.detail}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button icon="mic" onClick={handleVoiceDecision} disabled={busy || Boolean(feedback) || !voiceSupported}>{isListening ? "Stop listening" : "Speak your decision"}</Button>
                  {isListening && <span className="animate-pulse text-sm font-semibold text-ember-deep">Listening… say the name of one option.</span>}
                  <p className="text-sm text-slate">Example: “Review defensive balance” or “Trim vulnerable holdings.”</p>
                </div>
              </Panel>
              {feedback && (
                <Panel title={feedback.timeout ? "Time expired" : "Decision debrief"} aside={feedback.timeout ? "No choice recorded" : `${feedback.score}/100`}>
                  <div className="space-y-3">
                    {!feedback.timeout && <div className="font-semibold">You chose: {feedback.choiceLabel}</div>}
                    <p className="leading-relaxed">{feedback.feedback || feedback.text}</p>
                    {feedback.timeout && <p className="text-sm text-slate">A timeout is not treated as a financial loss; it is recorded as an unanswered decision.</p>}
                    <div className="flex flex-wrap gap-3">
                      {roundIndex < drill.scenario.events.length - 1
                        ? <Button icon="arrow-right" onClick={advance}>Continue to next event</Button>
                        : <Button icon="check" onClick={() => setCompleted(true)}>View final debrief</Button>}
                    </div>
                  </div>
                </Panel>
              )}
            </div>
          </div>
        </>
      )}

      {drill && completed && (
        <div className="space-y-5">
          <Panel title="Crisis drill debrief" aside="Completed">
            <div className="grid gap-5 md:grid-cols-3">
              <div className="rounded-xl bg-mist p-4"><div className="text-sm text-slate">Decision discipline score</div><div className="display num mt-1 text-4xl">{finishScore}<span className="text-lg">/100</span></div><div className="mt-1 text-sm font-semibold">{scoreLabel(finishScore)}</div></div>
              <div className="rounded-xl bg-mist p-4"><div className="text-sm text-slate">Decisions recorded</div><div className="display num mt-1 text-4xl">{decisions.length}<span className="text-lg">/3</span></div><div className="mt-1 text-sm text-slate">Voice and tap choices are both accepted.</div></div>
              <div className="rounded-xl bg-mist p-4"><div className="text-sm text-slate">Average response time</div><div className="display num mt-1 text-4xl">{decisions.length ? Math.round(decisions.reduce((sum, item) => sum + item.seconds_taken, 0) / decisions.length) : 0}<span className="text-lg">s</span></div><div className="mt-1 text-sm text-slate">A fast answer is not automatically a good answer.</div></div>
            </div>
            <div className="mt-5 space-y-3">
              {decisions.map((decision) => (
                <div key={`${decision.round}-${decision.choice_id}`} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">Round {decision.round}: {decision.event_title}</div><Tag tone={decision.score >= 80 ? "gain" : decision.score >= 60 ? "neutral" : "loss"}>{decision.score}/100</Tag></div>
                  <p className="mt-1">Your decision: {decision.choice_label}{decision.source === "voice" ? " (voice)" : ""}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate">{decision.feedback}</p>
                  <p className="mt-2 text-xs text-slate">Illustrative scenario impact at decision time: {decision.estimated_loss_pct}% (not a live mark-to-market loss).</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3"><Button icon="refresh-cw" onClick={restart}>Choose another drill</Button><TextLink href="/profile">Review your risk profile</TextLink></div>
            <p className="mt-4 text-xs text-slate">Training simulation only. Scenario impacts and decision scores are illustrative, based on a transparent rubric, and are not investment advice or a prediction of market returns.</p>
          </Panel>
        </div>
      )}
    </>
  );
}

