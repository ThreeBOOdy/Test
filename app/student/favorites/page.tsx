import Link from "next/link";
import { Star, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PaginationNav } from "@/components/pagination-nav";
import { QuestionRichText } from "@/components/question-rich-text";
import { StudentExplanationCard } from "@/components/student-explanation-card";
import { parseStudentExplanation } from "@/lib/domain/student-explanation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { getStudentActiveLevelAccess } from "@/lib/server/student-level-access";
import { normalizePagination } from "@/lib/server/pagination";

const text = {
  title: "我的收藏",
  description: "收藏的题目会按当前字母类集中在这里，方便随时挑出来重点练习。",
  practice: "练习收藏题",
  favorite: "收藏",
  ignored: "忽略",
  level: "级",
  empty: "暂无收藏题目，在练习中点击收藏后，题目会出现在这里。",
};

export default async function FavoritesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.capability !== "FULL_STUDENT") return null;
  const activeLevelAccess = await getStudentActiveLevelAccess(user.id);
  if (!activeLevelAccess.activeLevelId || !activeLevelAccess.activeLevel?.enabled) {
    return <AppShell role="student" currentPath="/student/favorites"><div className="safe-bottom"><PageHeader title={text.title} description={text.description} /><Card><CardContent className="p-12 text-center"><div className="text-lg font-extrabold">未分配题库，请联系老师</div><p className="mt-2 text-sm text-[var(--muted-foreground)]">老师为你分配字母类后，收藏列表会出现在这里。</p></CardContent></Card></div></AppShell>;
  }
  const activeLevelId = activeLevelAccess.activeLevelId;
  const params = await searchParams;
  const { page, pageSize, skip } = normalizePagination({ page: params.page });
  const where = { userId: user.id, levelId: activeLevelId, favorite: true, question: { status: "ACTIVE" as const, knowledgePoint: { enabled: true } } };
  const [favoriteItems, total] = await Promise.all([
    prisma.studentLevelQuestionState.findMany({
      where,
      include: { question: { include: { levels: { include: { level: true } }, knowledgePoint: true } } },
      orderBy: [{ dueAt: "asc" }, { wrongCount: "desc" }, { ignored: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.studentLevelQuestionState.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const headerAction = (
    <Link href="/student/practice/start?mode=favorite" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white"><Target className="size-4" />{text.practice}</Link>
  );
  return <AppShell role="student" currentPath="/student/favorites"><div className="safe-bottom"><PageHeader title={text.title} description={text.description} action={total > 0 ? headerAction : undefined} /><div className="mb-5"><Badge tone="amber">{text.favorite} {total}</Badge></div><div className="grid gap-4">{favoriteItems.length ? favoriteItems.map((item) => (
    <Card key={item.id}><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Star className="size-5" /></div><div className="flex-1"><div className="font-extrabold leading-6"><QuestionRichText text={item.question.stem} /></div><div className="mt-2 flex flex-wrap gap-2"><Badge>{item.question.knowledgePoint.code} {item.question.knowledgePoint.name}</Badge><Badge tone="green">{item.question.levels[0]?.level.code ?? "未归类"}{item.question.levels[0] ? text.level : ""}</Badge><Badge tone={item.question.type === "SINGLE_CHOICE" ? "blue" : "amber"}>{item.question.type === "SINGLE_CHOICE" ? "单选题" : "多选题"}</Badge>{item.ignored ? <Badge>{text.ignored}</Badge> : null}</div><StudentExplanationCard explanation={item.question.explanationStatus === "APPROVED" ? parseStudentExplanation(item.question.explanation) : null} className="mt-3" /></div><div className="flex items-center gap-2 text-sm font-semibold text-amber-700"><Star className="size-4" />{text.favorite}</div></CardContent></Card>
  )) : <Card><CardContent className="p-12 text-center text-sm text-[var(--muted-foreground)]">{text.empty}</CardContent></Card>}</div><PaginationNav page={page} totalPages={totalPages} path="/student/favorites" /></div></AppShell>;
}
