import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RuleEditor } from "@/components/rule-editor";
import { prisma } from "@/lib/db";
import type { KnowledgePoint, Level, PracticeRule, QuestionOption } from "@/lib/domain/types";
import { createActionToken, getCurrentUser } from "@/lib/server/session";

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);
  if (!user) redirect("/login?next=/teacher/rules");
  if (user.role !== "TEACHER") redirect("/student");

  const [levels, points, questions, levelRuleRows, knowledgeRuleRows, saveToken] = await Promise.all([
    prisma.level.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.knowledgePoint.findMany({ where: { enabled: true }, orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { code: "asc" }] }),
    prisma.question.findMany({ where: { status: "ACTIVE" } }),
    prisma.levelPracticeRule.findMany(),
    prisma.knowledgePracticeRule.findMany(),
    createActionToken(user.id, "SAVE_PRACTICE_RULES"),
  ]);
  const levelRules: Record<string, PracticeRule> = Object.fromEntries(levelRuleRows.map((rule) => [rule.levelId, { singleCount: rule.singleCount, multipleCount: rule.multipleCount }]));
  const knowledgeRules: Record<string, PracticeRule> = Object.fromEntries(knowledgeRuleRows.map((rule) => [`${rule.knowledgePointId}:${rule.levelId}`, { singleCount: rule.singleCount, multipleCount: rule.multipleCount }]));
  const domainQuestions = questions.map((question) => ({ ...question, sourceBankCode: question.sourceBankCode ?? undefined, externalQuestionCode: question.externalQuestionCode ?? undefined, options: question.options as QuestionOption[] }));
  const feedback = params.error ? { type: "error" as const, message: params.error } : params.saved === "1" ? { type: "success" as const, message: "规则已保存到数据库" } : undefined;

  return <AppShell role="teacher" currentPath="/teacher/rules"><div className="safe-bottom"><PageHeader title="抽题规则" description="等级综合与知识点专项使用独立规则；保存前会校验题库库存，新规则只影响新练习。" /><RuleEditor levels={levels as Level[]} points={points as KnowledgePoint[]} questions={domainQuestions} initialLevelRules={levelRules} initialKnowledgeRules={knowledgeRules} saveToken={saveToken} feedback={feedback} /></div></AppShell>;
}