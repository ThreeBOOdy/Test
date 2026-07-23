import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BookCheck, Brain, CircleCheck, Clock3, Layers3, Radio, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptySignalState } from "@/components/visual/empty-signal-state";
import { Artwork } from "@/components/visual/artwork";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { getDaysAgo } from "@/lib/server/time";

export default async function StudentPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const sevenDaysAgo = getDaysAgo(7);
  const [sessions, wrongQuestions, levelRules, knowledgeRules, activeQuestions] = await Promise.all([
    prisma.practiceSession.findMany({ where: { userId: user.id }, include: { level: true, knowledgePoint: true }, orderBy: { startedAt: "desc" } }),
    prisma.wrongQuestion.findMany({ where: { userId: user.id, mastered: false }, select: { question: { select: { knowledgePointId: true } } } }),
    prisma.levelPracticeRule.findMany({ where: { enabled: true, level: { enabled: true } }, include: { level: true }, orderBy: { level: { sortOrder: "asc" } } }),
    prisma.knowledgePracticeRule.findMany({ where: { enabled: true, level: { enabled: true }, knowledgePoint: { enabled: true } }, include: { level: true, knowledgePoint: true }, orderBy: [{ knowledgePoint: { sortOrder: "asc" } }, { level: { sortOrder: "asc" } }] }),
    prisma.question.findMany({ where: { status: "ACTIVE", knowledgePoint: { enabled: true } }, select: { levelId: true, type: true, knowledgePoint: { select: { path: true } } } }),
  ]);
  const completedSessions = sessions.filter((session) => session.status === "COMPLETED");
  const activeSession = sessions.find((session) => session.status === "IN_PROGRESS");
  const answered = completedSessions.reduce((sum, session) => sum + session.singleCountSnapshot + session.multipleCountSnapshot, 0);
  const correct = completedSessions.reduce((sum, session) => sum + session.correctCount, 0);
  const accuracy = answered ? Math.round(correct / answered * 100) : 0;
  const weeklySessions = completedSessions.filter((session) => session.startedAt >= sevenDaysAgo);
  const weeklyAnswered = weeklySessions.reduce((sum, session) => sum + session.singleCountSnapshot + session.multipleCountSnapshot, 0);
  const activeDays = new Set(weeklySessions.map((session) => session.startedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }))).size;
  const weakKnowledgeCount = new Set(wrongQuestions.map((item) => item.question.knowledgePointId)).size;
  const availableLevels = levelRules.filter((rule) => { const pool = activeQuestions.filter((question) => question.levelId === rule.levelId); const singles = pool.filter((question) => question.type === "SINGLE_CHOICE").length; return singles >= rule.singleCount && pool.length - singles >= rule.multipleCount && rule.singleCount + rule.multipleCount > 0; });
  const availableKnowledge = knowledgeRules.filter((rule) => { const pool = activeQuestions.filter((question) => question.levelId === rule.levelId && (question.knowledgePoint.path === rule.knowledgePoint.path || question.knowledgePoint.path.startsWith(`${rule.knowledgePoint.path}/`))); const singles = pool.filter((question) => question.type === "SINGLE_CHOICE").length; return singles >= rule.singleCount && pool.length - singles >= rule.multipleCount && rule.singleCount + rule.multipleCount > 0; }).slice(0, 6);
  const featuredLevel = availableLevels[0];
  const primaryHref = activeSession ? `/student/practice?session=${activeSession.id}` : featuredLevel ? `/student/practice?mode=level&level=${featuredLevel.level.code}` : "/student/history";
  const primaryTitle = activeSession ? "继续上次训练" : featuredLevel ? `${featuredLevel.level.code}级综合训练` : "查看训练记录";
  const primaryDescription = activeSession ? "系统已定位到第一道未完成题目，草稿和已提交结果会继续保留。" : "进入经过库存校验的综合题组，快速建立完整知识覆盖。";

  return <AppShell role="student" currentPath="/student"><div className="safe-bottom"><PageHeader title={`欢迎回来，${user.displayName}`} description="训练频道、进度和错题信号均来自实时数据库；继续练习会自动定位第一道未答题。" eyebrow="PERSONAL SIGNAL DESK" />
    <section className="relative overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"><div className="grid lg:grid-cols-[1.05fr_.95fr]"><div className="relative z-10 flex flex-col justify-center p-7 sm:p-10 lg:p-12"><div className="flex items-center gap-2 text-xs font-bold text-[var(--primary)]"><Radio className="size-4" />当前优先训练</div><h2 className="mt-4 text-3xl font-black tracking-[-0.045em] sm:text-4xl">{primaryTitle}</h2><p className="mt-4 max-w-xl text-sm leading-8 text-[var(--muted-foreground)]">{primaryDescription}</p><div className="mt-7"><Link href={primaryHref as never} className="inline-flex min-h-12 items-center gap-3 rounded-xl bg-[var(--primary)] px-6 text-sm font-bold text-[var(--primary-foreground)]">进入训练频道<ArrowRight className="size-4" /></Link></div></div><div className="relative min-h-64 overflow-hidden lg:min-h-[390px]"><div className="absolute inset-0 z-10 bg-[linear-gradient(90deg,var(--surface)_0%,transparent_42%),linear-gradient(0deg,rgba(7,11,18,.55),transparent)]" /><Artwork src="/art/student-spectrum-cabin.webp" alt="深色无线电频谱训练舱" sizes="(max-width: 1024px) 100vw, 46vw" priority variant="spectrum" /></div></div></section>
    <section className="mt-8"><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-xs font-bold text-[var(--primary)]">TRAINING CHANNELS</div><h2 className="mt-1 text-xl font-extrabold">选择训练频道</h2></div><span className="text-sm text-[var(--muted-foreground)]">仅显示库存充足的配置</span></div>{availableLevels.length || availableKnowledge.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{availableLevels.map((rule) => <ChannelCard key={rule.id} href={`/student/practice?mode=level&level=${rule.level.code}`} icon={Layers3} title={`${rule.level.code}级综合训练`} description="覆盖本等级所有启用知识点，适合完整检测。" meta={`单选 ${rule.singleCount} · 多选 ${rule.multipleCount}`} />)}{availableKnowledge.map((rule) => <ChannelCard key={rule.id} href={`/student/practice?mode=knowledge&level=${rule.level.code}&knowledge=${rule.knowledgePoint.id}`} icon={Target} title={rule.knowledgePoint.name} description="集中处理单一知识区域，缩短信号定位路径。" meta={`${rule.level.code}级 · ${rule.singleCount + rule.multipleCount} 题`} />)}</div> : <Card><EmptySignalState title="当前没有可用训练频道" description="教师需要补充题库库存或调整抽题规则后才能开始新的练习。" /></Card>}</section>
    <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={Clock3} label="近7日学习" value={`${activeDays} 天`} helper={`${weeklySessions.length} 次已完成训练`} tone="amber" /><StatCard icon={CircleCheck} label="累计正确率" value={`${accuracy}%`} helper={`${correct} / ${answered || 0} 题答对`} /><StatCard icon={BookCheck} label="本周完成" value={`${weeklyAnswered} 题`} helper="仅统计已完成训练" tone="blue" /><StatCard icon={Brain} label="待巩固信号" value={`${wrongQuestions.length} 题`} helper={`${weakKnowledgeCount} 个知识点`} tone="rose" /></section>
    <section className="mt-8 grid gap-4 lg:grid-cols-2"><Card><CardContent><div className="flex items-center justify-between"><div><div className="text-sm font-extrabold">最近训练</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">最近完成的三个频道</div></div><Link href="/student/history" className="text-sm font-bold text-[var(--primary)]">全部记录</Link></div><div className="mt-5 space-y-3">{completedSessions.slice(0, 3).map((session) => <div key={session.id} className="flex items-center justify-between rounded-2xl bg-[var(--surface-soft)] p-4"><div><div className="font-bold">{session.knowledgePoint ? `${session.knowledgePoint.name} · ${session.level.code}级` : `${session.level.code}级综合训练`}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{session.startedAt.toLocaleDateString("zh-CN")}</div></div><Badge tone="green">{session.correctCount} 题正确</Badge></div>)}{completedSessions.length === 0 ? <div className="text-sm text-[var(--muted-foreground)]">完成一次训练后，这里会建立记录。</div> : null}</div></CardContent></Card><Card><CardContent><div className="flex items-start gap-4"><div className="grid size-12 place-items-center rounded-2xl border border-rose-300/20 bg-rose-400/10 text-rose-200"><Brain className="size-5" /></div><div className="flex-1"><div className="font-extrabold">错题信号待处理</div><p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">当前有 {wrongQuestions.length} 道题需要巩固。优先按知识点聚合查看，减少重复浏览。</p><Link href="/student/wrong" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--primary)]">打开错题频道<ArrowRight className="size-4" /></Link></div></div></CardContent></Card></section>
  </div></AppShell>;
}

function ChannelCard({ href, icon: Icon, title, description, meta }: { href: string; icon: LucideIcon; title: string; description: string; meta: string }) { return <Link href={href as never} className="group"><Card className="h-full transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)]"><CardContent><div className="flex items-start justify-between"><div className="grid size-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-[var(--primary)]"><Icon className="size-5" /></div><ArrowRight className="size-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1" /></div><h3 className="mt-5 text-lg font-extrabold">{title}</h3><p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">{description}</p><Badge className="mt-5" tone="blue">{meta}</Badge></CardContent></Card></Link>; }
