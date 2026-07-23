import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RuleEditor } from "@/components/rule-editor";
import { prisma } from "@/lib/db";
import type { KnowledgePoint, Level, PracticeRule, QuestionOption } from "@/lib/domain/types";

export default async function RulesPage() {
  const [levels, points, questions, levelRuleRows, knowledgeRuleRows] = await Promise.all([
    prisma.level.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.knowledgePoint.findMany({ where: { enabled: true }, orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { code: "asc" }] }),
    prisma.question.findMany({ where: { status: "ACTIVE" } }),
    prisma.levelPracticeRule.findMany(),
    prisma.knowledgePracticeRule.findMany(),
  ]);
  const levelRules: Record<string, PracticeRule> = Object.fromEntries(levelRuleRows.map((rule) => [rule.levelId, { singleCount: rule.singleCount, multipleCount: rule.multipleCount }]));
  const knowledgeRules: Record<string, PracticeRule> = Object.fromEntries(knowledgeRuleRows.map((rule) => [`${rule.knowledgePointId}:${rule.levelId}`, { singleCount: rule.singleCount, multipleCount: rule.multipleCount }]));
  const domainQuestions = questions.map((question) => ({ ...question, sourceBankCode: question.sourceBankCode ?? undefined, externalQuestionCode: question.externalQuestionCode ?? undefined, options: question.options as QuestionOption[] }));
  return <AppShell role="teacher" currentPath="/teacher/rules"><div className="safe-bottom"><PageHeader title="抽题规则" description="等级综合与知识点专项使用独立规则；保存前会校验题库库存，新规则只影响新练习。" /><RuleEditor levels={levels as Level[]} points={points as KnowledgePoint[]} questions={domainQuestions} initialLevelRules={levelRules} initialKnowledgeRules={knowledgeRules} /></div></AppShell>;
}
