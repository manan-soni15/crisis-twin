"use client";

import { useState } from "react";

export default function Sliders({ items }) {
  const [vals, setVals] = useState(() => Object.fromEntries(items.map((i) => [i.id, i.value])));
  return (
    <div className="space-y-5">
      {items.map((i) => (
        <div key={i.id}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor={`s-${i.id}`} className="text-[0.95rem] font-medium">{i.label}</label>
            <span className="num text-[0.95rem] font-semibold text-ultra">
              {vals[i.id] > 0 && i.signed ? "+" : ""}{vals[i.id]}{i.unit}
            </span>
          </div>
          <input
            id={`s-${i.id}`}
            type="range"
            min={i.min}
            max={i.max}
            step={i.step ?? 1}
            value={vals[i.id]}
            onChange={(e) => setVals({ ...vals, [i.id]: Number(e.target.value) })}
            className="h-1.5 w-full cursor-pointer"
          />
          <div className="num mt-1 flex justify-between text-xs text-slate">
            <span>{i.min}{i.unit}</span>
            <span>{i.max}{i.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
