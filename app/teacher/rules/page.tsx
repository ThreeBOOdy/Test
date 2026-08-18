import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RuleEditor } from "@/components/rule-editor";
import { prisma } from "@/lib/db";
import { parseJsonStringArray } from "@/lib/domain/json-string-array";
import type { ExamRule, KnowledgePoint, Level, PracticeRule, QuestionOption } from "@/lib/domain/types";

export default async function RulesPage() {
  const [levels, points, questions, levelRuleRows, knowledgeRuleRows, examRuleRows] = await Promise.all([
    prisma.level.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.knowledgePoint.findMany({ where: { enabled: true }, orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { code: "asc" }] }),
    prisma.question.findMany({ where: { status: "ACTIVE" }, include: { levels: { select: { levelId: true } } } }),
    prisma.levelPracticeRule.findMany(),
    prisma.knowledgePracticeRule.findMany(),
    prisma.examRule.findMany(),
  ]);
  const levelRules: Record<string, PracticeRule> = Object.fromEntries(levelRuleRows.map((rule) => [rule.levelId, { singleCount: rule.singleCount, multipleCount: rule.multipleCount, version: rule.version }]));
  const knowledgeRules: Record<string, PracticeRule> = Object.fromEntries(knowledgeRuleRows.map((rule) => [`${rule.knowledgePointId}:${rule.levelId}`, { singleCount: rule.singleCount, multipleCount: rule.multipleCount, version: rule.version }]));
  const examRules: Record<string, ExamRule> = Object.fromEntries(examRuleRows.map((rule) => [rule.levelId, { singleCount: rule.singleCount, multipleCount: rule.multipleCount, durationMinutes: rule.durationMinutes, passingCount: rule.passingCount, version: rule.version }]));
  const domainQuestions = questions.map((question) => ({ ...question, levelIds: question.levels.map((item) => item.levelId), sourceBankCode: question.sourceBankCode ?? undefined, externalQuestionCode: question.externalQuestionCode ?? undefined, options: question.options as QuestionOption[], correctOptionIds: parseJsonStringArray(question.correctOptionIds, "correctOptionIds") }));
  return <AppShell role="teacher" currentPath="/teacher/rules"><div className="safe-bottom"><PageHeader title="练习与考试规则" description="统一配置综合练习、知识点专项和模拟考试；保存前会校验题库库存，新规则只影响新会话。" /><RuleEditor levels={levels as Level[]} points={points as KnowledgePoint[]} questions={domainQuestions} initialLevelRules={levelRules} initialKnowledgeRules={knowledgeRules} initialExamRules={examRules} /></div></AppShell>;
}
