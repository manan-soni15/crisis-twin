"use client";

import { useState, useEffect } from "react";

export default function Segmented({ options, initial, value, onChange, label, className = "" }) {
  const [internalVal, setInternalVal] = useState(initial ?? options[0]);

  useEffect(() => {
    if (value !== undefined) {
      setInternalVal(value);
    }
  }, [value]);

  const current = value !== undefined ? value : internalVal;

  const handleClick = (o) => {
    if (value === undefined) {
      setInternalVal(o);
    }
    onChange?.(o);
  };

  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-full border border-line bg-mist p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={current === o}
          onClick={() => handleClick(o)}
          className={`rounded-full px-3.5 py-1.5 text-[0.9rem] font-semibold transition-colors ${current === o ? "bg-ink text-white" : "text-slate hover:text-ink"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
