import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import AuditTable from "@/components/AuditTable";
import { Panel, Tag } from "@/components/ui";

export const metadata = { title: "Audit trail" };

const ROWS = [
  { id: "run-0142", scenario: "Oil +25% and rates +100 bps", when: "Today", agents: 4, confidence: "Medium", model: "factors-v3",
    shocks: '{\n  "oil_price": { "change_pct": 25 },\n  "policy_rate": { "change_bps": 100 },\n  "horizon_days": 10\n}',
    log: [{ agent: "Bull", text: "Proposed a targeted trim." }, { agent: "Bear", text: "Argued for a larger autos trim." }, { agent: "Risk Auditor", text: "Flagged shared auto-credit risk." }, { agent: "Manager", text: "Recommended three actions, dissent kept." }] },
  { id: "run-0141", scenario: "Geopolitical conflict", when: "Yesterday", agents: 4, confidence: "Low", model: "factors-v3",
    shocks: '{\n  "conflict": { "severity": "high" },\n  "horizon_days": 10\n}',
    log: [{ agent: "Risk Auditor", text: "Scenario is outside the fitted data range." }, { agent: "Manager", text: "Showed wider ranges and a low-confidence warning." }] },
  { id: "run-0139", scenario: "Auto-sector scandal", when: "3 days ago", agents: 3, confidence: "High", model: "factors-v3",
    shocks: '{\n  "company_event": { "sector": "autos", "size": -14 }\n}',
    log: [{ agent: "Bear", text: "Pointed to lenders as a second-round risk." }, { agent: "Manager", text: "Recommended a small trim." }] },
  { id: "run-0136", scenario: "Rates +150 bps", when: "Last week", agents: 4, confidence: "Medium", model: "factors-v2",
    shocks: '{\n  "policy_rate": { "change_bps": 150 }\n}',
    log: [{ agent: "Manager", text: "Recommended shifting weight away from banks." }] },
];

export default function Page() {
  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Every simulation is logged with its inputs, each advisor's reasoning, the model version and the confidence level, so any recommendation can be traced and checked."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="Runs" bodyClass="!px-0 !pb-0">
          <AuditTable rows={ROWS} />
        </Panel>
        <div className="space-y-5 lg:col-span-4">
          <Panel title="Explain this number" aside="Tata Motors">
            <p className="text-[0.95rem] text-slate">Why the model shows a 12.6% fall for Tata Motors under oil +25% and rates +100 bps.</p>
            <dl className="mt-4 space-y-2.5 text-[0.95rem]">
              <div className="flex justify-between"><dt>Autos under oil shock</dt><dd className="num">&minus;5.8%</dd></div>
              <div className="flex justify-between"><dt>Autos under rate shock</dt><dd className="num">&minus;6.2%</dd></div>
              <div className="flex justify-between"><dt>Holding sensitivity</dt><dd className="num">&times; 1.05</dd></div>
              <div className="flex justify-between border-t border-line pt-2.5 font-semibold"><dt>Result</dt><dd className="num text-ember-deep">&minus;12.6%</dd></div>
            </dl>
          </Panel>
          <Panel title="What the confidence levels mean" tone="flat">
            <ul className="space-y-3 text-[0.95rem]">
              <li className="flex gap-3"><Tag tone="gain">High</Tag><span className="text-slate">Inside the fitted data range, well covered.</span></li>
              <li className="flex gap-3"><Tag>Medium</Tag><span className="text-slate">Inside the range, but data is thin for one input.</span></li>
              <li className="flex gap-3"><Tag tone="loss">Low</Tag><span className="text-slate">Outside what the model has seen. Treat as a rough guide.</span></li>
            </ul>
          </Panel>
        </div>
      </div>
      <NextSteps href="/audit" />
    </>
  );
}
