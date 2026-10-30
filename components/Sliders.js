"use client";

import { useState, useEffect } from "react";

export default function Sliders({ items, values, onChange }) {
  const [internalVals, setInternalVals] = useState(() => Object.fromEntries(items.map((i) => [i.id, i.value])));

  useEffect(() => {
    if (values) {
      setInternalVals(values);
    }
  }, [values]);

  const vals = values ?? internalVals;

  const handleChange = (id, numVal) => {
    const updated = { ...vals, [id]: numVal };
    if (!values) {
      setInternalVals(updated);
    }
    onChange?.(updated, id, numVal);
  };

  return (
    <div className="space-y-5">
      {items.map((i) => {
        const curVal = vals[i.id] ?? i.value ?? 0;
        return (
          <div key={i.id}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor={`s-${i.id}`} className="text-[0.95rem] font-medium">{i.label}</label>
              <span className="num text-[0.95rem] font-semibold text-ultra">
                {curVal > 0 && i.signed ? "+" : ""}{curVal}{i.unit}
              </span>
            </div>
            <input
              id={`s-${i.id}`}
              type="range"
              min={i.min}
              max={i.max}
              step={i.step ?? 1}
              value={curVal}
              onChange={(e) => handleChange(i.id, Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer"
            />
            <div className="num mt-1 flex justify-between text-xs text-slate">
              <span>{i.min}{i.unit}</span>
              <span>{i.max}{i.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
