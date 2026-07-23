import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "green" | "blue" | "amber" | "red" }) {
  return <span className={cn(
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
    tone === "neutral" && "border-slate-400/15 bg-slate-400/10 text-slate-300",
    tone === "green" && "border-emerald-300/20 bg-emerald-400/10 text-emerald-300",
    tone === "blue" && "border-cyan-300/20 bg-cyan-400/10 text-cyan-200",
    tone === "amber" && "border-amber-300/20 bg-amber-400/10 text-amber-200",
    tone === "red" && "border-rose-300/20 bg-rose-400/10 text-rose-200",
    className,
  )} {...props} />;
}
