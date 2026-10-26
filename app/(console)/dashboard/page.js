import Link from "next/link";
import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import { Panel, Readout, Tag, TextLink, Button } from "@/components/ui";
import { DivergingBar } from "@/components/viz/Charts";
import { HOLDINGS, SECTORS, PORTFOLIO_VALUE, SHOCKS, inr, pct, holdingImpact } from "@/lib/sample";

export const metadata = { title: "Overview" };

const SECTOR_COLORS = ["#1a2fd4", "#4a5de0", "#8c9bf0", "#0e1433", "#1fa98a", "#ff5a2c", "#cbd8ff"];

const combined = (h) => Math.round((holdingImpact("oil", h) + holdingImpact("rates", h)) * 10) / 10;
const lastLoss = Math.round(HOLDINGS.reduce((s, h) => s + (h.weight / 100) * combined(h), 0) * 10) / 10;
const dayMove = Math.round(HOLDINGS.reduce((s, h) => s + (h.weight / 100) * h.day, 0) * 10) / 10;

const RUNS = [
  { name: "Oil +25% and rates +100 bps", range: "\u22126.8% to \u22121.9%", score: 72, when: "Today" },
  { name: "Geopolitical conflict", range: "\u22127.9% to \u22122.6%", score: 66, when: "Yesterday" },
  { name: "Auto-sector scandal", range: "\u22123.4% to \u22120.9%", score: 84, when: "3 days ago" },
  { name: "Rates +150 bps", range: "\u22125.2% to \u22121.7%", score: 77, when: "Last week" },
];

export default function Page() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Your sample portfolio at a glance, and how it held up in the last stress test."
        actions={<Button href="/simulator" icon="arrow">Run a crisis</Button>}
      />

      <Panel bodyClass="!p-0">
        <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
          <Readout className="p-5" label="Portfolio value" value={inr(PORTFOLIO_VALUE)} note="7 holdings" />
          <Readout className="p-5" label="Today" value={pct(dayMove)} tone={dayMove < 0 ? "loss" : "gain"} note="Before any scenario" />
          <Readout className="p-5" label="Last crisis" value={pct(lastLoss)} tone="loss" note="Oil +25%, rates +100 bps" />
          <Readout className="p-5" label="Survival score" value="72" tone="ultra" note="Out of 100" />
          <Readout className="p-5" label="Confidence" value="Medium" note="Inside the fitted data range" />
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-7" title="Latest stress test" aside={<TextLink href="/simulator">Open</TextLink>}>
          <p className="max-w-[56ch] text-slate">Oil rises 25% and the central bank raises rates by a full point. These are the holdings that moved most.</p>
          <ul className="mt-5 space-y-3.5">
            {[...HOLDINGS].sort((a, b) => combined(a) - combined(b)).slice(0, 5).map((h) => (
              <li key={h.id} className="grid grid-cols-[110px_minmax(0,1fr)_64px] items-center gap-4">
                <span className="font-medium">{h.name}</span>
                <DivergingBar value={combined(h)} max={12} />
                <span className={`num text-right font-semibold ${combined(h) < 0 ? "text-ember-deep" : "text-mint-deep"}`}>{pct(combined(h))}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="lg:col-span-5" title="Where the money sits">
          <div className="flex h-4 overflow-hidden rounded-full" role="img" aria-label="Portfolio weight by sector">
            {HOLDINGS.map((h, i) => <div key={h.id} style={{ width: `${h.weight}%`, background: SECTOR_COLORS[i] }} />)}
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 text-[0.95rem]">
            {HOLDINGS.map((h, i) => (
              <li key={h.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SECTOR_COLORS[i] }} />{SECTORS.find((s) => s.id === h.sector).label}</span>
                <span className="num text-slate">{h.weight}%</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-7" title="Recent runs" aside={<TextLink href="/audit">Audit trail</TextLink>} bodyClass="!px-0 !pb-2">
          <div className="scroll-x">
            <table className="w-full min-w-[520px] text-left text-[0.95rem]">
              <thead className="text-sm text-slate">
                <tr className="border-b border-line"><th className="px-5 py-2 font-medium">Scenario</th><th className="py-2 font-medium">Loss range</th><th className="py-2 font-medium">Score</th><th className="px-5 py-2 text-right font-medium">When</th></tr>
              </thead>
              <tbody>
                {RUNS.map((r) => (
                  <tr key={r.name} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="num py-3 text-ember-deep">{r.range}</td>
                    <td className="num py-3">{r.score}</td>
                    <td className="px-5 py-3 text-right text-slate">{r.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="lg:col-span-5" tone="ink" title="Start from a shock">
          <ul className="divide-y divide-white/10">
            {SHOCKS.map((s) => (
              <li key={s.id}>
                <Link href="/simulator" className="group flex items-center justify-between py-3 text-white">
                  <span className="head text-[1.15rem]">{s.name}</span>
                  <Tag tone="neutral">{s.label}</Tag>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <NextSteps href="/dashboard" />
    </>
  );
}
