import { RadioTower } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3"><div className="relative grid size-11 place-items-center rounded-2xl border border-cyan-600/20 bg-[linear-gradient(145deg,rgba(10,134,152,.12),rgba(10,134,152,.03))] text-[var(--primary)] shadow-[inset_0_1px_rgba(255,255,255,.6),0_10px_24px_rgba(10,134,152,.14)]"><RadioTower className="size-5" aria-hidden="true" /><span className="absolute -right-1 -top-1 size-2 rounded-full bg-[var(--signal-amber)] shadow-[0_0_8px_rgba(191,122,30,.5)]" /></div>{compact ? null : <div><div className="text-base font-black tracking-[-0.035em]">波段研习</div><div className="font-radio mt-0.5 text-[9px] font-bold tracking-[0.2em] text-[var(--muted-foreground)]">BAND STUDY / BD-01</div></div>}</div>;
}
