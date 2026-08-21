import Link from "next/link";
import { AlertTriangle, BookX, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PaginationNav } from "@/components/pagination-nav";
import { QuestionRichText } from "@/components/question-rich-text";
import { StudentExplanationCard } from "@/components/student-explanation-card";
import { parseStudentExplanation } from "@/lib/domain/student-explanation";
import { isMasteredLearningState, isWrongQuestionState } from "@/lib/domain/learning-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { getStudentActiveLevelAccess } from "@/lib/server/student-level-access";
import { normalizePagination } from "@/lib/server/pagination";

const text = {
  title: "我的错题",
  description: "答错的题目会自动收进这里；系统会按复习计划优先安排需要巩固的题目。",
  practice: "随机巩固错题",
  pending: "待巩固",
  mastered: "已掌握",
  wrong: "错",
  times: "次",
  empty: "暂无错题，继续保持。",
  favorite: "收藏",
  ignored: "忽略",
  lastResult: "最近结果",
  correct: "最近答对",
  incorrect: "最近答错",
  level: "级",
};

function stateLabel(state: string) {
  if (state === "REVIEW") return "复习中";
  if (state === "RELEARNING") return "重学中";
  if (state === "LEARNING") return "学习中";
  return "新题";
}

export default async function WrongPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.capability !== "FULL_STUDENT") return null;
  const activeLevelAccess = await getStudentActiveLevelAccess(user.id);
  if (!activeLevelAccess.activeLevelId || !activeLevelAccess.activeLevel?.enabled) {
    return <AppShell role="student" currentPath="/student/wrong"><div className="safe-bottom"><PageHeader title="我的错题" description="答错的题目会自动收进这里；系统会按复习计划优先安排需要巩固的题目。" /><Card><CardContent className="p-12 text-center"><div className="text-lg font-extrabold">未分配题库，请联系老师</div><p className="mt-2 text-sm text-[var(--muted-foreground)]">老师为你分配字母类后，错题练习入口会出现在这里。</p></CardContent></Card></div></AppShell>;
  }
  const activeLevelId = activeLevelAccess.activeLevelId;
  const params = await searchParams;
  const { page, pageSize, skip } = normalizePagination({ page: params.page });
  const [wrongItems, allWrongStates] = await Promise.all([
    prisma.studentLevelQuestionState.findMany({
      where: { userId: user.id, levelId: activeLevelId, wrongCount: { gt: 0 }, question: { status: "ACTIVE", knowledgePoint: { enabled: true } } },
      include: { question: { include: { levels: { include: { level: true } }, knowledgePoint: true } } },
      orderBy: [{ favorite: "desc" }, { dueAt: "asc" }, { wrongCount: "desc" }, { ignored: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.studentLevelQuestionState.findMany({
      where: { userId: user.id, levelId: activeLevelId, wrongCount: { gt: 0 }, question: { status: "ACTIVE", knowledgePoint: { enabled: true } } },
      select: { id: true, state: true, intervalDays: true, wrongCount: true },
    }),
  ]);
  const total = allWrongStates.length;
  const pending = allWrongStates.filter(isWrongQuestionState).length;
  const mastered = total - pending;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <AppShell role="student" currentPath="/student/wrong"><div className="safe-bottom"><PageHeader title={text.title} description={text.description} action={<Link href="/student/practice/start?mode=wrong" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white"><Target className="size-4" />{text.practice}</Link>} /><div className="mb-5 flex gap-2"><Badge tone="red">{text.pending} {pending}</Badge><Badge>{text.mastered} {mastered}</Badge></div><div className="grid gap-4">{wrongItems.length ? wrongItems.map((item) => {
    const masteredItem = isMasteredLearningState(item);
    return <Card key={item.id} className={masteredItem ? "opacity-70" : ""}><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid size-11 place-items-center rounded-2xl bg-rose-50 text-rose-700"><BookX className="size-5" /></div><div className="flex-1"><div className="font-extrabold leading-6"><QuestionRichText text={item.question.stem} /></div><div className="mt-2 flex flex-wrap gap-2"><Badge>{item.question.knowledgePoint.code} {item.question.knowledgePoint.name}</Badge><Badge tone="green">{item.question.levels[0]?.level.code ?? "未归类"}{item.question.levels[0] ? text.level : ""}</Badge><Badge tone={item.question.type === "SINGLE_CHOICE" ? "blue" : "amber"}>{item.question.type === "SINGLE_CHOICE" ? "单选题" : "多选题"}</Badge>{item.favorite ? <Badge>{text.favorite}</Badge> : null}{item.ignored ? <Badge>{text.ignored}</Badge> : null}{masteredItem ? <Badge tone="green">{text.mastered}</Badge> : <Badge tone="amber">{stateLabel(item.state)}</Badge>}</div><div className="mt-2 text-xs text-[var(--muted-foreground)]">{text.lastResult}：{item.lastResult === "CORRECT" ? text.correct : item.lastResult === "INCORRECT" ? text.incorrect : "—"}</div><StudentExplanationCard explanation={item.question.explanationStatus === "APPROVED" ? parseStudentExplanation(item.question.explanation) : null} className="mt-3" /></div><div className="flex items-center gap-2 text-sm font-semibold text-rose-700"><AlertTriangle className="size-4" />{text.wrong} {item.wrongCount} {text.times}</div></CardContent></Card>;
  }) : <Card><CardContent className="p-12 text-center text-sm text-[var(--muted-foreground)]">{text.empty}</CardContent></Card>}</div><PaginationNav page={page} totalPages={totalPages} path="/student/wrong" /></div></AppShell>;
}
