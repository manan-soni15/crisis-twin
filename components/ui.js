import Link from "next/link";
import { Icon } from "@/components/Icons";

export function Panel({ title, aside, children, tone = "plain", className = "", bodyClass = "" }) {
  const tones = {
    plain: "bg-bone border border-line text-ink",
    ink: "bg-ink text-ice border border-ink",
    ultra: "bg-ultra text-white border border-ultra",
    flat: "bg-transparent border border-line text-ink",
  };
  return (
    <section className={`rounded-[10px] ${tones[tone]} ${className}`}>
      {(title || aside) && (
        <header className="flex items-center justify-between gap-4 px-5 pt-4 pb-1">
          {title && <h2 className="head text-[1.05rem]" style={{ fontStretch: "92%" }}>{title}</h2>}
          {aside && <div className="text-sm opacity-80">{aside}</div>}
        </header>
      )}
      <div className={`px-5 pb-5 pt-3 ${bodyClass}`}>{children}</div>
    </section>
  );
}

const BTN = {
  primary: "bg-ultra text-white hover:bg-ultra-deep",
  ink: "bg-ink text-white hover:bg-ink-soft",
  light: "bg-white text-ink hover:bg-ice",
  ghost: "border border-line bg-transparent text-ink hover:bg-white",
  ghostDark: "border border-white/30 text-white hover:bg-white/10",
  ember: "bg-ember text-ink hover:bg-[#ff7048]",
};

export function Button({ href, variant = "primary", icon, children, className = "", ...rest }) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[0.95rem] font-semibold transition-colors ${BTN[variant]} ${className}`;
  const inner = (<>{children}{icon && <Icon name={icon} size={17} />}</>);
  if (href) return <Link href={href} className={cls} {...rest}>{inner}</Link>;
  return <button type="button" className={cls} {...rest}>{inner}</button>;
}

export function TextLink({ href, children, className = "" }) {
  return (
    <Link href={href} className={`group inline-flex items-center gap-1.5 font-semibold text-ultra hover:text-ultra-deep ${className}`}>
      {children}
      <Icon name="arrow" size={16} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function Readout({ label, value, note, tone = "ink", className = "" }) {
  const tones = { ink: "text-ink", loss: "text-ember-deep", gain: "text-mint-deep", ultra: "text-ultra" };
  return (
    <div className={className}>
      <div className="text-sm text-slate">{label}</div>
      <div className={`display num mt-1 text-[2.1rem] ${tones[tone]}`}>{value}</div>
      {note && <div className="mt-1 text-sm text-slate">{note}</div>}
    </div>
  );
}

export function Tag({ children, tone = "neutral" }) {
  const t = {
    neutral: "bg-mist text-slate border-line",
    loss: "bg-ember-soft text-ember-deep border-transparent",
    gain: "bg-mint-soft text-mint-deep border-transparent",
    ultra: "bg-ultra text-white border-transparent",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.8rem] font-medium ${t[tone]}`}>{children}</span>;
}

export function Meter({ value, max = 5, tone = "ultra" }) {
  const c = { ultra: "bg-ultra", ember: "bg-ember", mint: "bg-mint" }[tone];
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`h-3 w-1.5 rounded-[1px] ${i < value ? c : "bg-line"}`} />
      ))}
    </span>
  );
}

export function Path({ nodes, className = "" }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {nodes.map((n, i) => (
        <span key={n} className="inline-flex items-center gap-1">
          <span className="font-medium">{n}</span>
          {i < nodes.length - 1 && <Icon name="chevron" size={14} className="text-slate" />}
        </span>
      ))}
    </span>
  );
}
