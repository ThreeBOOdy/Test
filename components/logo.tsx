import { RadioTower } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="radio-waves grid size-10 place-items-center rounded-[15px] bg-[linear-gradient(145deg,#16b8c2,#087883)] text-white shadow-[0_10px_28px_rgba(7,139,152,.28)]">
        <RadioTower className="relative z-10 size-5" aria-hidden="true" />
      </div>
      {compact ? null : (
        <div>
          <div className={cn("text-base font-black tracking-[-0.04em]", inverse && "text-white")}>波段研习</div>
          <div className={cn("mt-0.5 text-[10px] font-bold tracking-[0.22em] text-[var(--muted-foreground)]", inverse && "text-cyan-100/60")}>RADIO EXAM LAB</div>
        </div>
      )}
    </div>
  );
}
