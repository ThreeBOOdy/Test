import Link from "next/link";
import { BarChart3, CalendarDays, CheckCircle2, Clock3, Radio } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptySignalState } from "@/components/visual/empty-signal-state";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { formatPercent } from "@/lib/utils";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  const sessions = user ? await prisma.practiceSession.findMany({ where: { userId: user.id }, include: { level: true, knowledgePoint: true, _count: { select: { questions: true } } }, orderBy: { startedAt: "desc" }, take: 50 }) : [];
  const completed = sessions.filter((session) => session.status === "COMPLETED");
  const average = completed.length ? completed.reduce((sum, session) => sum + session.correctCount / Math.max(1, session._count.questions), 0) / completed.length : 0;
  const totalMinutes = completed.reduce((sum, session) => sum + Math.max(1, Math.round(((session.completedAt ?? session.startedAt).getTime() - session.startedAt.getTime()) / 60_000)), 0);
  return <AppShell role="student" currentPath="/student/history"><div className="safe-bottom"><PageHeader eyebrow="TRAINING ARCHIVE" title="练习记录" description="进行中的频道可直接恢复；已完成训练保留正确率、题量和时间记录。" /><div className="grid gap-4 lg:grid-cols-3"><Summary icon={BarChart3} label="累计训练" value={`${sessions.length} 次`} /><Summary icon={CheckCircle2} label="平均正确率" value={formatPercent(average)} /><Summary icon={Clock3} label="累计学习" value={`${totalMinutes} 分钟`} /></div><Card className="mt-6"><CardContent className="p-0">{sessions.length ? <div className="divide-y divide-[var(--border)]">{sessions.map((session) => { const total = session._count.questions; const score = total ? session.correctCount / total : 0; const title = session.knowledgePoint ? `${session.knowledgePoint.name} · ${session.level.code}级` : `${session.level.code}级综合训练`; return <div key={session.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className={`grid size-12 place-items-center rounded-2xl border ${session.status === "IN_PROGRESS" ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-200" : "border-slate-300/10 bg-[var(--surface-soft)] text-[var(--muted-foreground)]"}`}>{session.status === "IN_PROGRESS" ? <Radio className="size-5" /> : <CalendarDays className="size-5" />}</div><div className="flex-1"><div className="font-extrabold">{title}</div><div className="mt-1 text-sm text-[var(--muted-foreground)]">{total} 题 · {session.startedAt.toLocaleString("zh-CN")}</div></div>{session.status === "IN_PROGRESS" ? <Link href={`/student/practice?session=${session.id}`} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-foreground)]">继续训练</Link> : <Badge tone={score >= .8 ? "green" : "amber"}>{formatPercent(score)} 正确率</Badge>}</div>; })}</div> : <EmptySignalState title="尚未建立训练记录" description="完成或开始一次训练后，系统会在这里保留频道状态和成绩。" action={<Link href="/student" className="text-sm font-bold text-[var(--primary)]">返回训练首页</Link>} />}</CardContent></Card></div></AppShell>;
}

function Summary({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) { return <Card><CardContent className="flex items-center gap-4"><div className="grid size-11 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/8 text-[var(--primary)]"><Icon className="size-5" /></div><div><div className="text-sm text-[var(--muted-foreground)]">{label}</div><div className="stat-number mt-1 text-xl font-extrabold">{value}</div></div></CardContent></Card>; }
