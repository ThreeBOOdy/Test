import { BookOpenCheck } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-2xl bg-[var(--primary)] text-white shadow-[0_8px_20px_rgba(17,94,89,.25)]">
        <BookOpenCheck className="size-5" aria-hidden="true" />
      </div>
      {compact ? null : (
        <div>
          <div className="text-base font-extrabold tracking-[-0.03em]">知练</div>
          <div className="text-[11px] font-medium tracking-[0.18em] text-[var(--muted-foreground)]">SMART PRACTICE</div>
        </div>
      )}
    </div>
  );
}
