import Link from "next/link";
import { ArrowRight, BookCheck, Brain, CircleCheck, Clock3, Layers3, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { getDaysAgo } from "@/lib/server/time";

export default async function StudentPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const sevenDaysAgo = getDaysAgo(7);
  const [sessions, wrongQuestions, levelRules, knowledgeRules, activeQuestions] = await Promise.all([
    prisma.practiceSession.findMany({ where: { userId: user.id, status: "COMPLETED" }, include: { level: true, knowledgePoint: true }, orderBy: { completedAt: "desc" } }),
    prisma.wrongQuestion.findMany({ where: { userId: user.id, mastered: false }, select: { question: { select: { knowledgePointId: true } } } }),
    prisma.levelPracticeRule.findMany({ where: { enabled: true, level: { enabled: true } }, include: { level: true }, orderBy: { level: { sortOrder: "asc" } } }),
    prisma.knowledgePracticeRule.findMany({ where: { enabled: true, level: { enabled: true }, knowledgePoint: { enabled: true } }, include: { level: true, knowledgePoint: true }, orderBy: [{ knowledgePoint: { sortOrder: "asc" } }, { level: { sortOrder: "asc" } }] }),
    prisma.question.findMany({ where: { status: "ACTIVE", knowledgePoint: { enabled: true } }, select: { levelId: true, type: true, knowledgePoint: { select: { path: true } } } }),
  ]);

  const answered = sessions.reduce((sum, session) => sum + session.singleCountSnapshot + session.multipleCountSnapshot, 0);
  const correct = sessions.reduce((sum, session) => sum + session.correctCount, 0);
  const accuracy = answered ? Math.round(correct / answered * 100) : 0;
  const weeklySessions = sessions.filter((session) => session.startedAt >= sevenDaysAgo);
  const weeklyAnswered = weeklySessions.reduce((sum, session) => sum + session.singleCountSnapshot + session.multipleCountSnapshot, 0);
  const activeDays = new Set(weeklySessions.map((session) => session.startedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }))).size;
  const weakKnowledgeCount = new Set(wrongQuestions.map((item) => item.question.knowledgePointId)).size;

  const availableLevels = levelRules.filter((rule) => {
    const pool = activeQuestions.filter((question) => question.levelId === rule.levelId);
    const singles = pool.filter((question) => question.type === "SINGLE_CHOICE").length;
    return singles >= rule.singleCount && pool.length - singles >= rule.multipleCount && rule.singleCount + rule.multipleCount > 0;
  });
  const availableKnowledge = knowledgeRules.filter((rule) => {
    const pool = activeQuestions.filter((question) => question.levelId === rule.levelId && (question.knowledgePoint.path === rule.knowledgePoint.path || question.knowledgePoint.path.startsWith(`${rule.knowledgePoint.path}/`)));
    const singles = pool.filter((question) => question.type === "SINGLE_CHOICE").length;
    return singles >= rule.singleCount && pool.length - singles >= rule.multipleCount && rule.singleCount + rule.multipleCount > 0;
  }).slice(0, 6);
  const featuredLevel = availableLevels[0];
  const featuredKnowledge = availableKnowledge[0];

  return <AppShell role="student" currentPath="/student"><div className="safe-bottom"><PageHeader title={`欢迎回来，${user.displayName}`} description="练习配置和学习数据均来自数据库。完成练习后，正确率、历史记录和错题统计会自动更新。" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={Clock3} label="近7日学习" value={`${activeDays} 天`} helper={`${weeklySessions.length} 次练习`} tone="amber" /><StatCard icon={CircleCheck} label="累计正确率" value={`${accuracy}%`} helper={`${correct} / ${answered || 0} 题答对`} /><StatCard icon={BookCheck} label="本周练习" value={`${weeklyAnswered} 题`} helper={`${weeklySessions.length} 次已完成`} tone="blue" /><StatCard icon={Brain} label="待巩固错题" value={`${wrongQuestions.length} 题`} helper={`${weakKnowledgeCount} 个知识点`} tone="rose" /></div><section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_.85fr]"><div><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-extrabold tracking-[-0.03em]">开始一次练习</h2><span className="text-sm text-[var(--muted-foreground)]">仅显示库存充足的配置</span></div>{featuredLevel || featuredKnowledge ? <div className="grid gap-4 md:grid-cols-2">{featuredLevel ? <PracticeModeCard href={`/student/practice?mode=level&level=${featuredLevel.level.code}`} icon={Layers3} title={`${featuredLevel.level.code}级综合练习`} description="从同一等级的全部启用知识点随机抽题，适合阶段性检测。" meta={`单选 ${featuredLevel.singleCount} · 多选 ${featuredLevel.multipleCount}`} tone="dark" /> : null}{featuredKnowledge ? <PracticeModeCard href={`/student/practice?mode=knowledge&level=${featuredKnowledge.level.code}&knowledge=${featuredKnowledge.knowledgePoint.id}`} icon={Target} title="知识点专项练习" description="锁定一个知识点和等级，集中突破薄弱环节。" meta={`${featuredKnowledge.knowledgePoint.name} · ${featuredKnowledge.level.code}级 · ${featuredKnowledge.singleCount + featuredKnowledge.multipleCount}题`} tone="light" /> : null}</div> : <EmptyPanel text="当前没有库存充足的练习配置，请联系教师检查抽题规则。" />}<div className="mt-7"><h2 className="mb-4 text-xl font-extrabold tracking-[-0.03em]">选择专项知识点</h2>{availableKnowledge.length ? <div className="grid gap-3 sm:grid-cols-2">{availableKnowledge.map((rule, index) => <Link key={rule.id} href={`/student/practice?mode=knowledge&level=${rule.level.code}&knowledge=${rule.knowledgePoint.id}` as never} className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-white p-4 transition hover:border-emerald-300 hover:shadow-[var(--shadow-card)]"><div className="grid size-10 place-items-center rounded-xl bg-[var(--muted)] text-sm font-black text-[var(--primary)]">{index + 1}</div><div className="min-w-0"><div className="truncate font-bold">{rule.knowledgePoint.name}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{rule.knowledgePoint.code} · {rule.level.code}级 · {rule.singleCount + rule.multipleCount}题</div></div><ArrowRight className="ml-auto size-4 text-[var(--muted-foreground)] transition group-hover:translate-x-1" /></Link>)}</div> : <EmptyPanel text="教师尚未配置可用的知识点专项练习。" />}</div></div><Card><CardHeader><div className="flex items-start justify-between"><div><CardTitle>最近练习</CardTitle><CardDescription>最近完成的练习成绩</CardDescription></div><BookCheck className="size-5 text-[var(--primary)]" /></div></CardHeader><CardContent className="flex flex-col gap-3">{sessions.slice(0, 5).map((session) => { const total=session.singleCountSnapshot+session.multipleCountSnapshot; const score=total?Math.round(session.correctCount/total*100):0; return <div key={session.id} className="flex items-center gap-3 rounded-2xl bg-[var(--muted)] p-4"><div className="grid size-11 place-items-center rounded-xl bg-white font-extrabold text-[var(--primary)]">{score}%</div><div className="min-w-0"><div className="truncate text-sm font-bold">{session.mode === "WRONG_QUESTION" ? "错题巩固练习" : session.knowledgePoint ? `${session.knowledgePoint.name} · ${session.level?.code ?? "-"}级` : `${session.level?.code ?? "-"}级综合练习`}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">答对 {session.correctCount} / {total} 题</div></div><Badge className="ml-auto" tone={score >= 80 ? "green" : score >= 60 ? "amber" : "red"}>{session.completedAt?.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) ?? "-"}</Badge></div>; })}{sessions.length === 0 ? <div className="py-8 text-center text-sm text-[var(--muted-foreground)]">完成第一次练习后，这里会显示成绩。</div> : null}<Link href="/student/history" className="mt-2 text-center text-sm font-bold text-[var(--primary)]">查看全部记录</Link></CardContent></Card></section></div></AppShell>;
}

function PracticeModeCard({ href, icon: Icon, title, description, meta, tone }: { href: string; icon: typeof Layers3; title: string; description: string; meta: string; tone: "dark" | "light" }) { return <Link href={href as never} className={`group rounded-[22px] p-6 transition hover:-translate-y-1 ${tone === "dark" ? "bg-[var(--ink)] text-white shadow-[0_18px_44px_rgba(19,44,42,.2)]" : "border border-[var(--border)] bg-white"}`}><div className={`grid size-12 place-items-center rounded-2xl ${tone === "dark" ? "bg-white/12 text-emerald-200" : "bg-[var(--secondary)] text-[var(--primary)]"}`}><Icon className="size-6" /></div><h3 className="mt-7 text-xl font-extrabold tracking-[-0.03em]">{title}</h3><p className={`mt-3 min-h-14 text-sm leading-7 ${tone === "dark" ? "text-white/65" : "text-[var(--muted-foreground)]"}`}>{description}</p><div className={`mt-5 flex items-center justify-between rounded-xl px-3 py-3 text-xs font-semibold ${tone === "dark" ? "bg-white/8 text-white/80" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}><span>{meta}</span><ArrowRight className="size-4 transition group-hover:translate-x-1" /></div></Link>; }
function EmptyPanel({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white p-6 text-sm leading-6 text-[var(--muted-foreground)]">{text}</div>; }
