import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({ icon: Icon, label, value, helper, tone = "green" }: { icon: LucideIcon; label: string; value: string; helper: string; tone?: "green" | "blue" | "amber" | "rose" }) {
  const tones = { green: "border-emerald-300/20 bg-emerald-400/10 text-emerald-300", blue: "border-cyan-300/20 bg-cyan-400/10 text-cyan-200", amber: "border-amber-300/20 bg-amber-400/10 text-amber-200", rose: "border-rose-300/20 bg-rose-400/10 text-rose-200" };
  return <Card variant="receiver"><CardContent className="relative flex items-start gap-4"><div className={`grid size-11 place-items-center rounded-2xl border ${tones[tone]}`}><Icon className="size-5" /></div><div className="min-w-0"><div className="font-radio text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted-foreground)]">{label}</div><div className="stat-number mt-1 text-2xl font-black">{value}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{helper}</div></div><span className="absolute right-5 top-5 size-1.5 rounded-full bg-[var(--signal-green)] shadow-[0_0_10px_rgba(97,215,168,.6)]" /></CardContent></Card>;
}
