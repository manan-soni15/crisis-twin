import { Icon } from "@/components/Icons";

export default function VoiceOrb({
  isListening = false,
  isProcessing = false,
  isSupported = false,
  onToggle,
  statusMessage = "",
}) {
  const disabled = !isSupported || isProcessing;

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="relative grid h-[220px] w-[220px] place-items-center">
        <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
          <div className={`h-[180px] w-[180px] rounded-full border transition-colors ${isListening ? "border-ember/70" : "border-white/10"}`} />
        </div>
        <div className={`absolute h-[154px] w-[154px] rounded-full border transition-all ${isListening ? "animate-ping border-ember/30" : "border-white/5"}`} aria-hidden="true" />
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className={`relative grid h-[136px] w-[136px] place-items-center rounded-full text-white transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember disabled:cursor-not-allowed disabled:opacity-60 ${isListening ? "bg-ember shadow-[0_0_45px_rgba(230,126,76,0.25)]" : "bg-ultra hover:scale-[1.03] hover:bg-ultra/90"}`}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
          aria-pressed={isListening}
          title={!isSupported ? "Voice recognition is not supported in this browser" : isListening ? "Stop listening" : "Start voice input"}
        >
          <Icon name={isListening ? "mic-off" : "mic"} size={46} strokeWidth={1.5} />
        </button>
      </div>
      <div className="mt-2 flex h-10 items-center justify-center gap-1" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            className={`w-1 rounded-full transition-colors ${isListening ? "bg-ember" : "bg-ice"}`}
            style={{ height: `${isListening ? 5 + ((i * 11) % 24) : 4 + ((i * 7) % 9)}px`, opacity: isListening ? 0.9 : 0.45 }}
          />
        ))}
      </div>
      <p className="head mt-3 text-[1.5rem] text-white">
        {isListening ? "Listening…" : isProcessing ? "Preparing response…" : "Speak to Crisis Twin"}
      </p>
      <p className="mt-1 max-w-[36ch] text-[0.95rem] text-ice/75" aria-live="polite">
        {statusMessage || (isSupported
          ? "Tap the microphone and speak your command. Your transcript will be sent when you finish."
          : "Voice input is unavailable in this browser. You can still type a command below.")}
      </p>
    </div>
  );
}
