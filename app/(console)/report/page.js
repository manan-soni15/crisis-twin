import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import { LogoMark } from "@/components/Logo";
import { Panel, Button, Tag } from "@/components/ui";
import { Ring } from "@/components/viz/Charts";

export const metadata = { title: "Report card" };

const RUNS = [
  { n: "Oil +25% and rates +100 bps", s: 72, on: true },
  { n: "Geopolitical conflict", s: 66 },
  { n: "Auto-sector scandal", s: 84 },
  { n: "Rates +150 bps", s: 77 },
];

export default function Page() {
  return (
    <>
      <PageHeader
        title="Report card"
        description="A one-page summary of a simulation that you can download, share or attach to an application."
        actions={<><Button icon="download">Download PDF</Button><Button variant="ghost" icon="link">Copy link</Button></>}
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-3" title="Saved runs">
          <ul className="-mx-2 space-y-1">
            {RUNS.map((r) => (
              <li key={r.n}>
                <button type="button" aria-current={r.on ? "true" : undefined} className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left ${r.on ? "bg-ultra text-white" : "hover:bg-white"}`}>
                  <span className="text-[0.95rem] font-medium leading-snug">{r.n}</span>
                  <span className="num text-sm opacity-80">{r.s}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="lg:col-span-9">
          <article className="mx-auto max-w-[760px] rounded-[6px] border border-line bg-white p-7 shadow-[0_24px_60px_-28px_rgba(14,20,51,0.35)] md:p-10" aria-label="Report card preview">
            <header className="flex items-center justify-between border-b border-line pb-5">
              <div className="flex items-center gap-2.5 text-ink"><LogoMark size={26} /><span className="head text-lg">Crisis Twin</span></div>
              <span className="text-sm text-slate">Crisis report card</span>
            </header>
            <h2 className="display mt-7 text-[clamp(2rem,4vw,3rem)]">Oil +25% and rates +100 bps</h2>
            <div className="mt-8 grid items-center gap-8 sm:grid-cols-[auto_1fr]">
              <Ring value={0.72} size={150} stroke={13} color="#1a2fd4">
                <div><div className="display num text-[2.6rem]">72</div><div className="text-xs text-slate">Survival score</div></div>
              </Ring>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div><dt className="text-sm text-slate">Expected move</dt><dd className="display num text-[1.9rem] text-ember-deep">&minus;4.1%</dd></div>
                <div><dt className="text-sm text-slate">Likely range</dt><dd className="display num text-[1.9rem]">&minus;6.8% to &minus;1.9%</dd></div>
                <div><dt className="text-sm text-slate">After suggested fixes</dt><dd className="display num text-[1.9rem] text-ultra">&minus;3.4%</dd></div>
                <div><dt className="text-sm text-slate">Confidence</dt><dd className="mt-1"><Tag>Medium</Tag></dd></div>
              </dl>
            </div>
            <div className="mt-9 grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
              <div>
                <h3 className="head text-lg">Biggest hidden risk</h3>
                <p className="mt-1.5 text-[0.97rem] text-slate">HDFC Bank and Tata Motors share auto-credit risk. Together they are 32% of the portfolio.</p>
              </div>
              <div>
                <h3 className="head text-lg">Recommended fix</h3>
                <p className="mt-1.5 text-[0.97rem] text-slate">Trim Tata Motors from 12% to 8% and IndiGo from 9% to 6%, then add 7 points of defensives.</p>
              </div>
            </div>
            <p className="mt-9 border-t border-line pt-4 text-xs leading-relaxed text-slate">Simulation only. This is not financial advice and no real trades were placed.</p>
          </article>
        </div>
      </div>
      <NextSteps href="/report" />
    </>
  );
}
