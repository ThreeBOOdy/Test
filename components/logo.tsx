import { RadioTower } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-[var(--primary)]"><RadioTower className="size-5" aria-hidden="true" /></div>{compact ? null : <div><div className="text-base font-extrabold tracking-[-0.03em]">知练无线电</div><div className="text-[10px] font-semibold tracking-[0.2em] text-[var(--muted-foreground)]">SIGNAL TRAINING</div></div>}</div>;
}
