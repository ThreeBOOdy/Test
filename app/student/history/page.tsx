import { BarChart3, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PaginationNav } from "@/components/pagination-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { RADIO_COURSE_ID } from "@/lib/domain/course";
import { formatPercent } from "@/lib/utils";
import type { ExamSettlementSource, PracticeMode, PracticeStatus } from "@/lib/domain/types";
import { normalizePagination } from "@/lib/server/pagination";
import { getStudentLearningSummary } from "@/lib/server/learning-statistics-service";
import { getCurrentUser } from "@/lib/server/session";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.capability !== "FULL_STUDENT") return null;
  const params = await searchParams;
  const { page, pageSize, skip } = normalizePagination({ page: params.page });
  const [sessions, total, summary] = await Promise.all([
    prisma.practiceSession.findMany({ where: { courseId: RADIO_COURSE_ID, userId: user.id }, include: { level: true, knowledgePoint: true, _count: { select: { questions: true } } }, orderBy: { startedAt: "desc" }, skip, take: pageSize }),
    prisma.practiceSession.count({ where: { courseId: RADIO_COURSE_ID, userId: user.id } }),
    getStudentLearningSummary(user.id),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <AppShell role="student" currentPath="/student/history"><div className="safe-bottom"><PageHeader title="练习记录" description="顺序练习、智能随机、模拟考试、知识点专项和错题巩固均会留档。放弃记录不计入完成统计。" /><div className="grid gap-4 lg:grid-cols-3"><Summary icon={BarChart3} label="累计完成" value={`${summary.completedSessions} 次`} /><Summary icon={CheckCircle2} label="累计正确率" value={`${summary.accuracy}%`} /><Summary icon={Clock3} label="累计学习" value={`${summary.totalMinutes} 分钟`} /></div><Card className="mt-6"><CardContent className="p-0">{sessions.length ? <div className="divide-y divide-[var(--border)]">{sessions.map((session) => { const questionTotal=session._count.questions; const score=questionTotal ? session.correctCount/questionTotal : 0; const title=sessionTitle(session.mode, session.level?.code, session.knowledgePoint?.name); const examPassed=session.mode === "MOCK_EXAM" && session.passingCountSnapshot !== null ? session.correctCount >= session.passingCountSnapshot : null; return <div key={session.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="grid size-12 place-items-center rounded-2xl bg-[var(--secondary)] text-[var(--primary)]"><CalendarDays className="size-5" /></div><div className="flex-1"><div className="font-extrabold">{title}</div><div className="mt-1 text-sm text-[var(--muted-foreground)]">{questionTotal} 题 · {session.startedAt.toLocaleString("zh-CN")}</div></div><Badge tone={historyTone(session.status, examPassed, score)}>{historyStatus(session.status, session.mode, session.examSettlementSource, examPassed, session.correctCount, questionTotal, score)}</Badge></div>; })}</div> : <div className="p-12 text-center text-sm text-[var(--muted-foreground)]">还没有练习记录。</div>}</CardContent></Card><PaginationNav page={page} totalPages={totalPages} path="/student/history" /></div></AppShell>;
}

function historyTone(status: PracticeStatus, examPassed: boolean | null, score: number) {
  if (status === "ABANDONED") return "red" as const;
  if (status === "IN_PROGRESS") return "blue" as const;
  return examPassed === false ? "red" : score >= .8 || examPassed ? "green" : "amber" as const;
}

function historyStatus(status: PracticeStatus, mode: PracticeMode, settlementSource: ExamSettlementSource | null, examPassed: boolean | null, correctCount: number, questionTotal: number, score: number) {
  if (status === "ABANDONED") return "已放弃";
  if (status === "IN_PROGRESS") return "进行中";
  if (mode !== "MOCK_EXAM") return `已完成 · ${formatPercent(score)} 正确率`;
  const source = settlementSource === "AUTO_SETTLEMENT" ? "自动结算" : "主动交卷";
  return `${source} · ${examPassed ? "合格" : "未合格"} · ${correctCount}/${questionTotal}`;
}

function sessionTitle(mode: string, levelCode?: string, knowledgeName?: string) {
  if (mode === "WRONG_QUESTION") return "错题巩固练习";
  if (mode === "KNOWLEDGE_POINT") return `${knowledgeName ?? "知识点专项"} · ${levelCode ?? "-"}级`;
  if (mode === "QUESTION_ORDER") return `${levelCode ?? "-"}级顺序练习`;
  if (mode === "RANDOM_ALL") return `${levelCode ?? "-"}级智能随机练习`;
  if (mode === "MOCK_EXAM") return `${levelCode ?? "-"}级模拟考试`;
  return `${levelCode ?? "-"}级综合练习`;
}

function Summary({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) { return <Card><CardContent className="flex items-center gap-4"><div className="grid size-11 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--primary)]"><Icon className="size-5" /></div><div><div className="text-sm text-[var(--muted-foreground)]">{label}</div><div className="mt-1 text-xl font-extrabold">{value}</div></div></CardContent></Card>; }
