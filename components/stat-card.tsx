import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({ icon: Icon, label, value, helper, tone = "green" }: { icon: LucideIcon; label: string; value: string; helper: string; tone?: "green" | "blue" | "amber" | "rose" }) {
  const tones = { green: "bg-emerald-50 text-emerald-700", blue: "bg-sky-50 text-sky-700", amber: "bg-amber-50 text-amber-700", rose: "bg-rose-50 text-rose-700" };
  return <Card><CardContent className="flex items-start gap-4"><div className={`grid size-11 place-items-center rounded-2xl ${tones[tone]}`}><Icon className="size-5" /></div><div><div className="text-sm text-[var(--muted-foreground)]">{label}</div><div className="stat-number mt-1 text-2xl font-extrabold">{value}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{helper}</div></div></CardContent></Card>;
}
