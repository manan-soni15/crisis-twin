import Link from "next/link";
import { Icon } from "@/components/Icons";
import { Button, TextLink } from "@/components/ui";
import { LineChart } from "@/components/viz/Charts";
import Logo from "@/components/Logo";
import { FLAT, NAV } from "@/lib/nav";
import { crisisCurve } from "@/lib/sample";

export function Pitch() {
  return (
    <section className="wrap grid gap-10 py-24 md:grid-cols-12 md:py-32">
      <p className="serif text-[clamp(1.9rem,3.6vw,3.1rem)] leading-[1.16] tracking-[-0.01em] md:col-span-8">
        Pilots rehearse engine failure in a simulator, because the air is a bad place to learn. Investors learn about crashes with real money. Crisis Twin gives your portfolio the simulator.
      </p>
      <div className="flex flex-col justify-end gap-5 md:col-span-4">
        <p className="text-[1.05rem] leading-relaxed text-slate">
          Most tools tell you what to buy. Crisis Twin shows you what could break, why it matters, and how a different decision would change the outcome, before anything is at stake.
        </p>
        <TextLink href="/simulator">Try the simulator</TextLink>
      </div>
    </section>
  );
}

export function Features() {
  const rows = FLAT.filter((r) => !["/dashboard", "/holdings"].includes(r.href));
  return (
    <section id="features" className="wrap scroll-mt-24 pb-24 md:pb-32">
      <h2 className="display mb-10 max-w-[18ch] text-[clamp(2.4rem,5vw,4rem)]">Everything you need to rehearse a crisis.</h2>
      <ul className="border-b border-line">
        {rows.map((r) => (
          <li key={r.href} className="border-t border-line">
            <Link href={r.href} className="group grid items-center gap-2 px-2 py-6 transition-colors hover:bg-ultra hover:text-white md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] md:gap-8 md:px-5">
              <span className="flex items-center gap-4">
                <Icon name={r.icon} size={26} className="text-ultra transition-colors group-hover:text-ice" />
                <span className="head text-[clamp(1.5rem,2.6vw,2.1rem)]">{r.label}</span>
              </span>
              <span className="text-[1.02rem] text-slate transition-colors group-hover:text-ice">{r.blurb}</span>
              <span className="hidden items-center gap-1.5 text-[0.95rem] font-semibold md:inline-flex">
                Open <Icon name="arrow" size={16} className="transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Voice({ who, role, tone, align = "left", children, evidence }) {
  const tones = {
    bull: "border-ice/40 text-white",
    bear: "border-ember/70 text-white",
    audit: "border-mint/70 text-white",
  };
  const shape = {
    bull: <path d="M12 5l7 13H5z" fill="#cbd8ff" />,
    bear: <path d="M12 19L5 6h14z" fill="#ff5a2c" />,
    audit: <rect x="6" y="6" width="12" height="12" rx="1.5" fill="#62e6c3" />,
  }[tone];
  return (
    <div className={`flex ${align === "right" ? "md:justify-end" : align === "center" ? "md:justify-center" : ""}`}>
      <div className={`max-w-[62ch] border-l-2 pl-5 ${tones[tone]} ${align === "right" ? "md:border-l-0 md:border-r-2 md:pl-0 md:pr-5 md:text-right" : ""}`}>
        <div className={`mb-2 flex items-center gap-2 ${align === "right" ? "md:justify-end" : ""}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">{shape}</svg>
          <span className="head text-lg">{who}</span>
          <span className="text-sm text-ice/60">{role}</span>
        </div>
        <p className="serif text-[1.3rem] leading-snug text-ice">{children}</p>
        {evidence && <p className="mt-2 text-sm text-ice/55">Evidence: {evidence}</p>}
      </div>
    </div>
  );
}

export function DebateBand() {
  return (
    <section id="debate" className="scroll-mt-10 bg-ink py-24 text-ice md:py-32">
      <div className="wrap">
        <div className="mb-14 grid gap-6 md:grid-cols-12">
          <h2 className="display text-[clamp(2.4rem,5vw,4rem)] text-white md:col-span-7">Three advisors who disagree on purpose.</h2>
          <p className="max-w-[44ch] text-[1.05rem] leading-relaxed md:col-span-4 md:col-start-9 md:self-end">
            A Bull proposes, a Bear attacks, and an independent Risk Auditor checks the math. You see the disagreement instead of one confident answer.
          </p>
        </div>
        <div className="space-y-10">
          <Voice who="Bull" role="Finds opportunity" tone="bull" evidence="sector_impact.energy, holding_impact.reliance">
            Airlines fall 12%, but Reliance rises 4.6% and almost cancels it at portfolio level. Hold the line and add to refiners.
          </Voice>
          <Voice who="Bear" role="Attacks the plan" tone="bear" align="right" evidence="holding_impact.indigo, correlation_in_stress">
            If crude stays high for a month, the offset fades and IndiGo keeps falling. You are leaning on one winner to carry the whole portfolio.
          </Voice>
          <Voice who="Risk Auditor" role="Checks hidden exposure" tone="audit" align="center" evidence="risk_contribution.autos_banks">
            HDFC Bank and Tata Motors share the same auto-credit risk, and together they are 32% of the portfolio. I disagree with holding both at full size.
          </Voice>
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-between gap-5 border-t border-white/15 pt-6">
          <p className="max-w-[60ch] text-[1.05rem]">
            <span className="font-semibold text-white">Portfolio Manager.</span> Trim autos by four points, keep energy, add a defensive holding. Expected loss moves from 1.7% to 1.5%. The Bear wanted a larger trim, and that dissent stays on the record.
          </p>
          <Button href="/debate" variant="light" icon="arrow">Open the debate room</Button>
        </div>
      </div>
    </section>
  );
}

export function VoiceBand() {
  const bars = Array.from({ length: 72 }, (_, i) => {
    const env = Math.sin((i / 71) * Math.PI);
    const h = 8 + env * (26 + Math.abs(Math.sin(i * 1.37)) * 52 + Math.abs(Math.sin(i * 0.41)) * 22);
    return Math.round(h);
  });
  return (
    <section id="voice" className="wrap scroll-mt-10 py-24 md:py-32">
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 className="display text-[clamp(2.4rem,5vw,4rem)]">Say the crisis out loud.</h2>
          <p className="mt-5 max-w-[44ch] text-[1.05rem] leading-relaxed text-slate">
            Ask, interrupt and command by voice. The advisors answer in their own voices, so you can hear them disagree and cut in when you want to push back.
          </p>
          <ul className="mt-6 space-y-2 text-[1.02rem]">
            <li>&ldquo;Bear, respond to that.&rdquo;</li>
            <li>&ldquo;Rebalance to lower risk and show me before and after.&rdquo;</li>
            <li>&ldquo;Give me this morning&rsquo;s briefing.&rdquo;</li>
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/war-room" icon="mic">Open the war room</Button>
            <Button href="/drill" variant="ghost">Start a crisis drill</Button>
          </div>
        </div>
        <div className="lg:col-span-7">
          <div className="rounded-[14px] bg-ink p-6 md:p-8">
            <svg viewBox="0 0 720 150" className="block w-full" aria-hidden="true">
              {bars.map((h, i) => (
                <rect key={i} x={i * 10 + 2} y={75 - h / 2} width="5" height={h} rx="2.5" fill={i > 40 && i < 47 ? "#ff5a2c" : "#cbd8ff"} opacity={i > 40 && i < 47 ? 1 : 0.75} />
              ))}
            </svg>
            <p className="serif mt-6 text-[1.55rem] leading-snug text-white">
              &ldquo;What happens to my portfolio if oil jumps twenty-five percent and rates go up a full point?&rdquo;
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Proof() {
  const raw = crisisCurve(28.5, 0.5);
  const adj = crisisCurve(11.5, 0.3);
  const lossRaw = Math.round(100 - Math.min(...raw));
  const lossAdj = Math.round(100 - Math.min(...adj));
  return (
    <section id="proof" className="scroll-mt-10 bg-bone py-24 md:py-32">
      <div className="wrap grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 className="display text-[clamp(2.4rem,5vw,4rem)]">Replay history, with and without the simulator.</h2>
          <p className="mt-5 max-w-[44ch] text-[1.05rem] leading-relaxed text-slate">
            Regret Replay re-runs real crashes. It fits the model on data from before the event, applies the suggested adjustments, and shows what would have changed. Where the model missed, it says so.
          </p>
          <div className="mt-8 grid max-w-[420px] grid-cols-2 gap-6 border-t border-line pt-6">
            <div>
              <div className="display num text-[3.2rem] text-ember-deep">&minus;{lossRaw}%</div>
              <div className="mt-1 text-sm text-slate">Unprotected portfolio at the low point</div>
            </div>
            <div>
              <div className="display num text-[3.2rem] text-ultra">&minus;{lossAdj}%</div>
              <div className="mt-1 text-sm text-slate">With Crisis Twin adjustments</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate">Illustrative sample data.</p>
          <div className="mt-6"><TextLink href="/replay">Open regret replay</TextLink></div>
        </div>
        <div className="lg:col-span-7">
          <div className="rounded-[14px] border border-line bg-white p-4 md:p-6">
            <div className="mb-3 flex flex-wrap gap-5 text-sm">
              <span className="inline-flex items-center gap-2"><span className="h-0.5 w-6 bg-ink" />Unprotected</span>
              <span className="inline-flex items-center gap-2"><span className="h-0.5 w-6 bg-ultra" />With Crisis Twin</span>
            </div>
            <LineChart
              series={[{ values: raw, color: "#0e1433", width: 2 }, { values: adj, color: "#1a2fd4", width: 2.8 }]}
              xLabels={["Day 0", "Day 15", "Day 30", "Day 45", "Day 60"]}
              yMin={64} yMax={104} yTicks={[70, 80, 90, 100]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { t: "Describe the shock", d: "Type or say what could happen, or pick a ready-made crisis.", href: "/simulator" },
  { t: "Watch it spread", d: "See the shock move through sectors and into your holdings.", href: "/propagation" },
  { t: "Hear the debate", d: "Bull, Bear and Auditor argue the response and show their evidence.", href: "/debate" },
  { t: "Compare and decide", d: "Check before and after, then save a report card of the result.", href: "/report" },
];

export function How() {
  return (
    <section id="how" className="wrap scroll-mt-10 py-24 md:py-32">
      <h2 className="display max-w-[16ch] text-[clamp(2.4rem,5vw,4rem)]">From &ldquo;what if&rdquo; to a decision in four steps.</h2>
      <ol className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
        <div className="absolute left-0 right-0 top-[15px] hidden h-px bg-line md:block" aria-hidden="true" />
        {STEPS.map((s, i) => (
          <li key={s.t} className="relative">
            <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full bg-ultra text-sm font-bold text-white">{i + 1}</span>
            <h3 className="head mt-5 text-[1.45rem]">{s.t}</h3>
            <p className="mt-2 max-w-[30ch] text-slate">{s.d}</p>
            <Link href={s.href} className="mt-3 inline-block font-semibold text-ultra hover:text-ultra-deep">Open</Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-ink text-ice">
      <div className="wrap py-20">
        <div className="flex flex-wrap items-end justify-between gap-8 border-b border-white/15 pb-14">
          <h2 className="display max-w-[14ch] text-[clamp(2.6rem,6vw,5rem)] text-white">Find out how risky you are before the crash.</h2>
          <Button href="/dashboard" variant="light" icon="arrow">Open the console</Button>
        </div>
        <div className="grid gap-10 pt-12 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-1">
            <div className="text-white"><Logo /></div>
          </div>
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="mb-3 text-sm text-ice/55">{g.group}</div>
              <ul className="space-y-2">
                {g.items.map((i) => (
                  <li key={i.href}><Link href={i.href} className="text-[0.95rem] text-ice hover:text-white">{i.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-14 max-w-[70ch] text-sm leading-relaxed text-ice/60">
          Crisis Twin is a simulation and decision-support tool. It does not give financial advice, and it never places real trades. Results depend on historical data and models that cannot capture every kind of market event.
        </p>
      </div>
    </footer>
  );
}
