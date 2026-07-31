import Link from "next/link";
import { AlertTriangle, BookX, Target } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PaginationNav } from "@/components/pagination-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { RADIO_COURSE_ID } from "@/lib/domain/course";
import { getCurrentUser } from "@/lib/server/session";
import { normalizePagination } from "@/lib/server/pagination";

const text = {
  title: "\u6211\u7684\u9519\u9898",
  description: "\u9519\u9898\u7531\u670d\u52a1\u7aef\u81ea\u52a8\u8bb0\u5f55\uff1b\u5728\u4e09\u4e2a\u4e0d\u540c\u7684\u5df2\u7ed3\u7b97\u4f1a\u8bdd\u4e2d\u8fde\u7eed\u7b54\u5bf9\u4e09\u6b21\u540e\u6807\u8bb0\u4e3a\u5df2\u638c\u63e1\u3002",
  practice: "\u968f\u673a\u5de9\u56fa\u9519\u9898",
  pending: "\u5f85\u5de9\u56fa",
  mastered: "\u5df2\u638c\u63e1",
  wrong: "\u9519",
  times: "\u6b21",
  empty: "\u6682\u65e0\u9519\u9898\uff0c\u7ee7\u7eed\u4fdd\u6301\u3002",
  streak: "\u8fde\u7eed\u7b54\u5bf9",
  lastReason: "\u6700\u8fd1\u539f\u56e0",
  answeredWrong: "\u7b54\u9519",
  unanswered: "\u8003\u8bd5\u672a\u4f5c\u7b54",
  level: "\u7ea7",
};

export default async function WrongPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.capability !== "FULL_STUDENT") return null;
  const params = await searchParams;
  const { page, pageSize, skip } = normalizePagination({ page: params.page });
  const [wrongItems, total, pending] = await Promise.all([
    prisma.wrongQuestion.findMany({ where: { courseId: RADIO_COURSE_ID, userId: user.id }, include: { question: { include: { level: true, knowledgePoint: true } } }, orderBy: [{ mastered: "asc" }, { lastWrongAt: "desc" }], skip, take: pageSize }),
    prisma.wrongQuestion.count({ where: { courseId: RADIO_COURSE_ID, userId: user.id } }),
    prisma.wrongQuestion.count({ where: { courseId: RADIO_COURSE_ID, userId: user.id, mastered: false } }),
  ]);
  const mastered = total - pending;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <AppShell role="student" currentPath="/student/wrong"><div className="safe-bottom"><PageHeader title={text.title} description={text.description} action={<Link href="/student/practice/start?mode=wrong" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-white"><Target className="size-4" />{text.practice}</Link>} /><div className="mb-5 flex gap-2"><Badge tone="red">{text.pending} {pending}</Badge><Badge>{text.mastered} {mastered}</Badge></div><div className="grid gap-4">{wrongItems.length ? wrongItems.map((item) => <Card key={item.id} className={item.mastered ? "opacity-70" : ""}><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid size-11 place-items-center rounded-2xl bg-rose-50 text-rose-700"><BookX className="size-5" /></div><div className="flex-1"><div className="font-extrabold leading-6">{item.question.stem}</div><div className="mt-2 flex flex-wrap gap-2"><Badge>{item.question.knowledgePoint.code} {item.question.knowledgePoint.name}</Badge><Badge tone="green">{item.question.level.code}{text.level}</Badge><Badge tone={item.question.type === "SINGLE_CHOICE" ? "blue" : "amber"}>{item.question.type === "SINGLE_CHOICE" ? "单选题" : "多选题"}</Badge>{item.mastered ? <Badge tone="green">{text.mastered}</Badge> : <Badge tone="amber">{text.streak} {item.correctSessionCount}/3</Badge>}</div><div className="mt-2 text-xs text-[var(--muted-foreground)]">{text.lastReason}：{item.lastWrongReason === "UNANSWERED" ? text.unanswered : item.lastWrongReason === "ANSWERED_WRONG" ? text.answeredWrong : "—"}</div></div><div className="flex items-center gap-2 text-sm font-semibold text-rose-700"><AlertTriangle className="size-4" />{text.wrong} {item.wrongCount} {text.times}</div></CardContent></Card>) : <Card><CardContent className="p-12 text-center text-sm text-[var(--muted-foreground)]">{text.empty}</CardContent></Card>}</div><PaginationNav page={page} totalPages={totalPages} path="/student/wrong" /></div></AppShell>;
}
