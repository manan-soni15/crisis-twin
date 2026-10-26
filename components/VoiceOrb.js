"use client";

import { useState } from "react";
import { Icon } from "@/components/Icons";

// Presentational only. Wire your speech-to-text start/stop to `toggle`.
export default function VoiceOrb() {
  const [on, setOn] = useState(false);
  const toggle = () => setOn((v) => !v);
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="relative grid h-[220px] w-[220px] place-items-center">
        {on && (
          <svg viewBox="0 0 220 220" className="absolute inset-0" aria-hidden="true">
            {[0, 0.8, 1.6].map((d) => (
              <circle key={d} className="orb-ring" cx="110" cy="110" r="68" fill="none" stroke="#cbd8ff" strokeWidth="1.5" style={{ "--d": `${d}s` }} />
            ))}
          </svg>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-pressed={on}
          aria-label={on ? "Stop listening" : "Start listening"}
          className={`relative grid h-[136px] w-[136px] place-items-center rounded-full text-white transition-colors ${on ? "bg-ember text-ink" : "bg-ultra hover:bg-ultra-deep"}`}
        >
          <Icon name="mic" size={46} strokeWidth={1.5} />
        </button>
      </div>
      <div className="mt-2 flex h-10 items-center justify-center gap-1" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            className={`w-1 rounded-full bg-ice ${on ? "bar-live" : ""}`}
            style={{ height: on ? `${10 + ((i * 37) % 26)}px` : "4px", "--d": `${(i % 7) * 0.11}s`, opacity: on ? 0.9 : 0.4 }}
          />
        ))}
      </div>
      <p className="head mt-3 text-[1.5rem] text-white" aria-live="polite">{on ? "Listening" : "Tap to talk"}</p>
      <p className="mt-1 max-w-[36ch] text-[0.95rem] text-ice/75">
        {on ? "Say a crisis, ask an advisor, or give a command." : "Or type below if you cannot use a microphone."}
      </p>
    </div>
  );
}
