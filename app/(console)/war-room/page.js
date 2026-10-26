import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import VoiceOrb from "@/components/VoiceOrb";
import AgentMark from "@/components/AgentMark";
import { Panel, Button } from "@/components/ui";
import { Icon } from "@/components/Icons";

export const metadata = { title: "Voice war room" };

const COMMANDS = [
  "What happens if oil jumps 25% and rates go up a point?",
  "Bear, respond to that.",
  "Which holding is my biggest hidden risk?",
  "Rebalance to lower risk and show me before and after.",
  "Give me this morning\u2019s briefing.",
];

const LOG = [
  { who: "You", text: "What happens if oil jumps 25% and rates go up a point?" },
  { who: "Crisis Twin", text: "Your portfolio is likely to fall about 4.1%, with a range of 1.9% to 6.8%. IndiGo and Tata Motors take the biggest hits." },
  { who: "Bear", text: "That range is too comfortable. Three holdings make up 41% of the portfolio and they all lean the same way." },
  { who: "You", text: "Bear, what would you trim first?" },
];

export default function Page() {
  return (
    <>
      <PageHeader
        title="Voice war room"
        description="Run the whole simulator by talking. Ask a question, interrupt an advisor, or give a command, and hear the answer in the advisor's own voice."
      />
      <div className="grid gap-5 lg:grid-cols-12">
        <Panel className="lg:col-span-3 lg:order-1" title="Try saying">
          <ul className="space-y-3">
            {COMMANDS.map((c) => (
              <li key={c} className="serif border-l-2 border-ultra pl-3 text-[1.05rem] leading-snug">&ldquo;{c}&rdquo;</li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-5 lg:order-2 lg:col-span-6">
          <Panel tone="ink" bodyClass="!pt-2">
            <VoiceOrb />
            <form className="mx-auto mt-2 flex max-w-[520px] gap-2" aria-label="Type a request instead">
              <label htmlFor="typed" className="sr-only">Type a request</label>
              <input id="typed" type="text" placeholder="Type a crisis or a question" className="min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-white placeholder:text-ice/55" />
              <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink hover:bg-ice" aria-label="Send">
                <Icon name="send" size={18} />
              </button>
            </form>
          </Panel>
          <Panel title="Conversation">
            <ul className="space-y-4">
              {LOG.map((l, i) => (
                <li key={i} className={`flex ${l.who === "You" ? "justify-end" : ""}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${l.who === "You" ? "bg-ultra text-white" : "bg-mist"}`}>
                    <div className={`text-sm ${l.who === "You" ? "text-ice" : "text-slate"}`}>{l.who}</div>
                    <p className="mt-0.5 text-[1rem] leading-snug">{l.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel className="lg:order-3 lg:col-span-3" title="Advisors on the line">
          <ul className="space-y-4">
            {[
              { a: "bull", n: "Bull", s: "Standing by" },
              { a: "bear", n: "Bear", s: "Last to speak" },
              { a: "audit", n: "Risk Auditor", s: "Standing by" },
              { a: "pm", n: "Portfolio Manager", s: "Standing by" },
            ].map((x) => (
              <li key={x.a} className="flex items-center gap-3">
                <AgentMark agent={x.a} size={38} />
                <div>
                  <div className="font-semibold leading-tight">{x.n}</div>
                  <div className="text-sm text-slate">{x.s}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-line pt-4 text-sm text-slate">Speak while an advisor is talking to interrupt them.</p>
          <div className="mt-4"><Button href="/debate" variant="ghost" className="w-full">Read the debate</Button></div>
        </Panel>
      </div>
      <NextSteps href="/war-room" />
    </>
  );
}
