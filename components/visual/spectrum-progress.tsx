import { cn } from "@/lib/utils";

export function SpectrumProgress({ answered, total, className }: { answered: number; total: number; className?: string }) {
  const safeTotal = Math.max(total, 1);
  const current = Math.min(Math.max(answered, 0), safeTotal);
  return <div className={cn("flex h-2 gap-1", className)} role="progressbar" aria-label={`已完成 ${current} / ${total} 题`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(answered, total)}>{Array.from({ length: safeTotal }, (_, index) => <span key={index} className={cn("h-full min-w-1 flex-1 rounded-full", index < current ? "bg-[var(--primary)]" : index === current ? "bg-[var(--violet)]/70" : "bg-[var(--secondary)]")} />)}</div>;
}
