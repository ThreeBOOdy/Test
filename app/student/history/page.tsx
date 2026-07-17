import { BarChart3, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { recentHistory } from "@/lib/data/demo";
import { formatPercent } from "@/lib/utils";

export default function HistoryPage() { return <AppShell role="student" currentPath="/student/history"><div className="safe-bottom"><PageHeader title="练习记录" description="综合练习和知识点专项练习分别留档，方便观察长期进步。" /><div className="grid gap-4 lg:grid-cols-3"><Summary icon={BarChart3} label="近30天练习" value="18 次" /><Summary icon={CheckCircle2} label="平均正确率" value="82%" /><Summary icon={Clock3} label="累计学习" value="3.6 小时" /></div><Card className="mt-6"><CardContent className="p-0"><div className="divide-y divide-[var(--border)]">{[...recentHistory, ...recentHistory].map((item, index) => <div key={`${item.id}-${index}`} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="grid size-12 place-items-center rounded-2xl bg-[var(--secondary)] text-[var(--primary)]"><CalendarDays className="size-5" /></div><div className="flex-1"><div className="font-extrabold">{item.title}</div><div className="mt-1 text-sm text-[var(--muted-foreground)]">{item.detail} · {item.date}</div></div><Badge tone={item.score >= .8 ? "green" : "amber"}>{formatPercent(item.score)} 正确率</Badge></div>)}</div></CardContent></Card></div></AppShell>; }
function Summary({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) { return <Card><CardContent className="flex items-center gap-4"><div className="grid size-11 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--primary)]"><Icon className="size-5" /></div><div><div className="text-sm text-[var(--muted-foreground)]">{label}</div><div className="mt-1 text-xl font-extrabold">{value}</div></div></CardContent></Card>; }
