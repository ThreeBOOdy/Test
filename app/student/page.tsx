import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookCheck, Brain, CircleCheck, Clock3, Layers3, Play, RadioTower, Target, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <AppShell role="student" currentPath="/student">
      <div className="safe-bottom">
        <section className="relative overflow-hidden rounded-[30px] bg-[var(--ink)] px-6 py-7 text-white shadow-[0_30px_80px_rgba(4,25,42,.18)] sm:px-8 sm:py-9 xl:min-h-[310px]">
          <Image src="/visuals/knowledge-signal.png" alt="无线电知识网络" fill priority sizes="(max-width: 1280px) 100vw, 80vw" className="object-cover object-[72%_52%] opacity-45" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#071727_12%,rgba(7,23,39,.92)_45%,rgba(7,23,39,.18))]" />
          <div className="relative z-10 max-w-2xl fade-up">
            <div className="flex items-center gap-2 text-xs font-black tracking-[0.18em] text-cyan-200"><span className="size-1.5 rounded-full bg-cyan-300 signal-glow" />LEARNING SIGNAL ONLINE</div>
            <h1 className="mt-5 text-3xl font-black tracking-[-0.05em] sm:text-4xl">欢迎回来，{user.displayName}</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">今天继续保持清晰信号。系统会根据等级与知识点配置，为你随机生成不重复的练习任务。</p>
            <div className="mt-7 flex flex-wrap gap-3">
              {featuredLevel ? <Link href={`/student/practice?mode=level&level=${featuredLevel.level.code}`} className="group inline-flex h-12 items-center gap-3 rounded-xl bg-[linear-gradient(135deg,#16b8c2,#087b87)] px-5 text-sm font-extrabold shadow-[0_16px_34px_rgba(0,185,198,.25)] transition hover:-translate-y-0.5"><Play className="size-4 fill-current" />开始 {featuredLevel.level.code} 级训练<ArrowRight className="size-4 transition group-hover:translate-x-1" /></Link> : null}
              <Link href="/student/wrong" className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/[.07] px-5 text-sm font-extrabold backdrop-blur transition hover:bg-white/[.12]"><Brain className="size-4 text-amber-300" />巩固错题</Link>
            </div>
          </div>
          <div className="glass-panel absolute bottom-7 right-7 hidden w-56 rounded-2xl p-4 xl:block"><div className="flex items-center justify-between text-xs text-slate-400"><span>当前学习信号</span><RadioTower className="size-4 text-cyan-300" /></div><div className="mt-4 flex items-end gap-1.5">{[34,48,62,78,94,70,56,82,66,90].map((height, index) => <span key={index} className="w-full rounded-full bg-[linear-gradient(180deg,#65efe5,#148f9c)]" style={{ height: `${height * .52}px` }} />)}</div><div className="mt-3 flex items-center justify-between"><span className="text-sm font-black">状态良好</span><span className="text-xs font-bold text-emerald-300">READY</span></div></div>
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Clock3} label="近7日学习" value={`${activeDays} 天`} helper={`${weeklySessions.length} 次练习`} tone="amber" />
          <StatCard icon={CircleCheck} label="累计正确率" value={`${accuracy}%`} helper={`${correct} / ${answered || 0} 题答对`} />
          <StatCard icon={BookCheck} label="本周练习" value={`${weeklyAnswered} 题`} helper={`${weeklySessions.length} 次已完成`} tone="blue" />
          <StatCard icon={Brain} label="待巩固错题" value={`${wrongQuestions.length} 题`} helper={`${weakKnowledgeCount} 个知识点`} tone="rose" />
        </div>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <div>
            <SectionTitle eyebrow="QUICK START" title="选择训练频道" helper="仅显示库存充足的配置" />
            {featuredLevel || featuredKnowledge ? <div className="grid gap-4 md:grid-cols-2">
              {featuredLevel ? <PracticeModeCard href={`/student/practice?mode=level&level=${featuredLevel.level.code}`} icon={Layers3} eyebrow="LEVEL CHANNEL" title={`${featuredLevel.level.name}综合练习`} description="从该等级全部启用知识点中随机抽题。" single={featuredLevel.singleCount} multiple={featuredLevel.multipleCount} tone="cyan" /> : null}
              {featuredKnowledge ? <PracticeModeCard href={`/student/practice?mode=knowledge&level=${featuredKnowledge.level.code}&knowledge=${featuredKnowledge.knowledgePointId}`} icon={Target} eyebrow="FOCUS CHANNEL" title={featuredKnowledge.knowledgePoint.name} description={`${featuredKnowledge.level.name} · 专项突破`} single={featuredKnowledge.singleCount} multiple={featuredKnowledge.multipleCount} tone="amber" /> : null}
            </div> : <Card><CardContent className="py-12 text-center text-sm text-[var(--muted-foreground)]">暂时没有库存充足的练习配置，请联系教师。</CardContent></Card>}

            {availableKnowledge.length ? <div className="mt-7"><SectionTitle eyebrow="KNOWLEDGE MAP" title="更多专项频段" /><div className="grid gap-3 sm:grid-cols-2">{availableKnowledge.map((rule) => <Link key={rule.id} href={`/student/practice?mode=knowledge&level=${rule.level.code}&knowledge=${rule.knowledgePointId}`} className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-[0_16px_34px_rgba(18,52,73,.08)]"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-[var(--primary)]"><Zap className="size-4" /></div><div className="min-w-0"><div className="truncate font-extrabold">{rule.knowledgePoint.name}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{rule.level.code}级 · {rule.singleCount + rule.multipleCount} 题</div></div><ArrowRight className="ml-auto size-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[var(--primary)]" /></Link>)}</div></div> : null}
          </div>

          <div>
            <SectionTitle eyebrow="RECENT LOG" title="最近练习记录" helper={<Link href="/student/history" className="font-bold text-[var(--primary)]">查看全部</Link>} />
            <Card className="overflow-hidden"><CardContent className="p-0">{sessions.length ? sessions.slice(0, 5).map((session, index) => {
              const total = session.singleCountSnapshot + session.multipleCountSnapshot;
              const rate = total ? Math.round(session.correctCount / total * 100) : 0;
              return <div key={session.id} className="flex items-center gap-4 border-b border-[var(--border)] px-5 py-4 last:border-0"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--muted)] text-sm font-black text-[var(--primary)]">{String(index + 1).padStart(2, "0")}</div><div className="min-w-0 flex-1"><div className="truncate font-extrabold">{session.knowledgePoint?.name ?? `${session.level.code}级综合练习`}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{session.startedAt.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })} · {total} 题</div></div><div className="text-right"><div className="stat-number text-xl font-black text-[var(--ink)]">{rate}%</div><div className="text-[10px] font-bold tracking-wider text-[var(--muted-foreground)]">ACCURACY</div></div></div>;
            }) : <div className="px-6 py-12 text-center text-sm text-[var(--muted-foreground)]">完成第一次练习后，这里会形成你的学习轨迹。</div>}</CardContent></Card>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SectionTitle({ eyebrow, title, helper }: { eyebrow: string; title: string; helper?: React.ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-3"><div><div className="text-[10px] font-black tracking-[0.2em] text-[var(--primary)]">{eyebrow}</div><h2 className="mt-1 text-xl font-black tracking-[-0.035em]">{title}</h2></div>{helper ? <div className="text-xs text-[var(--muted-foreground)]">{helper}</div> : null}</div>;
}

function PracticeModeCard({ href, icon: Icon, eyebrow, title, description, single, multiple, tone }: { href: string; icon: typeof Layers3; eyebrow: string; title: string; description: string; single: number; multiple: number; tone: "cyan" | "amber" }) {
  return <Link href={href as never} className="group"><Card className="lift-card h-full overflow-hidden"><CardContent className="relative p-6"><div className={`absolute -right-12 -top-12 size-36 rounded-full blur-2xl ${tone === "cyan" ? "bg-cyan-200/45" : "bg-amber-200/45"}`} /><div className="relative"><div className="flex items-start justify-between"><div className={`grid size-12 place-items-center rounded-2xl ${tone === "cyan" ? "bg-cyan-50 text-cyan-700" : "bg-amber-50 text-amber-700"}`}><Icon className="size-6" /></div><ArrowRight className="size-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[var(--primary)]" /></div><div className="mt-5 text-[10px] font-black tracking-[0.18em] text-[var(--muted-foreground)]">{eyebrow}</div><h3 className="mt-1 text-xl font-black tracking-[-0.035em]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p><div className="mt-5 flex gap-2"><Badge tone="blue">单选 {single}</Badge><Badge tone="amber">多选 {multiple}</Badge></div></div></CardContent></Card></Link>;
}
