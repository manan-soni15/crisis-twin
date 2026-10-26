import PageHeader from "@/components/console/PageHeader";
import NextSteps from "@/components/console/NextSteps";
import Tabs from "@/components/Tabs";
import ShockGraph from "@/components/viz/ShockGraph";
import { Panel, Path, TextLink } from "@/components/ui";
import { SHOCKS, SECTORS, HOLDINGS, SECTOR_IMPACT, HIDDEN_LINKS, holdingImpact, pct } from "@/lib/sample";

export const metadata = { title: "Propagation map" };

function View({ shock }) {
  const impact = SECTOR_IMPACT[shock.id];
  const paths = HOLDINGS.map((h) => ({ h, v: holdingImpact(shock.id, h) }))
    .filter((x) => Math.abs(x.v) >= 0.5)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 4);
  const hidden = HIDDEN_LINKS.filter((l) => Math.abs(impact[l.from]) >= 1);
  const name = (id) => SECTORS.find((s) => s.id === id)?.label ?? HOLDINGS.find((h) => h.id === id)?.name;
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Panel className="lg:col-span-8" title={shock.name} aside="Hover or focus a name to isolate its paths">
        <div className="scroll-x">
          <div className="min-w-[620px] pt-2">
            <ShockGraph scenario={shock.id} interactive loss="#ff5a2c" gain="#1fa98a" className="text-ink" showRings={false} />
          </div>
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-sm text-slate">
          <li className="flex items-center gap-2"><span className="h-1 w-6 rounded bg-ember" />Loss</li>
          <li className="flex items-center gap-2"><span className="h-1 w-6 rounded bg-mint" />Gain</li>
          <li className="flex items-center gap-2"><span className="w-6 border-t-2 border-dashed border-ember" />Indirect link</li>
          <li className="flex items-center gap-2"><span className="h-2 w-6 rounded bg-slate/50" />Thicker means stronger</li>
        </ul>
      </Panel>

      <div className="space-y-5 lg:col-span-4">
        <Panel title="Strongest paths">
          <ul className="space-y-4">
            {paths.map(({ h, v }) => (
              <li key={h.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <Path nodes={[shock.label, name(h.sector), h.name]} className="text-[0.95rem]" />
                  <span className={`num font-bold ${v < 0 ? "text-ember-deep" : "text-mint-deep"}`}>{pct(v)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Hidden exposures" tone="ink">
          {hidden.length ? (
            <ul className="space-y-4">
              {hidden.map((l) => (
                <li key={l.to}>
                  <Path nodes={[name(l.from), name(l.to)]} className="text-white" />
                  <p className="mt-1 text-[0.95rem] text-ice/80">{l.note}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ice/80">This shock has no indirect links that the sector view would miss.</p>
          )}
        </Panel>
        <TextLink href="/debate">Ask the advisors about these paths</TextLink>
      </div>
    </div>
  );
}

export default function Page() {
  const panels = Object.fromEntries(SHOCKS.map((s) => [s.id, <View key={s.id} shock={s} />]));
  return (
    <>
      <PageHeader
        title="Propagation map"
        description="Follow a shock from its cause, through sectors, into the stocks you own. Dashed lines are links a sector view would miss."
      />
      <Tabs label="Shock" items={SHOCKS.map((s) => ({ id: s.id, label: s.name }))} panels={panels} />
      <NextSteps href="/propagation" />
    </>
  );
}
