import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PaginationNav } from "@/components/pagination-nav";
import { QuestionManager } from "@/components/question-manager";
import { parseJsonStringArray } from "@/lib/domain/json-string-array";
import { buildKnowledgeTree } from "@/lib/domain/knowledge-tree";
import type { QuestionOption } from "@/lib/domain/types";
import { prisma } from "@/lib/db";
import { normalizePagination } from "@/lib/server/pagination";

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; status?: string; level?: string }> }) {
  const params = await searchParams;
  const { page, pageSize, skip } = normalizePagination({ page: params.page });
  const where = {
    ...(params.search ? { OR: [{ stem: { contains: params.search } }, { externalQuestionCode: { contains: params.search } }] } : {}),
    ...(params.status && ["ACTIVE", "DISABLED", "ARCHIVED"].includes(params.status) ? { status: params.status as "ACTIVE" | "DISABLED" | "ARCHIVED" } : {}),
    ...(params.level ? { levels: { some: { levelId: params.level } } } : {}),
  };
  const [questions, total, levels, knowledgePointTypes, knowledgePoints] = await Promise.all([
    prisma.question.findMany({ where, include: { levels: { include: { level: true } }, knowledgePoint: true }, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    prisma.question.count({ where }),
    prisma.level.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.knowledgePointType.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.knowledgePoint.findMany({ orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { code: "asc" }] }),
  ]);
  const rows = questions.map((question) => ({ id: question.id, levelIds: question.levels.map((item) => item.levelId), knowledgePointId: question.knowledgePointId, knowledgePointTypeId: question.knowledgePoint.typeId, levelCode: question.levels.map((item) => item.level.code).join("、") || "未归类", knowledgeCode: question.knowledgePoint.code, knowledgeName: question.knowledgePoint.name, sourceBankCode: question.sourceBankCode ?? "", externalQuestionCode: question.externalQuestionCode ?? "", stem: question.stem, type: question.type, selectionSpec: question.selectionSpec, preserveOptionOrder: question.preserveOptionOrder, options: question.options as unknown as QuestionOption[], correctOptionIds: parseJsonStringArray(question.correctOptionIds, "correctOptionIds"), status: question.status, version: question.version }));
  const knowledgePointTrees = Object.fromEntries(knowledgePointTypes.map((type) => [type.id, buildKnowledgeTree(knowledgePoints.filter((point) => point.typeId === type.id).map((point) => ({ id: point.id, code: point.code, name: point.name, parentId: point.parentId, path: point.path, depth: point.depth, sortOrder: point.sortOrder, enabled: point.enabled })))]));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <AppShell role="teacher" currentPath="/teacher/questions"><div className="safe-bottom"><PageHeader title="题库管理" description={`共 ${total} 道题目，当前第 ${page} 页。`} /><QuestionManager rows={rows} levels={levels.map((level) => ({ id: level.id, code: level.code, name: level.name, enabled: level.enabled }))} knowledgePointTypes={knowledgePointTypes.map((type) => ({ id: type.id, code: type.code, name: type.name, enabled: type.enabled }))} knowledgePointTrees={knowledgePointTrees} /><PaginationNav page={page} totalPages={totalPages} path="/teacher/questions" params={{ search: params.search, status: params.status, level: params.level }} /></div></AppShell>;
}
