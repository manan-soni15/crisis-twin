const SHAPES = {
  bull: { path: <path d="M12 5l7 13H5z" />, fill: "#1a2fd4", name: "Bull" },
  bear: { path: <path d="M12 19L5 6h14z" />, fill: "#ff5a2c", name: "Bear" },
  audit: { path: <rect x="6" y="6" width="12" height="12" rx="1.5" />, fill: "#1fa98a", name: "Risk Auditor" },
  pm: { path: <circle cx="12" cy="12" r="6.5" />, fill: "#0e1433", name: "Portfolio Manager" },
};

export const AGENTS = SHAPES;

export default function AgentMark({ agent, size = 36 }) {
  const s = SHAPES[agent];
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-white ring-1 ring-line" style={{ width: size, height: size }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill={s.fill} aria-hidden="true">{s.path}</svg>
    </span>
  );
}
