"use client";

import { useEffect, useRef, useState } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import VoiceOrb from "@/components/VoiceOrb";
import AgentMark from "@/components/AgentMark";
import { Panel, Button } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { getPortfolioStrict, parseScenarioStrict, runSimulationStrict } from "@/lib/api";

const COMMANDS = [
  "Simulate oil prices rising 20% over 10 days.",
  "What is my portfolio's biggest concentration risk?",
  "What happens if oil jumps 25% and interest rates rise 100 bps?",
  "And what if rates rise 2%?",
  "Why did the portfolio move that way?",
  "Compare this with the previous result.",
];

const INITIAL_MESSAGES = [
  {
    id: "welcome",
    who: "Crisis Twin",
    text: "Voice War Room is ready. Ask for a stress scenario such as “simulate oil prices rising 20% over 10 days,” or ask about your portfolio. Scenario estimates are transparent heuristics, not calibrated forecasts.",
  },
];

function isScenarioRequest(text) {
  return /\b(simulat(?:e|ion)|scenario|stress.?test|what if|oil|crude|interest rate|policy rate|repo rate|rates?|geopolitical|sanctions|war)\b/i.test(text);
}

function formatPct(value) {
  const number = Number(value);
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function summarizeSimulation(result) {
  const contributors = [...(result.per_holding || [])]
    .sort((a, b) => Math.abs(Number(b.weight || 0) * Number(b.impact_pct || 0)) -
                    Math.abs(Number(a.weight || 0) * Number(a.impact_pct || 0)))
    .slice(0, 2);
  const names = contributors.map((item) => `${item.name || item.id} (${formatPct(item.impact_pct)} holding impact)`);
  const direction = result.expected_move_pct < 0 ? "estimated loss" : "estimated gain";
  const contributorsText = names.length ? ` Largest estimated contributors: ${names.join(" and ")}.` : "";
  return `The ${result.horizon_days || 10}-day scenario estimates a ${direction} of ${formatPct(result.expected_move_pct)} for the portfolio. The heuristic range is ${formatPct(result.p05)} to ${formatPct(result.p95)}.${contributorsText} Confidence is low because this uses transparent sector sensitivities, not a calibrated risk model. These figures are scenario estimates, not predictions or investment advice.`;
}

function summarizePortfolio(portfolio) {
  const holdings = (portfolio.holdings || []).filter((holding) => Number(holding.value || 0) > 0);
  const largest = [...holdings].sort((a, b) => Number(b.value || 0) - Number(a.value || 0))[0];
  const value = Number(portfolio.portfolio_value || 0);
  const cashPct = value > 0 ? Number(portfolio.cash_balance || 0) / value * 100 : 0;
  const largestPct = largest && value > 0 ? Number(largest.value || 0) / value * 100 : 0;
  const priceStatus = portfolio.price_status || "unknown";
  const priceNote = priceStatus === "provider_daily_close"
    ? ` Market data status: provider daily close as of ${portfolio.price_as_of || "the latest available date"}; this is not a live quote.`
    : ` Market data status: ${priceStatus.replaceAll("_", " ")}; treat valuations cautiously.`;
  if (!holdings.length) return `I couldn't find any positive-value holdings in the saved portfolio. Portfolio value is ${value.toFixed(2)}.${priceNote}`;
  return `Your portfolio value is ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}, including cash. Cash is ${cashPct.toFixed(1)}% of total value. Your largest holding is ${largest.name || largest.ticker}, at ${largestPct.toFixed(1)}% of total portfolio value. ${largestPct >= 25 ? "That is a concentration worth reviewing." : "No single holding exceeds 25% of total portfolio value."}${priceNote}`;
}

export default function WarRoomExperience() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSpeaker, setLastSpeaker] = useState("Crisis Twin");
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const conversationRef = useRef(null);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const shouldSubmitVoiceRef = useRef(false);
  const lastSimulationRef = useRef(null);
  const previousSimulationRef = useRef(null);
  const lastScenarioRef = useRef(null);
  const conversationContextRef = useRef([]);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  useEffect(() => {
    setVoiceSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
      shouldSubmitVoiceRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  function speakReply(text) {
    if (!speakReplies || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  function resolveContextualScenario(command) {
    const previous = lastScenarioRef.current;
    if (!previous?.shocks?.length) return null;
    const text = command.toLowerCase();
    const hasFactor = /\b(oil|crude|rate|rates|interest|repo|geopolitical|war|sanctions)\b/i.test(command);
    const hasMagnitude = /\d+(?:\.\d+)?\s*(?:%|bps?|basis points?)\b/i.test(command);
    const followupCue = /\b(and|and if|what about|what if|instead|make it|change (?:that|it)|raise it|increase it|lower it|reduce it|same scenario|also)\b/i.test(command);
    if (!(followupCue || (!hasFactor && hasMagnitude))) return null;

    const shocks = previous.shocks.map((shock) => ({ ...shock }));
    const mentionedFactor = /\b(oil|crude)\b/i.test(text) ? "oil_price"
      : /\b(rate|rates|interest|repo)\b/i.test(text) ? "policy_rate"
      : /\b(war|geopolitical|sanctions|conflict)\b/i.test(text) ? "geopolitical_risk"
      : null;
    const inferredFactor = mentionedFactor || (shocks.length === 1 ? shocks[0].factor : null);
    if (!inferredFactor) return null;
    const existing = shocks.find((shock) => shock.factor === inferredFactor);
    if (!existing) return null;

    const magnitude = text.match(/(\d+(?:\.\d+)?)\s*(%|bps?|basis points?)\b/i);
    if (magnitude) {
      const amount = Number(magnitude[1]);
      const unit = magnitude[2].toLowerCase();
      if (inferredFactor === "oil_price" || inferredFactor === "geopolitical_risk") {
        existing.change_pct = amount * (/\b(fall|drop|decrease|down|lower|reduce)\b/i.test(text) ? -1 : 1);
      } else {
        existing.change_bps = amount * (unit === "%" ? 100 : 1) * (/\b(cut|fall|drop|decrease|down|lower|reduce)\b/i.test(text) ? -1 : 1);
      }
    } else if (!followupCue) {
      return null;
    }
    const horizonMatch = text.match(/(\d+)\s*days?\b/i);
    return {
      ...previous,
      scenario_name: `${previous.scenario_name || "Previous scenario"} — follow-up: ${command}`.slice(0, 120),
      horizon_days: horizonMatch ? Math.max(1, Math.min(90, Number(horizonMatch[1]))) : previous.horizon_days,
      shocks,
    };
  }

  async function handleWarRoomCommand(command) {
    const lower = command.toLowerCase();
    const previous = lastSimulationRef.current;
    const holdingMention = previous?.per_holding?.find((holding) =>
      lower.includes(String(holding.name || "").toLowerCase()) || lower.includes(String(holding.id || "").toLowerCase())
    );

    if (/\b(compare|compared|versus|vs\.?|difference)\b/i.test(lower) && previous && previousSimulationRef.current) {
      const currentMove = Number(previous.expected_move_pct || 0);
      const priorMove = Number(previousSimulationRef.current.expected_move_pct || 0);
      const delta = currentMove - priorMove;
      return { who: "Risk Auditor", text: `Comparing the last two simulations: the earlier scenario estimated ${formatPct(priorMove)}, and the latest estimated ${formatPct(currentMove)}. That is a change of ${formatPct(delta)} in the estimated portfolio move. Both are low-confidence sector-sensitivity heuristics, not forecasts.` };
    }

    if (holdingMention && /\b(what about|tell me about|how about|impact|risk|explain|and)\b/i.test(lower)) {
      return { who: "Risk Auditor", text: `${holdingMention.name || holdingMention.id} had an estimated holding-level impact of ${formatPct(holdingMention.impact_pct)} in the latest scenario and represents ${Number(holdingMention.weight || 0).toFixed(1)}% of the portfolio by weight. This is a scenario sensitivity, not a prediction.` };
    }

    if (previous && /\b(why|explain|tell me more|more detail|these results|last scenario|that result|what does that mean)\b/i.test(lower) && !isScenarioRequest(command)) {
      return { who: "Risk Auditor", text: summarizeSimulation(previous) };
    }

    if (/\b(what about|and what about|how about|what is the impact on|impact on)\b/i.test(lower) && !isScenarioRequest(command)) {
      const portfolio = await getPortfolioStrict();
      const query = lower.replace(/.*\b(?:what about|and what about|how about|what is the impact on|impact on)\b/i, "").trim().replace(/[?.!]+$/, "");
      const holding = (portfolio.holdings || []).find((item) =>
        [item.name, item.ticker, item.id].some((value) => value && String(value).toLowerCase().includes(query))
      );
      if (holding) return { who: "Risk Auditor", text: `${holding.name || holding.ticker} is ${Number(holding.weight || 0).toFixed(1)}% of your portfolio by weight, with a current value of ${Number(holding.value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}.${previous ? ` In the last scenario, its estimated impact was ${formatPct((previous.per_holding || []).find((item) => item.id === holding.id)?.impact_pct ?? 0)}.` : " Run a scenario to estimate its stress impact."} These values reflect the saved portfolio data.` };
    }

    if (/\b(why|explain|tell me more|which holding|biggest risk|hidden risk|portfolio|cash|concentration|largest holding|how much)\b/i.test(lower) && !isScenarioRequest(command)) {
      const portfolio = await getPortfolioStrict();
      return { who: "Risk Auditor", text: summarizePortfolio(portfolio) };
    }

    if (isScenarioRequest(command) || resolveContextualScenario(command)) {
      const contextual = resolveContextualScenario(command);
      const parsed = contextual || await parseScenarioStrict(command);
      const result = await runSimulationStrict(parsed);
      if (lastSimulationRef.current) previousSimulationRef.current = lastSimulationRef.current;
      lastScenarioRef.current = parsed;
      lastSimulationRef.current = result;
      return { who: "Crisis Twin", text: `${contextual ? "I updated the previous scenario using your follow-up. " : ""}${summarizeSimulation(result)}`, simulation: result };
    }

    if (/\b(bear|bull|debate|challenge|respond)\b/i.test(lower)) {
      if (lastSimulationRef.current) {
        const result = lastSimulationRef.current;
        const worst = [...(result.per_holding || [])].sort((a, b) => Number(a.impact_pct) - Number(b.impact_pct))[0];
        return { who: "Bear", text: worst
          ? `The cautious view is to focus on ${worst.name || worst.id}, with an estimated holding-level impact of ${formatPct(worst.impact_pct)} in the last scenario. This is based on the saved heuristic simulation, not an independent agent debate.`
          : "Run a scenario first so I can discuss its actual output." };
      }
      return { who: "Crisis Twin", text: "Run a stress scenario first, then ask me to challenge its assumptions." };
    }

    if (/\b(again|same scenario|repeat that|run it again)\b/i.test(lower) && lastScenarioRef.current) {
      const result = await runSimulationStrict(lastScenarioRef.current);
      if (lastSimulationRef.current) previousSimulationRef.current = lastSimulationRef.current;
      lastSimulationRef.current = result;
      return { who: "Crisis Twin", text: summarizeSimulation(result), simulation: result };
    }

    return { who: "Crisis Twin", text: lastScenarioRef.current
      ? "I’m following the previous scenario. Try “what if oil rises to 30%?”, “and rates rise 2%?”, “why?”, “compare with the previous result”, or “what about HDFC Bank?” You can also start a new scenario."
      : "I can run supported oil, interest-rate, and geopolitical stress scenarios, or summarize your saved portfolio. Try: “Simulate oil prices rising 20% over 10 days.”" };
  }

  async function sendCommand(value) {
    const command = value.trim();
    if (!command || isProcessing) return;

    const userMessage = { id: `msg-${Date.now()}-user`, who: "You", text: command };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsProcessing(true);
    stopSpeaking();

    try {
      let reply;
      // Keep supported scenario execution on the existing deterministic API.
      // Use Groq for open-ended portfolio questions and contextual follow-ups.
      if (isScenarioRequest(command) || resolveContextualScenario(command)) {
        reply = await handleWarRoomCommand(command);
      } else {
        const response = await fetch("/api/intelligence/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: command,
            history: conversationContextRef.current.slice(-10),
          }),
        });
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
          ? await response.json().catch(() => ({}))
          : {};
        if (!response.ok) {
          const detail = data.error || `The AI endpoint returned HTTP ${response.status}.`;
          throw new Error(detail);
        }
        if (!data.text) throw new Error("The AI endpoint returned no answer. Check the Next.js terminal for the route error.");
        reply = { who: data.who || "Crisis Twin AI", text: data.text };
      }
      conversationContextRef.current = [...conversationContextRef.current, { role: "user", text: command }, { role: "assistant", text: reply.text, who: reply.who }].slice(-12);
      setMessages((current) => [...current, { id: `msg-${Date.now()}-reply`, ...reply }]);
      setLastSpeaker(reply.who);
      setVoiceStatus("Response ready.");
      speakReply(reply.text);
    } catch (error) {
      const message = error?.message || "The request could not be completed.";
      const reply = {
        who: "Crisis Twin",
        text: `I couldn't complete that request: ${message} I have not substituted sample simulation results. If this continues, check the Next.js terminal for the exact API error.`,
      };
      setMessages((current) => [...current, { id: `msg-${Date.now()}-error`, ...reply }]);
      setVoiceStatus("Request failed. Check the backend connection.");
      speakReply(reply.text);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    shouldSubmitVoiceRef.current = false;
    if (isListening && recognitionRef.current) recognitionRef.current.stop();
    sendCommand(draft);
  }

  function toggleVoiceInput() {
    if (!voiceSupported || isProcessing) return;

    if (isListening && recognitionRef.current) {
      shouldSubmitVoiceRef.current = true;
      recognitionRef.current.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("Voice recognition is not supported here. Please type your command instead.");
      setVoiceSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;
      finalTranscriptRef.current = "";
      shouldSubmitVoiceRef.current = true;
      setVoiceStatus("Listening now. Speak clearly, then pause to send your command.");
      setDraft("");

      recognition.onresult = (event) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) finalTranscriptRef.current += `${transcript} `;
          else interimTranscript += transcript;
        }
        const combined = `${finalTranscriptRef.current} ${interimTranscript}`.trim();
        setDraft(combined);
      };

      recognition.onerror = (event) => {
        shouldSubmitVoiceRef.current = false;
        const messages = {
          "not-allowed": "Microphone permission was denied. Allow microphone access in your browser settings, or type your command.",
          "service-not-allowed": "The browser speech service is unavailable. You can still type your command.",
          "no-speech": "No speech was detected. Tap the microphone and try again.",
          network: "The browser speech service had a network issue. Please try again or type your command.",
          aborted: "Voice input was stopped.",
        };
        setVoiceStatus(messages[event.error] || "Voice input could not start. Please try again or type your command.");
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
        const transcript = finalTranscriptRef.current.trim();
        if (shouldSubmitVoiceRef.current && transcript) {
          shouldSubmitVoiceRef.current = false;
          setVoiceStatus("Voice command received.");
          setDraft("");
          sendCommand(transcript);
        } else if (shouldSubmitVoiceRef.current) {
          shouldSubmitVoiceRef.current = false;
          setVoiceStatus("I didn't catch a complete command. Try again or type below.");
        }
      };

      recognition.start();
      setIsListening(true);
    } catch {
      shouldSubmitVoiceRef.current = false;
      setIsListening(false);
      setVoiceStatus("Could not access voice input. Check microphone permission or type your command.");
    }
  }

  function clearConversation() {
    stopSpeaking();
    lastSimulationRef.current = null;
    previousSimulationRef.current = null;
    lastScenarioRef.current = null;
    conversationContextRef.current = [];
    if (isProcessing && timerRef.current) clearTimeout(timerRef.current);
    shouldSubmitVoiceRef.current = false;
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
    setVoiceStatus("");
    setMessages(INITIAL_MESSAGES);
    setIsProcessing(false);
    setLastSpeaker("Crisis Twin");
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <>
      <PageHeader
        title="Voice war room"
        description="Run stress scenarios by voice or text, then ask contextual follow-ups like “why?”, “what about HDFC Bank?”, or “what if rates rise 2%?” without repeating the whole scenario."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-3 lg:order-1" title="Try a command">
          <p className="mb-4 text-sm leading-relaxed text-slate">Choose a prompt to run a portfolio query or stress scenario against the backend.</p>
          <ul className="space-y-3">
            {COMMANDS.map((command) => (
              <li key={command}>
                <button
                  type="button"
                  onClick={() => sendCommand(command)}
                  disabled={isProcessing}
                  className="serif w-full border-l-2 border-ultra pl-3 text-left text-[1.02rem] leading-snug transition-colors hover:border-ember hover:text-ultra disabled:cursor-not-allowed disabled:opacity-50"
                >
                  &ldquo;{command}&rdquo;
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-5 lg:order-2 lg:col-span-6">
          <Panel tone="ink" bodyClass="!pt-2">
            <VoiceOrb
              isListening={isListening}
              isProcessing={isProcessing}
              isSupported={voiceSupported}
              onToggle={toggleVoiceInput}
              statusMessage={voiceStatus}
            />
            <form onSubmit={handleSubmit} className="mx-auto mt-2 flex max-w-[520px] gap-2" aria-label="Type a request">
              <label htmlFor="typed" className="sr-only">Type a request</label>
              <input
                ref={inputRef}
                id="typed"
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={isProcessing}
                placeholder="Type a crisis or a question"
                className="min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-white placeholder:text-ice/55 disabled:opacity-60"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!draft.trim() || isProcessing}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink transition-colors hover:bg-ice disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <Icon name="send" size={18} />
              </button>
            </form>
            <div className="mt-3 text-center text-xs text-ice/60">{isListening ? "Microphone active · pause when finished" : isProcessing ? "Running portfolio analysis…" : "Voice input + typed commands · backend-connected estimates"}</div>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-ice/75">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={speakReplies} onChange={(event) => {
                  setSpeakReplies(event.target.checked);
                  if (!event.target.checked) stopSpeaking();
                }} />
                Speak replies aloud
              </label>
              {isSpeaking && <button type="button" onClick={stopSpeaking} className="underline underline-offset-2">Stop speaking</button>}
            </div>
          </Panel>

          <Panel title="Conversation" aside={<button type="button" onClick={clearConversation} className="text-sm font-medium text-ultra hover:underline">Clear</button>}>
            <div ref={conversationRef} className="max-h-[480px] space-y-4 overflow-y-auto pr-1" aria-live="polite" aria-label="Conversation messages">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.who === "You" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-2xl px-4 py-3 ${message.who === "You" ? "bg-ultra text-white" : "bg-mist text-ink"}`}>
                    <div className={`text-sm font-semibold ${message.who === "You" ? "text-ice" : "text-slate"}`}>{message.who}</div>
                    <p className="mt-1 text-[0.98rem] leading-relaxed">{message.text}</p>
                    {message.simulation && (
                      <div className="mt-3 border-t border-ink/15 pt-3 text-sm">
                        <div className="font-semibold">Scenario evidence · {message.simulation.model_version}</div>
                        <div className="mt-1">Expected move: {formatPct(message.simulation.expected_move_pct)} · Heuristic range: {formatPct(message.simulation.p05)} to {formatPct(message.simulation.p95)}</div>
                        <div className="mt-1 text-xs opacity-75">{message.simulation.methodology_note}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-mist px-4 py-3 text-sm text-slate" role="status">Crisis Twin is thinking…</div>
                </div>
              )}
            </div>
          </Panel>
        </div>

        <Panel className="lg:order-3 lg:col-span-3" title="Advisors on the line">
          <ul className="space-y-4">
            {[
              { a: "bull", n: "Bull", s: "Ready to assess upside" },
              { a: "bear", n: "Bear", s: lastSpeaker === "Bear" ? "Just responded" : "Ready to challenge assumptions" },
              { a: "audit", n: "Risk Auditor", s: lastSpeaker === "Risk Auditor" ? "Just responded" : "Ready to check evidence" },
              { a: "pm", n: "Portfolio Manager", s: lastSpeaker === "Portfolio Manager" ? "Just responded" : "Ready to compare trade-offs" },
            ].map((advisor) => (
              <li key={advisor.a} className="flex items-center gap-3">
                <AgentMark agent={advisor.a} size={38} />
                <div>
                  <div className="font-semibold leading-tight">{advisor.n}</div>
                  <div className="text-sm text-slate">{advisor.s}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-slate">Replies can be spoken aloud using your browser voice. Simulation results use a transparent sector-sensitivity heuristic and are not calibrated forecasts.</p>
          <div className="mt-4"><Button href="/debate" variant="ghost" className="w-full">Read the debate</Button></div>
        </Panel>
      </div>
      <NextSteps href="/war-room" />
    </>
  );
}
