import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { QuestionManager } from "@/components/question-manager";
import type { QuestionOption } from "@/lib/domain/types";
import { prisma } from "@/lib/db";

export default async function QuestionsPage() {
  const [questions, levels, knowledgePoints] = await Promise.all([
    prisma.question.findMany({ include: { level: true, knowledgePoint: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.level.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.knowledgePoint.findMany({ include: { _count: { select: { children: true } } }, orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { code: "asc" }] }),
  ]);
  const rows = questions.map((question) => ({
    id: question.id,
    levelId: question.levelId,
    knowledgePointId: question.knowledgePointId,
    levelCode: question.level.code,
    knowledgeCode: question.knowledgePoint.code,
    knowledgeName: question.knowledgePoint.name,
    sourceBankCode: question.sourceBankCode ?? "",
    externalQuestionCode: question.externalQuestionCode ?? "",
    stem: question.stem,
    type: question.type,
    selectionSpec: question.selectionSpec,
    options: question.options as unknown as QuestionOption[],
    correctOptionIds: question.correctOptionIds,
    status: question.status,
  }));
  return <AppShell role="teacher" currentPath="/teacher/questions"><div className="safe-bottom"><PageHeader title="题库管理" description={`当前加载最近 ${rows.length} 道题目。支持新增、编辑、筛选以及启用、停用和归档。`} /><QuestionManager rows={rows} levels={levels.map((level) => ({ id: level.id, code: level.code, name: level.name, enabled: level.enabled }))} knowledgePoints={knowledgePoints.filter((point) => point._count.children === 0).map((point) => ({ id: point.id, code: point.code, name: point.name, enabled: point.enabled }))} /></div></AppShell>;
}