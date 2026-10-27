"use client";

import { useEffect, useRef, useState } from "react";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import VoiceOrb from "@/components/VoiceOrb";
import AgentMark from "@/components/AgentMark";
import { Panel, Button } from "@/components/ui";
import { Icon } from "@/components/Icons";

const COMMANDS = [
  "What happens if oil jumps 25% and rates go up a point?",
  "Bear, respond to that.",
  "Which holding is my biggest hidden risk?",
  "Rebalance to lower risk and show me before and after.",
  "Give me this morning's briefing.",
];

const INITIAL_MESSAGES = [
  {
    id: "welcome",
    who: "Crisis Twin",
    text: "The war room is ready. Try one of the suggested commands or type your own question below. Responses are demo examples for now; live AI and portfolio data will be connected in a later step.",
  },
];

function getDemoReply(rawText) {
  const text = rawText.toLowerCase();

  if (text.includes("bear") || text.includes("respond") || text.includes("challenge")) {
    return {
      who: "Bear",
      text: "My first question would be whether the portfolio is more concentrated than it appears. Before making a decision, I would inspect each holding's exposure and verify the stress-test numbers. This is a demo response, not a live portfolio analysis.",
    };
  }
  if (text.includes("hidden risk") || text.includes("biggest risk") || text.includes("risk contributor")) {
    return {
      who: "Risk Auditor",
      text: "To identify the largest hidden risk, we will compare concentration, factor exposure, and each holding's contribution to portfolio risk. The live calculation is not connected yet, so I won't name a holding without verified data.",
    };
  }
  if (text.includes("rebalance") || text.includes("trim") || text.includes("before and after")) {
    return {
      who: "Portfolio Manager",
      text: "I can help compare a lower-risk allocation, but a real before-and-after recommendation must be calculated by the quant engine. That integration is not connected yet, so no portfolio changes have been made.",
    };
  }
  if (text.includes("briefing") || text.includes("this morning") || text.includes("summary")) {
    return {
      who: "Crisis Twin",
      text: "Briefing mode will summarize the latest market context, portfolio exposures, and active scenario risks. Live market data is not connected in this first milestone, so this is only a preview of the intended workflow.",
    };
  }
  if (text.includes("oil") || text.includes("rate") || text.includes("scenario") || text.includes("what if")) {
    return {
      who: "Crisis Twin",
      text: "Scenario received. In the full workflow, Crisis Twin will turn this into structured shocks, send them to the simulator, and return the estimated portfolio move and uncertainty range. For now, the simulator is not connected and no impact has been calculated.",
    };
  }
  return {
    who: "Crisis Twin",
    text: "I received your request. In this first milestone, I can demonstrate the conversation flow with sample responses. Scenario parsing, live AI reasoning, and portfolio actions will be added in later steps.",
  };
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

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  useEffect(() => {
    setVoiceSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
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

  function sendCommand(value) {
    const command = value.trim();
    if (!command || isProcessing) return;

    const userMessage = { id: `msg-${messages.length + 1}-user`, who: "You", text: command };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsProcessing(true);

    timerRef.current = setTimeout(() => {
      const reply = getDemoReply(command);
      setMessages((current) => [...current, { id: `msg-${current.length + 1}-reply`, ...reply }]);
      setLastSpeaker(reply.who);
      setIsProcessing(false);
    }, 450);
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
        description="Run the whole simulator by talking. Ask a question, interrupt an advisor, or give a command, and hear the answer in the advisor's own voice."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-3 lg:order-1" title="Try a command">
          <p className="mb-4 text-sm leading-relaxed text-slate">Choose a prompt to test the conversation. Replies are sample responses in this first step.</p>
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
            <div className="mt-3 text-center text-xs text-ice/60">{isListening ? "Microphone active · pause when finished" : isProcessing ? "Preparing a demo response…" : "Voice input + typed commands · demo responses only"}</div>
          </Panel>

          <Panel title="Conversation" aside={<button type="button" onClick={clearConversation} className="text-sm font-medium text-ultra hover:underline">Clear</button>}>
            <div ref={conversationRef} className="max-h-[480px] space-y-4 overflow-y-auto pr-1" aria-live="polite" aria-label="Conversation messages">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.who === "You" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-2xl px-4 py-3 ${message.who === "You" ? "bg-ultra text-white" : "bg-mist text-ink"}`}>
                    <div className={`text-sm font-semibold ${message.who === "You" ? "text-ice" : "text-slate"}`}>{message.who}</div>
                    <p className="mt-1 text-[0.98rem] leading-relaxed">{message.text}</p>
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
          <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-slate">Use the microphone to speak a command or type it below. Speech recognition depends on browser support and microphone permission. Spoken replies will be added in a later milestone.</p>
          <div className="mt-4"><Button href="/debate" variant="ghost" className="w-full">Read the debate</Button></div>
        </Panel>
      </div>
      <NextSteps href="/war-room" />
    </>
  );
}
