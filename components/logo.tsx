import { RadioTower } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3"><div className="relative grid size-11 place-items-center rounded-2xl border border-cyan-300/25 bg-[linear-gradient(145deg,rgba(92,225,230,.16),rgba(92,225,230,.035))] text-[var(--primary)] shadow-[inset_0_1px_rgba(255,255,255,.08),0_0_30px_rgba(92,225,230,.08)]"><RadioTower className="size-5" aria-hidden="true" /><span className="absolute -right-1 -top-1 size-2 rounded-full bg-[var(--signal-amber)] shadow-[0_0_12px_rgba(232,185,107,.7)]" /></div>{compact ? null : <div><div className="text-base font-black tracking-[-0.035em]">波段研习</div><div className="font-radio mt-0.5 text-[9px] font-bold tracking-[0.2em] text-[var(--muted-foreground)]">BAND STUDY / BD-01</div></div>}</div>;
}
