import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ExamBlueprintManager, type BlueprintManagerRow } from "@/components/exam-blueprint-manager";
import { prisma } from "@/lib/db";
import { parseJsonStringArray } from "@/lib/domain/json-string-array";
import type { KnowledgePoint, Level, QuestionOption } from "@/lib/domain/types";

export default async function RulesPage() {
  const [levels, points, questions, blueprintRecords] = await Promise.all([
    prisma.level.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.knowledgePoint.findMany({ orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { code: "asc" }] }),
    prisma.question.findMany({ where: { status: "ACTIVE" }, include: { levels: { select: { levelId: true } } } }),
    prisma.examBlueprint.findMany({
      include: {
        items: {
          orderBy: { knowledgePointId: "asc" },
          include: {
            knowledgePoint: { select: { id: true, code: true, name: true, path: true } },
          },
        },
      },
      orderBy: [{ levelId: "asc" }, { isDefault: "desc" }, { name: "asc" }],
    }),
  ]);
  const domainQuestions = questions.map((question) => ({
    ...question,
    levelIds: question.levels.map((item) => item.levelId),
    sourceBankCode: question.sourceBankCode ?? undefined,
    externalQuestionCode: question.externalQuestionCode ?? undefined,
    options: question.options as QuestionOption[],
    correctOptionIds: parseJsonStringArray(question.correctOptionIds, "correctOptionIds"),
  }));
  const blueprintRows: BlueprintManagerRow[] = blueprintRecords.map((blueprint) => ({
    id: blueprint.id,
    levelId: blueprint.levelId,
    name: blueprint.name,
    durationMinutes: blueprint.durationMinutes,
    passingCount: blueprint.passingCount,
    enabled: blueprint.enabled,
    isDefault: blueprint.isDefault,
    totalCount: blueprint.items.reduce((sum, item) => sum + item.singleCount + item.multipleCount, 0),
    items: blueprint.items.map((item) => ({
      id: item.id,
      knowledgePointId: item.knowledgePointId,
      knowledgePoint: item.knowledgePoint
        ? {
            id: item.knowledgePoint.id,
            code: item.knowledgePoint.code,
            name: item.knowledgePoint.name,
            path: item.knowledgePoint.path,
          }
        : null,
      singleCount: item.singleCount,
      multipleCount: item.multipleCount,
    })),
  }));
  return (
    <AppShell role="teacher" currentPath="/teacher/rules">
      <div className="safe-bottom">
        <PageHeader title="模拟测试蓝图管理" description="维护多套命名蓝图，按任意层级知识点配置模拟试卷；保存时校验条目重叠与实时题库库存。" />
        <ExamBlueprintManager levels={levels as Level[]} points={points as KnowledgePoint[]} questions={domainQuestions} blueprints={blueprintRows} />
      </div>
    </AppShell>
  );
}
