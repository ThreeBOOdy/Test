import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({ icon: Icon, label, value, helper, tone = "green" }: { icon: LucideIcon; label: string; value: string; helper: string; tone?: "green" | "blue" | "amber" | "rose" }) {
  const tones = { green: "bg-emerald-50 text-emerald-700 ring-emerald-100", blue: "bg-cyan-50 text-cyan-700 ring-cyan-100", amber: "bg-amber-50 text-amber-700 ring-amber-100", rose: "bg-rose-50 text-rose-700 ring-rose-100" };
  return <Card className="lift-card overflow-hidden"><CardContent className="relative flex items-start gap-4"><div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,transparent,var(--primary),transparent)] opacity-30" /><div className={`grid size-11 place-items-center rounded-2xl ring-1 ${tones[tone]}`}><Icon className="size-5" /></div><div><div className="text-sm font-semibold text-[var(--muted-foreground)]">{label}</div><div className="stat-number mt-1 text-2xl font-black text-[var(--ink)]">{value}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{helper}</div></div></CardContent></Card>;
}
