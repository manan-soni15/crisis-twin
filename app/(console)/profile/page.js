import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import { Panel, Tag } from "@/components/ui";

export const metadata = { title: "Risk profile" };

const QUESTIONS = [
  { q: "Your portfolio drops 15% in a week. What do you do?", a: "Sell a third and wait" },
  { q: "A friend says a stock will double. How much do you put in?", a: "A small amount" },
  { q: "The market falls for six months straight. You are most likely to", a: "Hold, then sell late" },
  { q: "When do you need this money?", a: "In five years or more" },
];

const STRATEGIES = [
  { n: "Current portfolio", w: -21, v: "Too risky" },
  { n: "After suggested trims", w: -17, v: "Stretch" },
  { n: "Defensive tilt", w: -11, v: "Fits" },
];

const SCALE = 30;
const pos = (v) => `${(Math.abs(v) / SCALE) * 100}%`;

export default function Page() {
  return (
    <>
      <PageHeader
        title="Risk profile"
        description="Not a questionnaire score. A picture of how much loss you can actually live with, built from your answers and from how you act in drills."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-5" title="Your answers">
          <ul className="divide-y divide-line">
            {QUESTIONS.map((x) => (
              <li key={x.q} className="py-4 first:pt-1">
                <p className="text-[0.97rem] text-slate">{x.q}</p>
                <p className="head mt-1.5 text-[1.15rem] text-ultra">{x.a}</p>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-5 lg:col-span-7">
          <Panel title="How much loss can you stomach?">
            <div className="relative mt-10 h-5 overflow-visible rounded-full" role="img" aria-label="Comfort at 8 percent loss, breaking point at 15 percent loss">
              <div className="absolute inset-0 flex overflow-hidden rounded-full">
                <div className="bg-mint" style={{ width: pos(-8) }} />
                <div className="bg-[#f6c453]" style={{ width: `calc(${pos(-15)} - ${pos(-8)})` }} />
                <div className="flex-1 bg-ember" />
              </div>
              <div className="absolute -top-8 -translate-x-1/2 text-center" style={{ left: pos(-8) }}>
                <div className="num text-sm font-bold">&minus;8%</div>
                <div className="mx-auto h-8 w-px bg-ink" />
              </div>
              <div className="absolute -top-8 -translate-x-1/2 text-center" style={{ left: pos(-15) }}>
                <div className="num text-sm font-bold">&minus;15%</div>
                <div className="mx-auto h-8 w-px bg-ink" />
              </div>
            </div>
            <div className="mt-3 flex justify-between text-sm text-slate"><span>Comfortable up to &minus;8%</span><span>Likely to sell near &minus;15%</span></div>
            <dl className="mt-6 grid gap-5 border-t border-line pt-5 sm:grid-cols-3">
              <div><dt className="text-sm text-slate">Reaction style</dt><dd className="head mt-1 text-[1.2rem]">Holds, then sells late</dd></div>
              <div><dt className="text-sm text-slate">Time horizon</dt><dd className="head mt-1 text-[1.2rem]">5 years or more</dd></div>
              <div><dt className="text-sm text-slate">Drill behaviour</dt><dd className="head mt-1 text-[1.2rem]">More cautious than stated</dd></div>
            </dl>
          </Panel>

          <Panel title="Check a strategy against you" bodyClass="!px-0 !pb-2">
            <table className="w-full text-left text-[0.95rem]">
              <thead className="text-sm text-slate"><tr className="border-b border-line"><th className="px-5 py-2 font-medium">Strategy</th><th className="py-2 font-medium">Worst case</th><th className="px-5 py-2 text-right font-medium">For you</th></tr></thead>
              <tbody>
                {STRATEGIES.map((s) => (
                  <tr key={s.n} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-3 font-medium">{s.n}</td>
                    <td className="num py-3">&minus;{Math.abs(s.w)}%</td>
                    <td className="px-5 py-3 text-right"><Tag tone={s.v === "Fits" ? "gain" : s.v === "Too risky" ? "loss" : "neutral"}>{s.v}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
      <NextSteps href="/profile" />
    </>
  );
}
