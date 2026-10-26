import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import Segmented from "@/components/Segmented";
import { Panel, Button, Tag } from "@/components/ui";
import { DivergingBar } from "@/components/viz/Charts";
import { HOLDINGS, SECTORS, PORTFOLIO_VALUE, inr, pct, holdingImpact } from "@/lib/sample";

export const metadata = { title: "Holdings" };

const stress = (h) => Math.round((holdingImpact("oil", h) + holdingImpact("rates", h)) * 10) / 10;

export default function Page() {
  const top3 = [...HOLDINGS].sort((a, b) => b.weight - a.weight).slice(0, 3);
  return (
    <>
      <PageHeader
        title="Holdings"
        description="What the sample portfolio owns, how it behaves under stress, and a ticket for paper trades."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-8" bodyClass="!px-0 !pb-2 !pt-1">
          <div className="scroll-x">
            <table className="w-full min-w-[680px] text-left text-[0.95rem]">
              <thead className="text-sm text-slate">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-medium">Holding</th>
                  <th className="py-3 font-medium">Weight</th>
                  <th className="py-3 text-right font-medium">Value</th>
                  <th className="py-3 text-right font-medium">Today</th>
                  <th className="w-[170px] px-5 py-3 font-medium">Under oil and rates shock</th>
                </tr>
              </thead>
              <tbody>
                {HOLDINGS.map((h) => (
                  <tr key={h.id} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold">{h.name}</div>
                      <div className="text-sm text-slate">{SECTORS.find((s) => s.id === h.sector).label}</div>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-ultra" style={{ width: `${h.weight * 4}%` }} /></div>
                        <span className="num w-9 text-slate">{h.weight}%</span>
                      </div>
                    </td>
                    <td className="num py-3.5 text-right">{inr((PORTFOLIO_VALUE * h.weight) / 100)}</td>
                    <td className={`num py-3.5 text-right font-semibold ${h.day < 0 ? "text-ember-deep" : "text-mint-deep"}`}>{pct(h.day)}</td>
                    <td className="px-5 py-3.5"><DivergingBar value={stress(h)} max={12} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-5 lg:col-span-4">
          <Panel title="Paper trade" aside={<Tag tone="gain">Simulated</Tag>}>
            <div className="space-y-4">
              <Segmented label="Side" options={["Buy", "Sell"]} />
              <div>
                <label htmlFor="sym" className="mb-1.5 block text-sm text-slate">Holding</label>
                <select id="sym" className="w-full rounded-lg border border-line bg-white px-3 py-2.5">
                  {HOLDINGS.map((h) => <option key={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="qty" className="mb-1.5 block text-sm text-slate">Quantity</label>
                  <input id="qty" type="number" min="1" defaultValue="10" className="num w-full rounded-lg border border-line bg-white px-3 py-2.5" />
                </div>
                <div>
                  <label htmlFor="ot" className="mb-1.5 block text-sm text-slate">Order</label>
                  <select id="ot" className="w-full rounded-lg border border-line bg-white px-3 py-2.5"><option>Market</option><option>Limit</option></select>
                </div>
              </div>
              <Button className="w-full">Place paper trade</Button>
              <p className="text-sm text-slate">No real money moves. Each paper trade is logged in the audit trail.</p>
            </div>
          </Panel>
          <Panel title="Concentration" tone="flat">
            <p className="text-[0.95rem] text-slate">
              Your three largest holdings are {top3.map((h) => h.name).join(", ")}, together {top3.reduce((s, h) => s + h.weight, 0)}% of the portfolio.
            </p>
          </Panel>
        </div>
      </div>
      <NextSteps href="/holdings" />
    </>
  );
}
