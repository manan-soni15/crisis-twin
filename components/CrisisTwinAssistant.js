"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/Icons";
import { FLAT } from "@/lib/nav";


function cleanSpokenText(value = "") {
  return String(value).replace(/[*_`#>|]/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
}

function findNavigationCommand(text) {
  const q = text.toLowerCase().replace(/\b(crisis twin|hey crisis twin|please|could you|can you|open|show me|take me to|navigate to|go to|switch to|bring up|display)\b/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const aliases = [
    ["/dashboard", /\b(overview|dashboard|home|portfolio summary|portfolio)\b/],
    ["/holdings", /\b(holdings|my stocks|positions|what i own)\b/],
    ["/simulator", /\b(simulator|crisis twin simulator|stress test|run a simulation|simulate)\b/],
    ["/propagation", /\b(propagation|propagation map|shock map|contagion map|shock spread)\b/],
    ["/debate", /\b(debate room|debate|bull and bear|advisor debate)\b/],
    ["/war-room", /\b(voice war room|war room|voice assistant)\b/],
    ["/drill", /\b(crisis drill|start drill|begin drill|training drill)\b/],
    ["/replay", /\b(regret replay|replay|historical crash|crash replay)\b/],
    ["/report", /\b(report card|report|reports|export report)\b/],
    ["/audit", /\b(audit trail|audit|activity log|history of runs)\b/],
    ["/why", /\b(why it moved|why did it move|attribution|explain the move)\b/],
    ["/profile", /\b(risk profile|my risk profile|risk tolerance|profile settings)\b/],
  ];
  for (const [href, pattern] of aliases) if (pattern.test(q)) return FLAT.find((item) => item.href === href);
  return null;
}

function isActionOrQuestion(text) {
  return /\b(run|simulate|stress|what if|what happens|biggest risk|biggest holding|highest holding|largest holding|exposure|portfolio|inflation|recession|oil|interest rate|market falls|brief me|compare|explain|why|how much|how could|analy[sz]e|risk)\b/i.test(text);
}

export default function CrisisTwinAssistant() {
  const router = useRouter();
  const pathname = usePathname();
  const recognitionRef = useRef(null);
  const historyRef = useRef([]);
  const conversationEpochRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Ready when you are.");
  const [messages, setMessages] = useState([{ id: "welcome", role: "assistant", text: "I'm Crisis Twin. Start listening, then say “Crisis Twin, open propagation map,” ask about your portfolio, or ask me to run a scenario." }]);
  const [voiceSupported, setVoiceSupported] = useState(false);

  useEffect(() => {
    const supported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    setVoiceSupported(supported);
    historyRef.current = [];
    return () => { try { recognitionRef.current?.stop(); } catch {} };
  }, []);

  const persist = useCallback(async (items) => {
    historyRef.current = items.slice(-12);
    try {
      await fetch("/api/assistant/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: items.slice(-2), page: pathname }) });
    } catch { /* Local history remains available if persistence fails. */ }
  }, [pathname]);

  const speak = useCallback((text) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanSpokenText(text));
    utterance.rate = 1.02;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }, []);

  const shouldOfferSave = (question, answer, payload = {}) => {
    const q = String(question || "");
    const a = String(answer || "");
    const toolCalls = Array.isArray(payload.tool_calls) ? payload.tool_calls : [];
    return /\b(simulat|stress test|shock|scenario|crisis|risk|exposure|propagat|inflation|recession|portfolio|market fall|replay|drill|holding|drawdown)\b/i.test(q)
      || /\b(simulat|stress test|scenario|shock|portfolio impact|expected move|estimated loss|risk exposure|propagation)\b/i.test(a)
      || toolCalls.some((tool) => /stress|simulat|propagat|portfolio/i.test(typeof tool === "string" ? tool : JSON.stringify(tool)));
  };

  const addMessage = useCallback((role, text, extra = {}) => {
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, text: cleanSpokenText(text), at: new Date().toISOString(), ...extra };
    setMessages((previous) => {
      const next = [...previous, item].slice(-16);
      void persist(next.filter((m) => m.id !== "welcome"));
      return next;
    });
    return item;
  }, [persist]);

  const processCommand = useCallback(async (raw) => {
    const text = String(raw || "").trim().replace(/^(hey\s+)?crisis twin[,:\s-]*/i, "").trim();
    if (!text) return;
    const requestEpoch = conversationEpochRef.current;
    addMessage("user", raw.trim());
    setBusy(true);
    setStatus("Understanding your command…");
    try {
      const destination = findNavigationCommand(text);
      const isNavigationOnly = destination && !isActionOrQuestion(text.replace(new RegExp(destination.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), ""));
      if (destination && (isNavigationOnly || /\b(open|show|navigate|go to|take me|switch to|bring up|display)\b/i.test(text))) {
        router.push(destination.href);
        const answer = `Opening ${destination.label}. ${destination.blurb || ""}`;
        addMessage("assistant", answer, { action: "navigate", href: destination.href });
        speak(answer);
        setStatus(`Opened ${destination.label}.`);
        return;
      }
      if (/\b(start|begin|launch)\b.*\b(crisis )?drill\b/i.test(text)) {
        router.push("/drill");
        const answer = "Opening Crisis Drill. Start the drill on that page, then use the assistant to ask questions or return here for spoken commands.";
        addMessage("assistant", answer, { action: "navigate", href: "/drill" });
        speak(answer);
        setStatus("Crisis Drill opened.");
        return;
      }
      if (/\b(stop speaking|be quiet|stop talking|silence)\b/i.test(text)) {
        window.speechSynthesis?.cancel();
        setStatus("Speech stopped.");
        addMessage("assistant", "Stopped speaking.");
        return;
      }
      if (!isActionOrQuestion(text) && destination) {
        router.push(destination.href);
        const answer = `Opening ${destination.label}.`;
        addMessage("assistant", answer, { action: "navigate", href: destination.href });
        speak(answer);
        return;
      }
      setStatus("Checking saved portfolio data first…");
      const localResponse = await fetch("/api/assistant/insight", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }),
      });
      if (requestEpoch !== conversationEpochRef.current) return;
      const localPayload = await localResponse.json().catch(() => ({}));
      if (requestEpoch !== conversationEpochRef.current) return;
      if (localResponse.ok && localPayload.handled) {
        addMessage("assistant", localPayload.text, { source: "local", saveable: shouldOfferSave(text, localPayload.text), originalQuestion: text });
        speak(localPayload.text);
        setStatus("Answered from saved portfolio data.");
        return;
      }
      setStatus("Checking portfolio tools…");
      const response = await fetch("/api/intelligence/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: historyRef.current.slice(-8).map((m) => ({ role: m.role, text: m.text })) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (requestEpoch !== conversationEpochRef.current) return;
      if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status}).`);
      const answer = payload.text || payload.message || "I couldn't find a reliable answer from the available portfolio tools.";
      addMessage("assistant", answer, { source: payload.source || "assistant", tool_calls: payload.tool_calls || [], result: payload.result || payload.simulation || null, saveable: shouldOfferSave(text, answer, payload), originalQuestion: text, savedRun: false });
      speak(answer);
      setStatus(payload.source === "local" ? "Answered from local portfolio data." : "Answered using portfolio tools.");
    } catch (error) {
      if (requestEpoch !== conversationEpochRef.current) return;
      const message = error?.message || "I couldn't complete that request.";
      addMessage("assistant", message);
      speak(message);
      setStatus("Command failed. Check the API status and try again.");
    } finally { setBusy(false); }
  }, [addMessage, router, speak]);

  const saveToAuditAndReport = useCallback(async (message) => {
    if (!message || message.saving || message.savedRun) return;
    setMessages((previous) => previous.map((item) => item.id === message.id ? { ...item, saving: true, saveError: null } : item));
    try {
      const response = await fetch("/api/assistant/save-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: message.originalQuestion || "Portfolio analysis",
          answer: message.text,
          source: message.source || "assistant",
          tool_calls: message.tool_calls || [],
          result: message.result || null,
          created_at: message.at || new Date().toISOString(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || payload.message || "Could not save this result.");
      setMessages((previous) => previous.map((item) => item.id === message.id ? { ...item, saving: false, savedRun: true, savedRunId: payload.run.id } : item));
      setStatus("Saved to Audit Trail and Report Card.");
    } catch (error) {
      setMessages((previous) => previous.map((item) => item.id === message.id ? { ...item, saving: false, saveError: error.message || "Save failed." } : item));
      setStatus("Could not save this result. Check the server terminal and try again.");
    }
  }, []);

  const clearConversation = useCallback(() => {
    conversationEpochRef.current += 1;
    try { recognitionRef.current?.stop(); } catch {}
    try { window.speechSynthesis?.cancel(); } catch {}
    historyRef.current = [];
    setListening(false);
    setBusy(false);
    setInput("");
    setMessages([{ id: "welcome", role: "assistant", text: "I'm Crisis Twin. Start listening, then ask about your portfolio or give me a command." }]);
    setStatus("Conversation cleared. Ready when you are.");
  }, []);

  const startListening = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setStatus("Speech recognition isn't supported in this browser. Try Chrome or Edge."); return; }
    try { recognitionRef.current?.stop(); } catch {}
    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => { setListening(true); setStatus("Listening. Say “Crisis Twin” followed by a command, or simply ask a question."); };
    recognition.onerror = (event) => { setStatus(event.error === "not-allowed" ? "Microphone permission was denied." : `Speech recognition issue: ${event.error}.`); };
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (interim) setInput(interim);
      if (finalText.trim()) { setInput(""); void processCommand(finalText.trim()); }
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { setStatus("Couldn't start the microphone. Stop listening and try again."); }
  }, [processCommand]);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
    setStatus("Listening stopped.");
  }, []);

  return (
    <>
      <button type="button" onClick={() => { if (isOpen) { stopListening(); clearConversation(); setIsOpen(false); } else { setIsOpen(true); } }} className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-ultra px-4 py-3 font-semibold text-white shadow-2xl transition hover:scale-[1.02]" aria-label="Open Crisis Twin AI assistant">
        <span className={`grid h-7 w-7 place-items-center rounded-full ${listening ? "bg-ember" : "bg-white/15"}`}><Icon name="mic" size={17} /></span>
        <span>Crisis Twin AI</span>
        <span className={`h-2 w-2 rounded-full ${listening ? "animate-pulse bg-ember" : "bg-mint"}`} />
      </button>
      {isOpen && <section className="fixed bottom-[88px] right-4 z-[60] flex h-[min(690px,calc(100dvh-120px))] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-line bg-bone shadow-2xl" aria-label="Crisis Twin AI command center">
        <header className="flex items-center justify-between bg-ink px-4 py-3 text-white">
          <div><div className="font-semibold">Crisis Twin AI</div><div className="text-xs text-ice/70">Browser voice · portfolio tools · command navigation</div></div>
          <div className="flex items-center gap-1">
          <button type="button" onClick={clearConversation} className="rounded-lg px-2 py-2 text-xs hover:bg-white/10">Clear</button>
          <button type="button" onClick={() => { stopListening(); clearConversation(); setIsOpen(false); }} aria-label="Close assistant" className="rounded-lg p-2 hover:bg-white/10"><Icon name="close" size={18} /></button>
          </div>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
          {messages.slice(-10).map((message) => <div key={message.id} className={`max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed ${message.role === "user" ? "ml-auto bg-ultra text-white" : "mr-auto bg-white text-ink ring-1 ring-line"}`}>
            <div className="mb-1 text-[11px] font-semibold opacity-65">{message.role === "user" ? "You" : "Crisis Twin"}</div>{message.text}
            {message.href && <div className="mt-2 text-xs underline">Opened {message.href}</div>}
            {message.saveable && message.role === "assistant" && <div className="mt-3 border-t border-line/70 pt-2">
              {message.savedRun ? <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700"><span>Saved to Audit Trail and Report Card.</span><button type="button" onClick={() => router.push("/audit")} className="underline">View audit</button><button type="button" onClick={() => router.push("/report")} className="underline">View report</button></div> : <button type="button" disabled={message.saving} onClick={() => void saveToAuditAndReport(message)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-ultra hover:text-ultra disabled:opacity-60">{message.saving ? "Saving…" : "Save to Audit Trail & Report Card"}</button>}
              {message.saveError && <p className="mt-1 text-xs text-red-600">{message.saveError}</p>}
            </div>}
          </div>)}
        </div>
        <div className="border-t border-line bg-white p-3">
          <div className="mb-2 text-xs text-slate">{status}</div>
          <form onSubmit={(event) => { event.preventDefault(); const value = input.trim(); if (value) { setInput(""); void processCommand(value); } }} className="flex gap-2">
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Say or type a command…" className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-ultra" aria-label="Command to Crisis Twin AI" />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-ink px-3 text-white disabled:opacity-50" aria-label="Send command"><Icon name="send" size={17} /></button>
          </form>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={listening ? stopListening : startListening} disabled={busy} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${listening ? "bg-ember text-white" : "bg-ultra text-white"}`}><Icon name={listening ? "mic-off" : "mic"} size={16} />{listening ? "Stop listening" : "Start listening"}</button>
            <button type="button" onClick={() => { window.speechSynthesis?.cancel(); setStatus("Speech stopped."); }} className="rounded-xl border border-line px-3 py-2 text-sm">Stop speech</button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate">Tip: “Crisis Twin, open propagation map.” “What is my biggest holding?” “Run a severe oil shock.” Voice recognition requires this panel to be opened and listening started. No always-on wake-word detection.</p>
        </div>
      </section>}
    </>
  );
}
