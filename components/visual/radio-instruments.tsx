import { cn } from "@/lib/utils";

export function CallsignLabel({ value, className }: { value: string; className?: string }) {
  return <span className={cn("callsign-label", className)}><span className="status-dot" aria-hidden="true" />{value}</span>;
}

export function SignalMeter({ value, max = 5, label = "信号强度", className }: { value: number; max?: number; label?: string; className?: string }) {
  const safeMax = Math.max(1, max);
  const current = Math.min(Math.max(value, 0), safeMax);
  return <div className={cn("signal-meter", className)} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={safeMax} aria-valuenow={current}>{Array.from({ length: safeMax }, (_, index) => <span key={index} className={cn("signal-meter__bar", index < current && "is-active")} style={{ height: `${35 + index * 14}%` }} />)}</div>;
}

export function FrequencyScale({ active = 4, segments = 9, className }: { active?: number; segments?: number; className?: string }) {
  const safeSegments = Math.max(3, segments);
  return <div className={cn("frequency-scale", className)} aria-hidden="true">{Array.from({ length: safeSegments }, (_, index) => <span key={index} className={cn("frequency-scale__tick", index === active && "is-active")}><i /></span>)}</div>;
}

export function BearingCompass({ bearing = 0, className }: { bearing?: number; className?: string }) {
  const normalized = ((bearing % 360) + 360) % 360;
  return <div className={cn("bearing-compass", className)} role="img" aria-label={`无线电测向 ${normalized} 度`}><span className="bearing-compass__ring" /><span className="bearing-compass__needle" style={{ transform: `rotate(${normalized}deg)` }} /><span className="bearing-compass__center" /><span className="bearing-compass__north">N</span></div>;
}

export function MorseDivider({ text, className }: { text: string; className?: string }) {
  return <div className={cn("morse-divider", className)}><span aria-hidden="true">••• — •—• •—</span><span>{text}</span><span aria-hidden="true">—•• •• —</span></div>;
}

export function TelegraphKey({ className }: { className?: string }) {
  return <svg className={cn("telegraph-key", className)} viewBox="0 0 180 90" role="img" aria-label="电报键示意图"><path d="M18 70h144" /><path d="M47 65h78" /><circle cx="54" cy="56" r="8" /><circle cx="119" cy="61" r="6" /><path d="m59 52 69-24" /><path d="M128 28h27" /><circle cx="157" cy="28" r="7" /><path d="M74 48 67 34" /></svg>;
}

export function SpectrumWaterfall({ className }: { className?: string }) {
  return <div className={cn("spectrum-waterfall", className)} aria-hidden="true"><span className="spectrum-waterfall__beam" /><span className="spectrum-waterfall__noise" /></div>;
}
