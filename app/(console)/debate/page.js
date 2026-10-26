import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import AgentMark from "@/components/AgentMark";
import { Panel, Button, Meter, Tag, TextLink } from "@/components/ui";

export const metadata = { title: "Debate room" };

const MESSAGES = [
  { agent: "bull", name: "Bull", role: "Finds opportunity", conf: 3, evidence: "holding_impact.reliance, holding_impact.sun",
    text: "Reliance gains 4.0% on higher crude and Sun Pharma barely moves. The damage sits in a few names, so a small, targeted trim fixes most of it. No need to sell the core." },
  { agent: "bear", name: "Bear", role: "Attacks the plan", conf: 4, evidence: "holding_impact.hdfc, holding_impact.tata, weights",
    text: "Two winners do not cancel three losers. HDFC Bank falls 6.3% on the rate move, and Tata Motors and IndiGo both fall more than 12%. Together those three are 41% of the portfolio." },
  { agent: "audit", name: "Risk Auditor", role: "Checks hidden exposure", conf: 4, evidence: "risk_contribution, correlation_in_stress", wide: true,
    text: "HDFC Bank and Tata Motors share auto-credit risk, and together they are 32% of the portfolio. In stress their correlation rises sharply, so holding both at full size is less diversified than it looks. I disagree with the Bull on keeping the core untouched." },
];

const ACTIONS = [
  { t: "Trim Tata Motors", d: "12% to 8%", e: "+0.5 pts" },
  { t: "Trim IndiGo", d: "9% to 6%", e: "+0.4 pts" },
  { t: "Add defensives", d: "Sun Pharma and ITC, +7 points", e: "\u22120.1 pts" },
];

const RECORD = [
  { agent: "bull", name: "Bull", v: 54 },
  { agent: "bear", name: "Bear", v: 63 },
  { agent: "audit", name: "Risk Auditor", v: 71 },
];

export default function Page() {
  return (
    <>
      <PageHeader
        title="Debate room"
        description="A Bull proposes, a Bear attacks, and an independent Risk Auditor checks the numbers. Every claim points at the evidence it used."
        actions={<><Button icon="play">Run debate</Button><Button variant="ghost">Add a rebuttal round</Button></>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-[10px] border border-line bg-bone px-5 py-3">
        <span className="text-slate">Scenario</span>
        <span className="font-semibold">Oil +25% and rates +100 bps</span>
        <Tag tone="loss">Expected move &minus;4.1%</Tag>
        <span className="ml-auto"><TextLink href="/simulator">Change scenario</TextLink></span>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          {MESSAGES.map((m) => (
            <article
              key={m.agent}
              className={`rounded-[10px] border p-5 ${m.wide ? "border-mint/50 bg-mint-soft/60" : "border-line bg-bone"} ${m.agent === "bear" ? "sm:ml-12" : m.agent === "bull" ? "sm:mr-12" : ""}`}
            >
              <header className="flex items-center gap-3">
                <AgentMark agent={m.agent} />
                <div>
                  <h2 className="head text-[1.15rem]">{m.name}</h2>
                  <p className="text-sm text-slate">{m.role}</p>
                </div>
                <div className="ml-auto flex items-center gap-2 text-sm text-slate">Confidence <Meter value={m.conf} tone={m.agent === "bear" ? "ember" : m.agent === "audit" ? "mint" : "ultra"} /></div>
              </header>
              <p className="serif mt-4 text-[1.22rem] leading-snug">{m.text}</p>
              <p className="mt-3 text-sm text-slate">Evidence: {m.evidence}</p>
            </article>
          ))}
        </div>

        <div className="space-y-5 lg:col-span-4">
          <Panel tone="ink" title="Portfolio Manager recommends">
            <ul className="divide-y divide-white/10">
              {ACTIONS.map((a) => (
                <li key={a.t} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <div className="head text-[1.1rem] text-white">{a.t}</div>
                    <div className="text-[0.95rem] text-ice/75">{a.d}</div>
                  </div>
                  <span className="num font-semibold text-white">{a.e}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg bg-white/10 p-3.5 text-[0.95rem]">
              Expected move changes from <b className="text-white">&minus;4.1%</b> to <b className="text-white">&minus;3.4%</b>.
            </div>
            <div className="mt-4 text-[0.95rem]">
              <span className="font-semibold text-white">Dissent on record.</span> The Bear wanted a larger trim of Tata Motors.
            </div>
          </Panel>
          <Panel title="Advisor track record" aside="Sample">
            <ul className="space-y-4">
              {RECORD.map((r) => (
                <li key={r.agent}>
                  <div className="mb-1.5 flex items-center justify-between text-[0.95rem]">
                    <span className="flex items-center gap-2"><AgentMark agent={r.agent} size={26} />{r.name}</span>
                    <span className="num font-semibold">{r.v}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-mist"><div className="h-full rounded-full bg-ink" style={{ width: `${r.v}%` }} /></div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate">Share of past crisis calls that held up in replay.</p>
          </Panel>
        </div>
      </div>
      <NextSteps href="/debate" />
    </>
  );
}
