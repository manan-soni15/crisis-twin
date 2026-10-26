import Link from "next/link";

export function LogoMark({ size = 26, ring = "currentColor", dot = "#ff5a2c" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="12.5" cy="16" r="7" stroke={ring} strokeWidth="2" />
      <circle cx="19.5" cy="16" r="7" stroke={ring} strokeWidth="2" />
      <circle cx="16" cy="16" r="2.4" fill={dot} />
    </svg>
  );
}

export default function Logo({ href = "/", className = "", size = 26 }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Crisis Twin home">
      <LogoMark size={size} />
      <span className="head text-[1.18rem] leading-none" style={{ fontStretch: "84%" }}>
        Crisis Twin
      </span>
    </Link>
  );
}
