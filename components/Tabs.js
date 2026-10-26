"use client";

import { useState, useId } from "react";

// Tabs: pass `panels` as { [id]: JSX } from a server component.
export default function Tabs({ items, panels, initial, variant = "pill", label = "Options" }) {
  const [active, setActive] = useState(initial ?? items[0].id);
  const uid = useId();
  return (
    <div>
      <div role="tablist" aria-label={label} className="scroll-x mb-5 flex gap-1.5 pb-1">
        {items.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              id={`${uid}-${t.id}`}
              aria-selected={on}
              aria-controls={`${uid}-p-${t.id}`}
              type="button"
              onClick={() => setActive(t.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[0.92rem] font-semibold transition-colors ${
                on ? "bg-ink text-white" : "border border-line bg-bone text-slate hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${uid}-p-${active}`} aria-labelledby={`${uid}-${active}`}>
        {panels[active]}
      </div>
    </div>
  );
}
