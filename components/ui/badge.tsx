import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "green" | "blue" | "amber" | "red" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tone === "neutral" && "bg-[var(--muted)] text-[var(--muted-foreground)]",
        tone === "green" && "bg-emerald-50 text-emerald-700",
        tone === "blue" && "bg-sky-50 text-sky-700",
        tone === "amber" && "bg-amber-50 text-amber-700",
        tone === "red" && "bg-rose-50 text-rose-700",
        className,
      )}
      {...props}
    />
  );
}
