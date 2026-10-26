import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import Segmented from "@/components/Segmented";
import { Panel, Readout } from "@/components/ui";

export const metadata = { title: "Why it moved" };

const BARS = [
  { n: "IndiGo", v: -1.4 },
  { n: "HDFC Bank", v: -0.9 },
  { n: "Tata Motors", v: -0.7 },
  { n: "ITC", v: -0.2 },
  { n: "Infosys", v: -0.2 },
  { n: "Sun Pharma", v: -0.1 },
  { n: "Reliance", v: 0.4 },
];

function Waterfall() {
  const w = 680, h = 300, padL = 44, padR = 12, padT = 16, padB = 46;
  const items = [...BARS, { n: "Total", total: true }];
  const total = BARS.reduce((s, b) => s + b.v, 0);
  const min = -3.6, max = 0.8;
  const Y = (v) => padT + (1 - (v - min) / (max - min)) * (h - padT - padB);
  const slot = (w - padL - padR) / items.length;
  let cum = 0;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block w-full" role="img" aria-label="Waterfall of each holding's contribution to the day's move">
      {[0, -1, -2, -3].map((t) => (
        <g key={t}>
          <line x1={padL} x2={w - padR} y1={Y(t)} y2={Y(t)} stroke={t === 0 ? "#4a5479" : "#d2d7e3"} strokeWidth="1" />
          <text x={padL - 8} y={Y(t) + 4} textAnchor="end" fontSize="11" fill="#4a5479" className="num">{t}%</text>
        </g>
      ))}
      {items.map((b, i) => {
        const x = padL + i * slot + slot * 0.16;
        const bw = slot * 0.68;
        let top, bot, fill;
        if (b.total) { top = Y(0); bot = Y(total); fill = "#0e1433"; }
        else { const a = cum, z = cum + b.v; cum = z; top = Y(Math.max(a, z)); bot = Y(Math.min(a, z)); fill = b.v < 0 ? "#ff5a2c" : "#1fa98a"; }
        const val = b.total ? total : b.v;
        return (
          <g key={b.n}>
            <rect x={x} y={top} width={bw} height={Math.max(bot - top, 2)} rx="2" fill={fill} />
            <text x={x + bw / 2} y={bot + 15} textAnchor="middle" fontSize="11.5" fontWeight="650" fill="#0e1433" className="num">{val > 0 ? "+" : "\u2212"}{Math.abs(val).toFixed(1)}</text>
            <text x={x + bw / 2} y={h - 14} textAnchor="middle" fontSize="11" fill="#4a5479">{b.n}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Page() {
  return (
    <>
      <PageHeader
        title="Why it moved"
        description="Pick a day and see which holdings and causes drove the change, with a plain-language story and a verdict on whether it matters."
        actions={<Segmented label="Day" options={["Today", "Worst day this month", "Pick a date"]} initial="Worst day this month" />}
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="Contribution by holding" aside="Percentage points of portfolio move">
          <div className="scroll-x"><div className="min-w-[560px]"><Waterfall /></div></div>
        </Panel>
        <div className="space-y-5 lg:col-span-4">
          <Panel title="Portfolio move">
            <Readout label="On the day" value={"\u22123.1%"} tone="loss" note={"Market index: \u22122.4%"} />
          </Panel>
          <Panel title="Is it worth acting on?">
            <div className="grid grid-cols-3 gap-1.5 text-center text-[0.85rem] font-semibold" role="radiogroup" aria-label="Verdict">
              {["Noise", "Temporary shock", "Structural risk"].map((v, i) => (
                <span key={v} role="radio" aria-checked={i === 1} className={`rounded-lg px-1.5 py-2.5 ${i === 1 ? "bg-ink text-white" : "bg-mist text-slate"}`}>{v}</span>
              ))}
            </div>
            <p className="mt-4 text-[0.95rem] text-slate">Most of the fall traces to an oil spike that is already fading. The airline and auto losses are the part to watch.</p>
          </Panel>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-7" title="The story">
          <p className="serif text-[1.3rem] leading-snug">
            Crude jumped overnight, and the rupee weakened against the dollar. IndiGo took the largest hit because fuel is a big part of an airline&rsquo;s costs. HDFC Bank and Tata Motors fell together, which shows how closely they are tied through auto lending. Reliance was the only holding that gained.
          </p>
        </Panel>
        <Panel className="lg:col-span-5" title="Drivers" bodyClass="!px-0 !pb-2">
          <table className="w-full text-left text-[0.95rem]">
            <thead className="text-sm text-slate"><tr className="border-b border-line"><th className="px-5 py-2 font-medium">Cause</th><th className="py-2 text-right font-medium">Moved</th><th className="px-5 py-2 text-right font-medium">Share of loss</th></tr></thead>
            <tbody>
              {[["Oil price", "+4.2%", "46%"], ["Rupee vs dollar", "+0.8%", "14%"], ["Bond yields", "+9 bps", "22%"], ["Company news", "Mixed", "18%"]].map(([a, b, c]) => (
                <tr key={a} className="border-b border-line/70 last:border-0"><td className="px-5 py-2.5 font-medium">{a}</td><td className="num py-2.5 text-right">{b}</td><td className="num px-5 py-2.5 text-right">{c}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <NextSteps href="/why" />
    </>
  );
}
