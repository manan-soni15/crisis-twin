// Small, dependency-free SVG chart primitives.

export function LineChart({
  series, // [{ values: number[], color, width, dash, label }]
  w = 640,
  h = 280,
  pad = { l: 44, r: 16, t: 16, b: 28 },
  yMin = 60,
  yMax = 104,
  yTicks = [60, 70, 80, 90, 100],
  xLabels = [],
  gap, // optional [indexA, indexB] shade between series 0 and 1
  className = "",
  grid = "#d2d7e3",
  text = "#4a5479",
}) {
  const n = series[0].values.length;
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const X = (i) => pad.l + (i / (n - 1)) * iw;
  const Y = (v) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * ih;
  const path = (vals) => vals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  let shade = null;
  if (series.length > 1 && gap !== false) {
    const a = series[0].values, b = series[1].values;
    shade = `${path(a)} ${b.map((v, i) => `L${X(n - 1 - i).toFixed(1)} ${Y(b[n - 1 - i]).toFixed(1)}`).join(" ")} Z`;
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`block w-full ${className}`} role="img" aria-label="Portfolio value over time, comparison chart">
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} stroke={grid} strokeWidth="1" />
          <text x={pad.l - 8} y={Y(t) + 4} textAnchor="end" fontSize="11" fill={text} className="num">{t}</text>
        </g>
      ))}
      {xLabels.map((l, i) => (
        <text key={l} x={pad.l + (i / (xLabels.length - 1)) * iw} y={h - 8} textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"} fontSize="11" fill={text}>{l}</text>
      ))}
      {shade && <path d={shade} fill="#1a2fd4" opacity="0.08" />}
      {series.map((s, i) => (
        <path key={i} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={s.width || 2.2} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </svg>
  );
}

export function Sparkline({ values, w = 120, h = 36, color = "#1a2fd4" }) {
  const min = Math.min(...values), max = Math.max(...values);
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * w).toFixed(1)} ${(h - 3 - ((v - min) / (max - min || 1)) * (h - 6)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block h-9 w-full" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Horizontal diverging bar: negative left (ember), positive right (mint).
export function DivergingBar({ value, max = 14 }) {
  const w = Math.min(Math.abs(value) / max, 1) * 50;
  const neg = value < 0;
  return (
    <div className="relative h-2.5 w-full rounded-full bg-mist" aria-hidden="true">
      <div className="absolute left-1/2 top-[-3px] h-[16px] w-px bg-slate/50" />
      <div
        className={`absolute top-0 h-full rounded-full ${neg ? "bg-ember" : "bg-mint"}`}
        style={neg ? { right: "50%", width: `${w}%` } : { left: "50%", width: `${w}%` }}
      />
    </div>
  );
}

// 5th..95th percentile range with expected marker.
export function RangeBar({ low, high, expected, min = -20, max = 0 }) {
  const pos = (v) => ((v - min) / (max - min)) * 100;
  return (
    <div className="relative h-14" role="img" aria-label={`Loss range ${low}% to ${high}%, expected ${expected}%`}>
      <div className="absolute left-0 right-0 top-6 h-2 rounded-full bg-mist" />
      <div className="absolute top-6 h-2 rounded-full bg-ember/35" style={{ left: `${pos(low)}%`, width: `${pos(high) - pos(low)}%` }} />
      <div className="absolute top-[18px] h-6 w-[3px] rounded-full bg-ember-deep" style={{ left: `calc(${pos(expected)}% - 1.5px)` }} />
      <div className="num absolute top-0 -translate-x-1/2 text-xs text-slate" style={{ left: `${pos(low)}%` }}>{low}%</div>
      <div className="num absolute top-0 -translate-x-1/2 text-xs text-slate" style={{ left: `${pos(high)}%` }}>{high}%</div>
      <div className="num absolute bottom-0 -translate-x-1/2 text-xs font-semibold text-ember-deep" style={{ left: `${pos(expected)}%` }}>{expected}%</div>
    </div>
  );
}

export function Ring({ value, size = 120, stroke = 10, color = "#1a2fd4", track = "#d2d7e3", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
