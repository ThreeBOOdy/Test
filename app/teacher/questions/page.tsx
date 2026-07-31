import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PaginationNav } from "@/components/pagination-nav";
import { QuestionManager } from "@/components/question-manager";
import { parseJsonStringArray } from "@/lib/domain/json-string-array";
import type { QuestionOption } from "@/lib/domain/types";
import { prisma } from "@/lib/db";
import { RADIO_COURSE_ID } from "@/lib/domain/course";
import { normalizePagination } from "@/lib/server/pagination";

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; status?: string; level?: string }> }) {
  const params = await searchParams;
  const { page, pageSize, skip } = normalizePagination({ page: params.page });
  const where = {
    courseId: RADIO_COURSE_ID,
    ...(params.search ? { OR: [{ stem: { contains: params.search } }, { externalQuestionCode: { contains: params.search } }] } : {}),
    ...(params.status && ["ACTIVE", "DISABLED", "ARCHIVED"].includes(params.status) ? { status: params.status as "ACTIVE" | "DISABLED" | "ARCHIVED" } : {}),
    ...(params.level ? { levelId: params.level } : {}),
  };
  const [questions, total, levels, knowledgePoints] = await Promise.all([
    prisma.question.findMany({ where, include: { level: true, knowledgePoint: true }, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    prisma.question.count({ where }),
    prisma.level.findMany({ where: { courseId: RADIO_COURSE_ID }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.knowledgePoint.findMany({ where: { courseId: RADIO_COURSE_ID }, include: { _count: { select: { children: true } } }, orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { code: "asc" }] }),
  ]);
  const rows = questions.map((question) => ({ id: question.id, levelId: question.levelId, knowledgePointId: question.knowledgePointId, levelCode: question.level.code, knowledgeCode: question.knowledgePoint.code, knowledgeName: question.knowledgePoint.name, sourceBankCode: question.sourceBankCode ?? "", externalQuestionCode: question.externalQuestionCode ?? "", stem: question.stem, type: question.type, selectionSpec: question.selectionSpec, preserveOptionOrder: question.preserveOptionOrder, options: question.options as unknown as QuestionOption[], correctOptionIds: parseJsonStringArray(question.correctOptionIds, "correctOptionIds"), status: question.status, version: question.version }));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <AppShell role="teacher" currentPath="/teacher/questions"><div className="safe-bottom"><PageHeader title="题库管理" description={`共 ${total} 道题目，当前第 ${page} 页。`} /><QuestionManager rows={rows} levels={levels.map((level) => ({ id: level.id, code: level.code, name: level.name, enabled: level.enabled }))} knowledgePoints={knowledgePoints.filter((point) => point._count.children === 0).map((point) => ({ id: point.id, code: point.code, name: point.name, enabled: point.enabled }))} /><PaginationNav page={page} totalPages={totalPages} path="/teacher/questions" params={{ search: params.search, status: params.status, level: params.level }} /></div></AppShell>;
}
