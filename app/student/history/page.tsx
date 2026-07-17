import { BarChart3, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatPercent } from "@/lib/utils";
import { getCurrentUser } from "@/lib/server/session";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  const sessions = user ? await prisma.practiceSession.findMany({ where: { userId: user.id }, include: { level: true, knowledgePoint: true, _count: { select: { questions: true } } }, orderBy: { startedAt: "desc" }, take: 50 }) : [];
  const completed = sessions.filter((session) => session.status === "COMPLETED");
  const average = completed.length ? completed.reduce((sum, session) => sum + session.correctCount / Math.max(1, session._count.questions), 0) / completed.length : 0;
  const totalMinutes = sessions.reduce((sum, session) => sum + Math.max(1, Math.round(((session.completedAt ?? new Date()).getTime() - session.startedAt.getTime()) / 60_000)), 0);
  return <AppShell role="student" currentPath="/student/history"><div className="safe-bottom"><PageHeader title="练习记录" description="综合练习和知识点专项练习分别留档，刷新或重新登录后仍可查看。" /><div className="grid gap-4 lg:grid-cols-3"><Summary icon={BarChart3} label="累计练习" value={`${sessions.length} 次`} /><Summary icon={CheckCircle2} label="平均正确率" value={formatPercent(average)} /><Summary icon={Clock3} label="累计学习" value={`${totalMinutes} 分钟`} /></div><Card className="mt-6"><CardContent className="p-0">{sessions.length ? <div className="divide-y divide-[var(--border)]">{sessions.map((session) => { const total=session._count.questions; const score=total ? session.correctCount/total : 0; const title=session.knowledgePoint ? `${session.knowledgePoint.name} · ${session.level.code}级` : `${session.level.code}级综合练习`; return <div key={session.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="grid size-12 place-items-center rounded-2xl bg-[var(--secondary)] text-[var(--primary)]"><CalendarDays className="size-5" /></div><div className="flex-1"><div className="font-extrabold">{title}</div><div className="mt-1 text-sm text-[var(--muted-foreground)]">{total} 题 · {session.startedAt.toLocaleString("zh-CN")}</div></div><Badge tone={session.status === "COMPLETED" ? score >= .8 ? "green" : "amber" : "blue"}>{session.status === "COMPLETED" ? `${formatPercent(score)} 正确率` : "进行中"}</Badge></div>; })}</div> : <div className="p-12 text-center text-sm text-[var(--muted-foreground)]">还没有练习记录，先完成一次等级综合练习吧。</div>}</CardContent></Card></div></AppShell>;
}
function Summary({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) { return <Card><CardContent className="flex items-center gap-4"><div className="grid size-11 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--primary)]"><Icon className="size-5" /></div><div><div className="text-sm text-[var(--muted-foreground)]">{label}</div><div className="mt-1 text-xl font-extrabold">{value}</div></div></CardContent></Card>; }
