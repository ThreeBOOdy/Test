import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpenCheck, Brain, ListOrdered, Shuffle, TimerReset } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getKnowledgeRuleInventory, isPracticeRuleWithinInventory } from "@/lib/domain/knowledge-rules";
import { buildPracticeLaunchHref } from "@/lib/domain/practice-launcher";
import { normalizePracticeLaunch } from "@/lib/domain/practice-launcher";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { createPracticeSession } from "@/lib/server/practice-service";

type LaunchCardProps = { href: string; title: string; description: string; meta: string; icon: typeof Brain };

export default async function PracticeStartPage({ searchParams }: { searchParams: Promise<{ mode?: string; level?: string; knowledge?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.capability !== "FULL_STUDENT") redirect("/login?next=/student/practice/start");
  const params = await searchParams;
  if (params.mode) {
    const launch = normalizePracticeLaunch(params);
    const session = await createPracticeSession(user.id,
      launch.mode === "WRONG_QUESTION" ? { mode: "wrong" }
        : launch.mode === "KNOWLEDGE_POINT" ? { mode: "knowledge", levelCode: launch.levelCode ?? "A", knowledgePointId: launch.knowledgePointId ?? "" }
          : launch.mode === "QUESTION_ORDER" ? { mode: "order", levelCode: launch.levelCode ?? "A" }
            : launch.mode === "RANDOM_ALL" ? { mode: "random", levelCode: launch.levelCode ?? "A" }
              : launch.mode === "MOCK_EXAM" ? { mode: "exam", levelCode: launch.levelCode ?? "A" }
                : { mode: "level", levelCode: launch.levelCode ?? "A" });
    redirect(`/student/practice?session=${session.id}`);
  }
  const [levels, points, levelRules, knowledgeRules, examRules, questions, activeSession] = await Promise.all([
    prisma.level.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.knowledgePoint.findMany({ where: { enabled: true }, orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { code: "asc" }] }),
    prisma.levelPracticeRule.findMany({ where: { enabled: true }, include: { level: true } }),
    prisma.knowledgePracticeRule.findMany({ where: { enabled: true }, include: { level: true, knowledgePoint: true } }),
    prisma.examRule.findMany({ where: { enabled: true }, include: { level: true } }),
    prisma.question.findMany({ where: { status: "ACTIVE", knowledgePoint: { enabled: true } }, select: { levelId: true, knowledgePointId: true, type: true } }),
    prisma.practiceSession.findFirst({ where: { userId: user.id, status: "IN_PROGRESS" }, orderBy: { startedAt: "desc" }, select: { id: true } }),
  ]);
  const levelById = new Map(levels.map((level) => [level.id, level]));
  const pointById = new Map(points.map((point) => [point.id, point]));
  const availableLevels = levelRules.filter((rule) => {
    const inventory = questions.reduce((result, question) => {
      if (question.levelId !== rule.levelId) return result;
      return { singleCount: result.singleCount + (question.type === "SINGLE_CHOICE" ? 1 : 0), multipleCount: result.multipleCount + (question.type === "MULTIPLE_CHOICE" ? 1 : 0) };
    }, { singleCount: 0, multipleCount: 0 });
    return isPracticeRuleWithinInventory(rule, inventory);
  });
  const availableKnowledge = knowledgeRules.filter((rule) => {
    const point = pointById.get(rule.knowledgePointId);
    if (!point || point.depth !== 2 || point.parentId === null) return false;
    const inventory = getKnowledgeRuleInventory(questions.map((question) => ({ ...question, status: "ACTIVE" as const })), rule.levelId, rule.knowledgePointId);
    return isPracticeRuleWithinInventory(rule, inventory);
  });
  const availableExams = examRules.filter((rule) => {
    const inventory = questions.reduce((result, question) => question.levelId === rule.levelId ? { singleCount: result.singleCount + (question.type === "SINGLE_CHOICE" ? 1 : 0), multipleCount: result.multipleCount + (question.type === "MULTIPLE_CHOICE" ? 1 : 0) } : result, { singleCount: 0, multipleCount: 0 });
    return rule.singleCount <= inventory.singleCount && rule.multipleCount <= inventory.multipleCount;
  });
  const selectedKnowledge = params.knowledge ?? availableKnowledge[0]?.knowledgePointId;
  return <AppShell role="student" currentPath="/student/practice/start"><div className="safe-bottom"><div className="flex flex-col gap-4 border-b border-[var(--border)] pb-8 sm:flex-row sm:items-end sm:justify-between"><div><Badge tone="blue">训练启动器</Badge><h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">选择一条清晰的训练路径</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">所有练习入口统一从这里启动；练习之外可随时返回学习首页、查看成长记录或整理错题。</p></div>{activeSession ? <Link href={`/student/practice?session=${activeSession.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-[var(--primary-foreground)]"><ArrowRight className="size-4" />继续上次练习</Link> : null}</div><div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{availableLevels.map((rule) => <LaunchCard key={`level-${rule.id}`} href={buildPracticeLaunchHref({ mode: "LEVEL_COMPREHENSIVE", levelCode: rule.level.code })} title={`${rule.level.code}级综合训练`} description="覆盖本等级所有启用知识点，适合完整检测。" meta={`单选 ${rule.singleCount} · 多选 ${rule.multipleCount}`} icon={BookOpenCheck} />)}{availableKnowledge.filter((rule) => rule.knowledgePointId === selectedKnowledge || !params.knowledge).slice(0, 12).map((rule) => <LaunchCard key={`knowledge-${rule.id}`} href={buildPracticeLaunchHref({ mode: "KNOWLEDGE_POINT", levelCode: rule.level.code, knowledgePointId: rule.knowledgePointId })} title={rule.knowledgePoint.name} description="聚焦一个二级知识点，快速定位薄弱环节。" meta={`${rule.level.code}级 · ${rule.singleCount + rule.multipleCount} 题`} icon={Brain} />)}{availableLevels.filter((rule) => levelById.has(rule.levelId)).map((rule) => <LaunchCard key={`order-${rule.id}`} href={buildPracticeLaunchHref({ mode: "QUESTION_ORDER", levelCode: rule.level.code })} title={`${rule.level.code}级顺序训练`} description="按题库编号自然顺序建立连续训练路径。" meta={`${rule.singleCount + rule.multipleCount} 题`} icon={ListOrdered} />)}{availableLevels.filter((rule) => levelById.has(rule.levelId)).map((rule) => <LaunchCard key={`random-${rule.id}`} href={buildPracticeLaunchHref({ mode: "RANDOM_ALL", levelCode: rule.level.code })} title={`${rule.level.code}级智能随机`} description="优先抽取尚未完成的题目，减少重复曝光。" meta={`${rule.singleCount + rule.multipleCount} 题`} icon={Shuffle} />)}{availableExams.map((rule) => <LaunchCard key={`exam-${rule.id}`} href={buildPracticeLaunchHref({ mode: "MOCK_EXAM", levelCode: rule.level.code })} title={`${rule.level.code}级模拟考试`} description="限时作答，统一交卷后查看成绩。" meta={`${rule.singleCount + rule.multipleCount} 题 · ${rule.durationMinutes} 分钟`} icon={TimerReset} />)}</div></div></AppShell>;
}

function LaunchCard({ href, title, description, meta, icon: Icon }: LaunchCardProps) {
  return <Link href={href as never} className="group"><Card className="h-full transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)]"><CardContent><div className="flex items-start justify-between"><div className="grid size-11 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-[var(--primary)]"><Icon className="size-5" /></div><ArrowRight className="size-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--primary)]" /></div><h2 className="mt-6 text-lg font-black">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p><div className="mt-5 text-xs font-bold text-[var(--primary)]">{meta}</div></CardContent></Card></Link>;
}
