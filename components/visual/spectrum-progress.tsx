import { cn } from "@/lib/utils";

export function SpectrumProgress({ answered, total, className }: { answered: number; total: number; className?: string }) {
  const safeTotal = Math.max(total, 1);
  const current = Math.min(Math.max(answered, 0), safeTotal);
  return <div className={cn("flex h-2 gap-1", className)} role="progressbar" aria-label={`已完成 ${current} / ${total} 题`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(answered, total)}>{Array.from({ length: safeTotal }, (_, index) => <span key={index} className={cn("h-full min-w-1 flex-1 rounded-full transition-colors", index < current ? "bg-cyan-300" : index === current ? "bg-amber-300 shadow-[0_0_10px_rgba(232,185,107,.35)]" : "bg-slate-700")} />)}</div>;
}
