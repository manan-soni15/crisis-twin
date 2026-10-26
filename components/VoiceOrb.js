import { Icon } from "@/components/Icons";

// Visual placeholder for Milestone 1. Speech recognition is intentionally
// deferred until the typed conversation flow is tested and approved.
export default function VoiceOrb() {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="relative grid h-[220px] w-[220px] place-items-center">
        <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
          <div className="h-[180px] w-[180px] rounded-full border border-white/10" />
        </div>
        <div
          className="relative grid h-[136px] w-[136px] place-items-center rounded-full bg-ultra text-white"
          aria-label="Voice controls will be enabled in the next milestone"
        >
          <Icon name="mic" size={46} strokeWidth={1.5} />
        </div>
      </div>
      <div className="mt-2 flex h-10 items-center justify-center gap-1" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-ice"
            style={{ height: `${4 + ((i * 7) % 9)}px`, opacity: 0.45 }}
          />
        ))}
      </div>
      <p className="head mt-3 text-[1.5rem] text-white">Voice input is next</p>
      <p className="mt-1 max-w-[36ch] text-[0.95rem] text-ice/75">
        This first step focuses on making typed commands and conversation replies work reliably.
      </p>
    </div>
  );
}
