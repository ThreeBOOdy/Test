import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookX, ListOrdered, Shuffle, Star, TimerReset, type LucideIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Artwork } from "@/components/visual/artwork";
import { CallsignLabel, FrequencyScale, SignalMeter } from "@/components/visual/radio-instruments";
import { buildPracticeLaunchHref } from "@/lib/domain/practice-launcher";
import { normalizePracticeLaunch } from "@/lib/domain/practice-launcher";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { getStudentActiveLevelAccess } from "@/lib/server/student-level-access";
import { createPracticeSession } from "@/lib/server/practice-service";

type LaunchCardProps = { href: string; title: string; description: string; meta: string; icon: LucideIcon; art?: string };

export default async function PracticeStartPage({ searchParams }: { searchParams: Promise<{ mode?: string; level?: string; knowledge?: string; blueprint?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.capability !== "FULL_STUDENT") redirect("/login?next=/student/practice/start");
  const activeLevelAccess = await getStudentActiveLevelAccess(user.id);
  const hasActiveLevel = Boolean(activeLevelAccess.activeLevelId && activeLevelAccess.activeLevel?.enabled);
  const params = await searchParams;
  if (params.mode && !hasActiveLevel) redirect("/student/practice/start");
  if (params.mode) {
    const launch = normalizePracticeLaunch(params);
    const session = await createPracticeSession(user.id,
      launch.mode === "WRONG_QUESTION" ? { mode: "wrong", questionId: launch.questionId }
        : launch.mode === "KNOWLEDGE_POINT" ? { mode: "knowledge", levelCode: launch.levelCode ?? "", knowledgePointId: launch.knowledgePointId ?? "" }
          : launch.mode === "QUESTION_ORDER" ? { mode: "order", levelCode: launch.levelCode ?? "" }
            : launch.mode === "RANDOM_ALL" ? { mode: "random", levelCode: launch.levelCode ?? "" }
              : launch.mode === "MOCK_EXAM" ? { mode: "exam", levelCode: launch.levelCode ?? "", blueprintId: launch.blueprintId }
                : launch.mode === "FAVORITE" ? { mode: "favorite" }
                : { mode: "level", levelCode: launch.levelCode ?? "" });
    redirect(`/student/practice?session=${session.id}`);
  }
  const activeLevelId = activeLevelAccess.activeLevelId;
  const [examBlueprints, questions, studentLevelProgress, activeSession, wrongCount, favoriteCount] = await Promise.all([
    prisma.examBlueprint.findMany({
      where: { levelId: activeLevelId ?? "", enabled: true },
      include: { items: { select: { singleCount: true, multipleCount: true } } },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    prisma.question.findMany({ where: { status: "ACTIVE", knowledgePoint: { enabled: true } }, select: { levels: { select: { levelId: true } }, knowledgePointId: true, type: true } }),
    activeLevelId
      ? prisma.studentLevelProgress.findUnique({ where: { userId_levelId: { userId: user.id, levelId: activeLevelId } } })
      : Promise.resolve(null),
    prisma.practiceSession.findFirst({ where: { userId: user.id, status: "IN_PROGRESS" }, orderBy: { startedAt: "desc" }, select: { id: true } }),
    activeLevelId
      ? prisma.studentLevelQuestionState.count({ where: { userId: user.id, levelId: activeLevelId, wrongCount: { gt: 0 }, question: { status: "ACTIVE", knowledgePoint: { enabled: true } } } })
      : Promise.resolve(0),
    activeLevelId
      ? prisma.studentLevelQuestionState.count({ where: { userId: user.id, levelId: activeLevelId, favorite: true, question: { status: "ACTIVE", knowledgePoint: { enabled: true } } } })
      : Promise.resolve(0),
  ]);
  const availableExams = activeLevelId
    ? examBlueprints
        .filter((blueprint) => blueprint.items.length > 0)
        .map((blueprint) => ({
          id: blueprint.id,
          name: blueprint.name,
          durationMinutes: blueprint.durationMinutes,
          totalCount: blueprint.items.reduce((sum, item) => sum + item.singleCount + item.multipleCount, 0),
        }))
    : [];
  const activeLevelQuestionTotal = activeLevelId ? questions.filter((question) => question.levels.some((item) => item.levelId === activeLevelId)).length : 0;
  const orderLevel = activeLevelAccess.activeLevel?.enabled ? activeLevelAccess.activeLevel : null;
  const randomLevel = activeLevelAccess.activeLevel?.enabled ? activeLevelAccess.activeLevel : null;
  const orderTotal = activeLevelQuestionTotal;
  const randomTotal = activeLevelQuestionTotal;
  const orderResumeDescription = studentLevelProgress && studentLevelProgress.lastIndex > 0 && studentLevelProgress.lastIndex < orderTotal
    ? `上次做到第 ${studentLevelProgress.lastIndex + 1} / ${orderTotal} 题，可继续`
    : studentLevelProgress && studentLevelProgress.roundCount > 0
      ? `已完成 ${studentLevelProgress.roundCount} 轮，开始新一轮`
      : "从第一题开始连续刷题";
  const channelCount = (orderLevel && orderTotal > 0 ? 1 : 0) + (randomLevel && randomTotal > 0 ? 1 : 0) + (wrongCount > 0 ? 1 : 0) + availableExams.length + (favoriteCount > 0 ? 1 : 0);
  return <AppShell role="student" currentPath="/student/practice/start"><div className="safe-bottom"><div className="receiver-panel instrument-grid rounded-[2rem] p-6 sm:p-8"><div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex flex-wrap items-center gap-3"><CallsignLabel value="TRAIN / MODE SELECT" /><Badge tone="blue">训练启动器</Badge></div><h1 className="mt-4 text-4xl font-black tracking-[-0.055em]">选择一条清晰的训练频段</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">所有练习模式统一在这里调谐；完成训练后可返回任务台查看成长记录或整理错题信号。</p><div className="mt-5 flex items-center gap-3 text-xs text-[var(--muted-foreground)]"><SignalMeter value={channelCount ? 5 : 1} label="训练频道库存" />已发现 {channelCount} 个可用频道</div></div>{hasActiveLevel && activeSession ? <Link href={`/student/practice?session=${activeSession.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-[var(--primary-foreground)]"><ArrowRight className="size-4" />继续上次练习</Link> : null}</div><FrequencyScale active={4} className="mt-7" /></div>{hasActiveLevel ? <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{orderLevel && orderTotal > 0 ? <LaunchCard key="order-active-level" href={buildPracticeLaunchHref({ mode: "QUESTION_ORDER", levelCode: orderLevel.code })} title={`${orderLevel.code}级顺序训练`} description={orderResumeDescription} meta={`${orderTotal} 题 · 完成 ${studentLevelProgress?.roundCount ?? 0} 轮`} icon={ListOrdered} /> : null}{randomLevel && randomTotal > 0 ? <LaunchCard key="random-active-level" href={buildPracticeLaunchHref({ mode: "RANDOM_ALL", levelCode: randomLevel.code })} title={`${randomLevel.code}级智能随机`} description="优先抽取尚未完成的题目，减少重复曝光。" meta={`${randomTotal} 题`} icon={Shuffle} /> : null}{wrongCount > 0 ? <LaunchCard key="wrong-mode" href={buildPracticeLaunchHref({ mode: "WRONG_QUESTION" })} title="错题模式" description="集中巩固未掌握错题，按复习计划优先安排。" meta={`${wrongCount} 道待巩固`} icon={BookX} /> : <LaunchCard key="wrong-mode-empty" href="/student/wrong" title="错题模式" description="暂无待巩固错题，先查看错题列表。" meta="0 道待巩固" icon={BookX} />}{favoriteCount > 0 ? <LaunchCard key="favorite-list" href="/student/favorites" title="收藏列表" description="查看并练习你收藏的题目。" meta={`${favoriteCount} 道收藏`} icon={Star} /> : <LaunchCard key="favorite-list-empty" href="/student/favorites" title="收藏列表" description="暂无收藏题目，先浏览收藏列表。" meta="0 道收藏" icon={Star} />}{availableExams.length > 0 ? availableExams.map((blueprint) => <LaunchCard key={`exam-${blueprint.id}`} href={buildPracticeLaunchHref({ mode: "MOCK_EXAM", levelCode: activeLevelAccess.activeLevel!.code, blueprintId: blueprint.id })} title={`${activeLevelAccess.activeLevel!.code}级·${blueprint.name}`} description="按教师配置的蓝图抽题，限时作答，统一交卷后查看成绩。" meta={`${blueprint.totalCount} 题 · ${blueprint.durationMinutes ? blueprint.durationMinutes + " 分钟" : "不限时"}`} icon={TimerReset} art="/art/exam-countdown-console.webp" />) : <Card><CardContent className="p-10 text-center"><div className="text-lg font-extrabold">尚未配置模拟测试蓝图</div><p className="mt-2 text-sm text-[var(--muted-foreground)]">老师为当前字母类配置蓝图后，模拟考试入口会出现在这里。</p></CardContent></Card>}</div> : <div className="mt-8"><Card><CardContent className="p-12 text-center"><div className="text-lg font-extrabold">未分配题库，请联系老师</div><p className="mt-2 text-sm text-[var(--muted-foreground)]">老师为你分配字母类后，练习入口会出现在这里。</p></CardContent></Card></div>}</div></AppShell>;
}

function LaunchCard({ href, title, description, meta, icon: Icon, art }: LaunchCardProps) {
  return <Link href={href as never} className="group"><Card variant="receiver" className="h-full overflow-hidden">{art ? <div className="relative h-36 overflow-hidden border-b border-[var(--border)]"><Artwork src={art} alt={`${title}氛围图`} sizes="(max-width: 768px) 100vw, 33vw" variant="spectrum" /><div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,9,15,.04),rgba(4,9,15,.58)),linear-gradient(90deg,rgba(4,9,15,.3),transparent_45%)]" /><span className="font-radio absolute left-4 top-4 rounded-full border border-amber-200/30 bg-[rgba(4,9,15,.55)] px-2.5 py-1 text-[9px] font-bold tracking-[.22em] text-amber-300 backdrop-blur-sm">TIMED EXAM</span></div> : null}<CardContent><div className="flex items-start justify-between"><div className="grid size-11 place-items-center rounded-2xl border border-cyan-600/15 bg-cyan-500/10 text-[var(--primary)]"><Icon className="size-5" /></div><ArrowRight className="size-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--primary)]" /></div><div className="font-radio mt-6 text-[9px] tracking-[.14em] text-[var(--muted-foreground)]">AVAILABLE CHANNEL</div><h2 className="mt-1 text-lg font-black">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p><div className="font-radio mt-5 text-[11px] font-bold text-[var(--primary)]">{meta}</div><FrequencyScale active={3} className="mt-4 opacity-70" /></CardContent></Card></Link>;
}
