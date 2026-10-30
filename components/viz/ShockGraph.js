"use client";

import { useState } from "react";
import { SHOCKS, SECTORS, HOLDINGS, SECTOR_IMPACT, ORIGIN, HIDDEN_LINKS, holdingImpact, pct } from "@/lib/sample";

const W = 680;
const H = 540;
const SH = { x: 14, w: 140, h: 40, cy: [108, 216, 324, 432] };
const SE = { x: 270, w: 130, h: 36 };
const HO = { x: 500, w: 166, h: 36 };
const rowY = (i) => 54 + i * 72;

const curve = (x1, y1, x2, y2) => {
  const m = (x1 + x2) / 2;
  return `M${x1} ${y1}C${m} ${y1} ${m} ${y2} ${x2} ${y2}`;
};

function litSet(focus, shock, holdingsList, hiddenList, sectorsList) {
  if (!focus) return null;
  const s = new Set([focus, shock]);
  const h = holdingsList.find((x) => x.id === focus);
  if (h) {
    s.add(h.sector);
    hiddenList.filter((l) => l.to === h.id).forEach((l) => s.add(l.from));
  }
  if (sectorsList.some((x) => x.id === focus)) {
    holdingsList.filter((x) => x.sector === focus).forEach((x) => s.add(x.id));
    hiddenList.filter((l) => l.from === focus).forEach((l) => s.add(l.to));
  }
  return s;
}

export default function ShockGraph({
  scenario = "oil",
  runKey = 0,
  interactive = false,
  loss = "#ff5a2c",
  gain = "#1fa98a",
  className = "text-ink",
  showRings = true,
  holdingsData,
  sectorImpactData,
  hiddenLinksData,
  shocksData,
}) {
  const holdingsList = holdingsData || HOLDINGS;
  const shocksList = shocksData || SHOCKS;
  const sectorsList = SECTORS;
  const impact = sectorImpactData || SECTOR_IMPACT[scenario] || SECTOR_IMPACT.oil;
  const hiddenList = hiddenLinksData || HIDDEN_LINKS;

  const [focus, setFocus] = useState(null);
  const lit = interactive ? litSet(focus, scenario, holdingsList, hiddenList, sectorsList) : null;
  const edgeLit = (a, b) => !lit || (lit.has(a) && lit.has(b));
  const nodeLit = (id) => !lit || lit.has(id);
  const col = (v) => (v < 0 ? loss : gain);
  const oi = ORIGIN[scenario] ?? Math.max(0, shocksList.findIndex((s) => s.id === scenario));
  const ox = SH.x + SH.w / 2;
  const oy = SH.cy[Math.min(oi, SH.cy.length - 1)] ?? SH.cy[0];
  const hold = (id) => holdingsList.findIndex((h) => h.id === id);
  const sIdx = (id) => sectorsList.findIndex((s) => s.id === id);

  const focusProps = (id) =>
    interactive
      ? {
          tabIndex: 0,
          onMouseEnter: () => setFocus(id),
          onMouseLeave: () => setFocus(null),
          onFocus: () => setFocus(id),
          onBlur: () => setFocus(null),
          style: { outline: "none", cursor: "default" },
        }
      : {};

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`sg block w-full ${className}`}
      style={{ overflow: "visible" }}
      role="img"
      aria-label={`Shock propagation for ${shocksList.find((s) => s.id === scenario)?.name || scenario}: from shock to sectors to holdings`}
    >
      <g key={`${scenario}-${runKey}`}>
        {/* origin ripples */}
        {showRings &&
          [0, 0.45, 0.9].map((d, i) => (
            <circle key={i} className="ring" cx={ox} cy={oy} r="26" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ "--d": `${d}s` }} />
          ))}

        {/* shock -> sector edges */}
        {sectorsList.map((s, i) => {
          const v = impact[s.id] ?? 0;
          if (Math.abs(v) < 1) return null;
          const wdt = 0.9 + (Math.min(Math.abs(v), 14) / 14) * 3.6;
          return (
            <path
              key={`e1-${s.id}`}
              className={`edge ${nodeLit(s.id) && edgeLit(scenario, s.id) ? "lit" : "dim"}`}
              d={curve(SH.x + SH.w, oy, SE.x, rowY(i))}
              pathLength="1"
              fill="none"
              stroke={col(v)}
              strokeWidth={wdt}
              strokeLinecap="round"
              style={{ "--d": `${0.2 + i * 0.05}s` }}
            />
          );
        })}

        {/* sector -> holding edges */}
        {holdingsList.map((h) => {
          const si = sIdx(h.sector);
          if (si === -1) return null;
          const v = impact[h.sector] ?? 0;
          if (Math.abs(v) < 1) return null;
          return (
            <path
              key={`e2-${h.id}`}
              className={`edge ${edgeLit(h.sector, h.id) ? "lit" : "dim"}`}
              d={curve(SE.x + SE.w, rowY(si), HO.x, rowY(hold(h.id)))}
              pathLength="1"
              fill="none"
              stroke={col(v)}
              strokeWidth={0.9 + (Math.min(Math.abs(v), 14) / 14) * 2.6}
              strokeLinecap="round"
              style={{ "--d": `${1 + si * 0.04}s` }}
            />
          );
        })}

        {/* hidden links */}
        {hiddenList.map((l) => {
          const v = impact[l.from] ?? 0;
          if (Math.abs(v) < 1) return null;
          const si = sIdx(l.from);
          const hi = hold(l.to);
          if (si === -1 || hi === -1) return null;
          return (
            <path
              key={`hid-${l.from}-${l.to}`}
              className={`val ${edgeLit(l.from, l.to) ? "lit" : "dim"}`}
              d={curve(SE.x + SE.w, rowY(si), HO.x, rowY(hi))}
              fill="none"
              stroke={loss}
              strokeWidth="1.6"
              strokeDasharray="4 5"
              strokeLinecap="round"
              style={{ "--d": "1.7s" }}
            />
          );
        })}

        {/* shock pills */}
        {shocksList.map((s, i) => {
          const active = i === oi || s.id === scenario;
          return (
            <g key={s.id} className={active ? "lit" : "dim"} style={!active ? { opacity: 0.55 } : undefined}>
              <rect
                className={active ? "pill" : ""}
                x={SH.x} y={SH.cy[i] - SH.h / 2} width={SH.w} height={SH.h} rx={SH.h / 2}
                fill="transparent" stroke="currentColor" strokeOpacity="0.4"
                style={{ "--c": loss, "--d": "0s" }}
              />
              <text
                className={active ? "pillText" : ""}
                x={SH.x + SH.w / 2} y={SH.cy[i] + 4.5} textAnchor="middle" fontSize="13.5" fontWeight="600" fill="currentColor"
                style={{ "--d": "0s" }}
              >
                {s.label}
              </text>
            </g>
          );
        })}

        {/* sector pills */}
        {sectorsList.map((s, i) => {
          const v = impact[s.id] ?? 0;
          const on = Math.abs(v) >= 1;
          const d = `${0.75 + i * 0.04}s`;
          return (
            <g key={s.id} className={nodeLit(s.id) ? "lit" : "dim"} {...focusProps(s.id)}>
              <rect
                className={on ? "pill" : ""}
                x={SE.x} y={rowY(i) - SE.h / 2} width={SE.w} height={SE.h} rx={SE.h / 2}
                fill="transparent" stroke="currentColor" strokeOpacity="0.4"
                style={{ "--c": col(v), "--d": d }}
              />
              <text className={on ? "pillText" : ""} x={SE.x + 14} y={rowY(i) + 4.5} fontSize="13" fontWeight="550" fill="currentColor" style={{ "--d": d }}>
                {s.label}
              </text>
              {on && (
                <text className="val num" x={SE.x + SE.w - 12} y={rowY(i) + 4.5} textAnchor="end" fontSize="12" fontWeight="650" fill="#0e1433" style={{ "--d": d }}>
                  {pct(v, 0)}
                </text>
              )}
            </g>
          );
        })}

        {/* holding pills */}
        {holdingsList.map((h, i) => {
          const v = h.impact_pct !== undefined ? h.impact_pct : holdingImpact(scenario, h);
          const on = Math.abs(v) >= 0.5;
          const d = `${1.35 + i * 0.05}s`;
          return (
            <g key={h.id} className={nodeLit(h.id) ? "lit" : "dim"} {...focusProps(h.id)}>
              <rect
                className={on ? "pill" : ""}
                x={HO.x} y={rowY(i) - HO.h / 2} width={HO.w} height={HO.h} rx={HO.h / 2}
                fill="transparent" stroke="currentColor" strokeOpacity="0.4"
                style={{ "--c": col(v), "--d": d }}
              />
              <text className={on ? "pillText" : ""} x={HO.x + 14} y={rowY(i) + 4.5} fontSize="13" fontWeight="550" fill="currentColor" style={{ "--d": d }}>
                {h.name}
              </text>
              {on && (
                <text className="val num" x={HO.x + HO.w - 12} y={rowY(i) + 4.5} textAnchor="end" fontSize="12.5" fontWeight="700" fill="#0e1433" style={{ "--d": d }}>
                  {pct(v)}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
