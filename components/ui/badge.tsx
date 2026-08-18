import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "green" | "blue" | "amber" | "red" }) {
  return <span className={cn(
    "font-radio inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-[.04em]",
    tone === "neutral" && "border-slate-500/20 bg-slate-500/10 text-slate-600",
    tone === "green" && "border-emerald-600/20 bg-emerald-500/10 text-emerald-700",
    tone === "blue" && "border-cyan-600/20 bg-cyan-500/10 text-cyan-700",
    tone === "amber" && "border-amber-600/25 bg-amber-500/10 text-amber-700",
    tone === "red" && "border-rose-600/20 bg-rose-500/10 text-rose-700",
    className,
  )} {...props} />;
}
