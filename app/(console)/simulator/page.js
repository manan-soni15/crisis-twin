import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import Sliders from "@/components/Sliders";
import Segmented from "@/components/Segmented";
import { Panel, Button, Readout, Tag, TextLink } from "@/components/ui";
import { DivergingBar, RangeBar } from "@/components/viz/Charts";
import { HOLDINGS, PORTFOLIO_VALUE, SHOCKS, inr, pct, holdingImpact } from "@/lib/sample";

export const metadata = { title: "Crisis Twin simulator" };

const rows = HOLDINGS.map((h) => ({ ...h, imp: Math.round((holdingImpact("oil", h) + holdingImpact("rates", h)) * 10) / 10 })).sort((a, b) => a.imp - b.imp);
const expected = Math.round(rows.reduce((s, h) => s + (h.weight / 100) * h.imp, 0) * 10) / 10;
const after = Math.round(PORTFOLIO_VALUE * (1 + expected / 100));

export default function Page() {
  return (
    <>
      <PageHeader
        title="Crisis Twin"
        description="Describe a crisis in plain words. The simulator turns it into shocks, applies them to your holdings, and shows a range instead of one false-precision number."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-5">
          <Panel title="Describe the crisis">
            <label htmlFor="scenario" className="sr-only">Crisis description</label>
            <textarea
              id="scenario"
              rows={4}
              defaultValue="What if oil jumps 25% and the central bank raises rates by a full point?"
              className="w-full resize-none rounded-lg border border-line bg-white p-3.5 text-[1.02rem] leading-relaxed"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {SHOCKS.map((s) => (
                <button key={s.id} type="button" className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[0.9rem] font-medium text-slate hover:border-ultra hover:text-ultra">{s.name}</button>
              ))}
            </div>
          </Panel>
          <Panel title="Fine-tune the shocks">
            <Sliders
              items={[
                { id: "oil", label: "Oil price", min: -40, max: 60, value: 25, unit: "%", signed: true },
                { id: "rate", label: "Policy rate", min: -100, max: 300, step: 25, value: 100, unit: " bps", signed: true },
                { id: "fx", label: "Rupee vs dollar", min: -15, max: 15, value: 4, unit: "%", signed: true },
                { id: "vol", label: "Market volatility", min: -20, max: 100, value: 35, unit: "%", signed: true },
              ]}
            />
            <div className="mt-6">
              <div className="mb-1.5 text-sm text-slate">Horizon</div>
              <Segmented label="Horizon" options={["1 day", "10 days", "30 days"]} initial="10 days" />
            </div>
            <div className="mt-6 flex gap-3">
              <Button className="flex-1" icon="play">Run simulation</Button>
              <Button variant="ghost">Reset</Button>
            </div>
          </Panel>
        </div>

        <div className="space-y-5 lg:col-span-7">
          <Panel title="Result" aside={<Tag tone="neutral">Medium confidence</Tag>}>
            <div className="grid gap-6 sm:grid-cols-2">
              <Readout label="Expected portfolio move" value={pct(expected)} tone="loss" note="Over 10 days" />
              <div>
                <div className="text-sm text-slate">Likely range (5th to 95th percentile)</div>
                <RangeBar low={-6.8} high={-1.9} expected={expected} min={-10} max={0} />
              </div>
            </div>
            <p className="mt-2 rounded-lg bg-mist px-4 py-3 text-[0.95rem] text-slate">
              The scenario sits inside the range of data the model was fitted on, so the range is trustworthy. Large moves outside that range lower the confidence level and show a warning here.
            </p>
          </Panel>

          <Panel title="Before and after">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <div className="text-sm text-slate">Before the shock</div>
                <div className="display num mt-1 text-[2rem]">{inr(PORTFOLIO_VALUE)}</div>
                <div className="mt-3 h-3 rounded-full bg-ink" />
              </div>
              <div>
                <div className="text-sm text-slate">After the shock</div>
                <div className="display num mt-1 text-[2rem] text-ember-deep">{inr(after)}</div>
                <div className="mt-3 h-3 rounded-full bg-mist"><div className="h-full rounded-full bg-ember" style={{ width: `${(after / PORTFOLIO_VALUE) * 100}%` }} /></div>
              </div>
            </div>
          </Panel>

          <Panel title="Impact by holding">
            <ul className="space-y-3.5">
              {rows.map((h) => (
                <li key={h.id} className="grid grid-cols-[104px_minmax(0,1fr)_60px] items-center gap-4">
                  <span className="font-medium">{h.name}</span>
                  <DivergingBar value={h.imp} max={12} />
                  <span className={`num text-right font-semibold ${h.imp < 0 ? "text-ember-deep" : "text-mint-deep"}`}>{pct(h.imp)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4">
              <TextLink href="/propagation">See how it spreads</TextLink>
              <TextLink href="/debate">Hear the debate</TextLink>
            </div>
          </Panel>
        </div>
      </div>
      <NextSteps href="/simulator" />
    </>
  );
}
