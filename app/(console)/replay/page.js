import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import Tabs from "@/components/Tabs";
import { Panel, Readout, Tag } from "@/components/ui";
import { LineChart } from "@/components/viz/Charts";
import { crisisCurve } from "@/lib/sample";

export const metadata = { title: "Regret replay" };

const CRISES = [
  { id: "2008", label: "2008 financial crisis", span: "Sep to Nov 2008", raw: 40, adj: 22, recover: 0.3, miss: 6 },
  { id: "2020", label: "2020 pandemic crash", span: "Feb to Apr 2020", raw: 28.5, adj: 11.5, recover: 0.5, miss: 4 },
  { id: "2022", label: "2022 rate hikes", span: "Jan to Jun 2022", raw: 19, adj: 10, recover: 0.2, miss: 2 },
  { id: "oil", label: "Oil spike episode", span: "Sample window", raw: 13, adj: 7, recover: 0.4, miss: 2 },
];

function View({ c }) {
  const raw = crisisCurve(c.raw, c.recover);
  const adj = crisisCurve(c.adj, c.recover * 0.6);
  const lossRaw = Math.round(100 - Math.min(...raw));
  const lossAdj = Math.round(100 - Math.min(...adj));
  const predicted = lossRaw - c.miss;
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Panel className="lg:col-span-8" title={c.label} aside={c.span}>
        <div className="mb-2 flex flex-wrap gap-5 text-sm">
          <span className="inline-flex items-center gap-2"><span className="h-0.5 w-6 bg-ink" />Unprotected</span>
          <span className="inline-flex items-center gap-2"><span className="h-0.5 w-6 bg-ultra" />With Crisis Twin adjustments</span>
        </div>
        <LineChart
          series={[{ values: raw, color: "#0e1433", width: 2 }, { values: adj, color: "#1a2fd4", width: 2.8 }]}
          xLabels={["Day 0", "Day 15", "Day 30", "Day 45", "Day 60"]}
          yMin={50} yMax={104} yTicks={[60, 70, 80, 90, 100]} h={320}
        />
      </Panel>
      <div className="space-y-5 lg:col-span-4">
        <Panel title="At the low point">
          <div className="grid grid-cols-2 gap-5">
            <Readout label="Unprotected" value={`\u2212${lossRaw}%`} tone="loss" />
            <Readout label="Adjusted" value={`\u2212${lossAdj}%`} tone="ultra" />
          </div>
          <p className="mt-4 text-[0.95rem] text-slate">Adjustments are applied on day 0 using only data available before the event, with trading costs included.</p>
        </Panel>
        <Panel title="Did the model see it coming?" aside={<Tag tone={c.miss > 3 ? "loss" : "gain"}>{c.miss > 3 ? "Underestimated" : "Close"}</Tag>}>
          <dl className="space-y-3 text-[0.97rem]">
            <div className="flex justify-between"><dt className="text-slate">Predicted loss</dt><dd className="num font-semibold">&minus;{predicted}%</dd></div>
            <div className="flex justify-between"><dt className="text-slate">Actual loss</dt><dd className="num font-semibold">&minus;{lossRaw}%</dd></div>
            <div className="flex justify-between border-t border-line pt-3"><dt className="text-slate">Miss</dt><dd className="num font-semibold text-ember-deep">{c.miss} points</dd></div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}

export default function Page() {
  const panels = Object.fromEntries(CRISES.map((c) => [c.id, <View key={c.id} c={c} />]));
  return (
    <>
      <PageHeader
        title="Regret replay"
        description="Re-run real crashes and compare what happened with what would have happened if you had followed the suggestions. Misses are shown, not hidden."
      />
      <Tabs label="Crisis" items={CRISES.map((c) => ({ id: c.id, label: c.label }))} panels={panels} />
      <Panel className="mt-5" tone="flat" title="What a replay cannot tell you">
        <ul className="grid gap-x-10 gap-y-2 text-[0.97rem] text-slate md:grid-cols-2">
          <li>Linear factor models understate extreme tail events.</li>
          <li>Past sensitivities may not hold in the next crisis.</li>
          <li>Hand-curated links between companies are assumptions.</li>
          <li>Sample data on this page is illustrative until you connect real results.</li>
        </ul>
      </Panel>
      <NextSteps href="/replay" />
    </>
  );
}
