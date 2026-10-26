"use client";

import { useState } from "react";

export default function Segmented({ options, initial, label, className = "" }) {
  const [v, setV] = useState(initial ?? options[0]);
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-full border border-line bg-mist p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={v === o}
          onClick={() => setV(o)}
          className={`rounded-full px-3.5 py-1.5 text-[0.9rem] font-semibold transition-colors ${v === o ? "bg-ink text-white" : "text-slate hover:text-ink"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
