import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import { Panel, Button, Tag, TextLink } from "@/components/ui";
import { LineChart, Ring } from "@/components/viz/Charts";
import { crisisCurve } from "@/lib/sample";

export const metadata = { title: "Crisis drill" };

const OPTIONS = [
  { t: "Hold everything", d: "Wait it out. No trades." },
  { t: "Trim the biggest losers", d: "Cut IndiGo and Tata Motors by a third." },
  { t: "Hedge with defensives", d: "Move 7 points into pharma and consumer." },
  { t: "Sell to cash", d: "Exit half the portfolio now." },
];

const LIBRARY = [
  { n: "Oil shock overnight", l: "Medium" },
  { n: "Surprise rate hike", l: "Medium" },
  { n: "Market-wide flash crash", l: "Hard" },
  { n: "Auto-sector scandal", l: "Easy" },
];

export default function Page() {
  const live = crisisCurve(9, 0.2, 31).slice(0, 22);
  return (
    <>
      <PageHeader
        title="Crisis drill"
        description="A timed rehearsal. A breaking alert arrives, the clock runs, and you decide by voice or tap. Afterwards you see how you really behave under pressure."
        actions={<Button icon="play">Start drill</Button>}
      />

      <div className="mb-5 rounded-[10px] bg-ember px-6 py-5 text-ink">
        <div className="text-sm font-semibold">Breaking</div>
        <p className="head mt-1 max-w-[60ch] text-[clamp(1.35rem,2.6vw,2rem)]">
          Oil is up 25% overnight and the central bank is expected to raise rates. Your portfolio is down 4.1% before the market opens.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-4">
          <Panel title="Time to decide">
            <div className="flex flex-col items-center py-2">
              <Ring value={0.7} size={190} stroke={12} color="#ff5a2c">
                <div>
                  <div className="display num text-[3rem]">00:42</div>
                  <div className="text-sm text-slate">left</div>
                </div>
              </Ring>
            </div>
          </Panel>
          <Panel title="Drill library">
            <ul className="divide-y divide-line">
              {LIBRARY.map((d) => (
                <li key={d.n} className="flex items-center justify-between py-2.5">
                  <span className="font-medium">{d.n}</span>
                  <Tag tone={d.l === "Hard" ? "loss" : "neutral"}>{d.l}</Tag>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="space-y-5 lg:col-span-8">
          <Panel title="Portfolio value, pre-market">
            <LineChart series={[{ values: live.map((v) => v + 4), color: "#ff5a2c", width: 2.6 }]} yMin={90} yMax={104} yTicks={[92, 96, 100]} xLabels={["Alert", "", "Now"]} gap={false} h={200} />
          </Panel>
          <Panel title="What do you do?">
            <div className="grid gap-3 sm:grid-cols-2">
              {OPTIONS.map((o) => (
                <button key={o.t} type="button" className="group rounded-[10px] border border-line bg-white p-4 text-left transition-colors hover:border-ultra hover:bg-ultra hover:text-white">
                  <span className="head block text-[1.2rem]">{o.t}</span>
                  <span className="mt-1 block text-[0.95rem] text-slate group-hover:text-ice">{o.d}</span>
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate">You can also say your decision out loud.</p>
          </Panel>
        </div>
      </div>

      <Panel className="mt-5" title="Debrief" aside="Sample result">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-5">
            <div>
              <div className="mb-1.5 flex justify-between text-[0.95rem]"><span>What you said you could handle</span><span className="num font-semibold">&minus;10%</span></div>
              <div className="h-3 rounded-full bg-mist"><div className="h-full w-[33%] rounded-full bg-ultra" /></div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-[0.95rem]"><span>Where you actually sold</span><span className="num font-semibold text-ember-deep">&minus;4.1%</span></div>
              <div className="h-3 rounded-full bg-mist"><div className="h-full w-[14%] rounded-full bg-ember" /></div>
            </div>
          </div>
          <div>
            <p className="serif text-[1.2rem] leading-snug">You said you were comfortable with a 10% drop, but you chose to sell half the portfolio at 4.1%. Under time pressure you were more cautious than you expected.</p>
            <div className="mt-4"><TextLink href="/profile">See your risk profile</TextLink></div>
          </div>
        </div>
      </Panel>
      <NextSteps href="/drill" />
    </>
  );
}
