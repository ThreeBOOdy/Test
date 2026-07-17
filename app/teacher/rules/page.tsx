import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RuleEditor } from "@/components/rule-editor";
import { knowledgePoints, knowledgeRules, levelRules, levels, questions } from "@/lib/data/demo";

export default function RulesPage() { return <AppShell role="teacher" currentPath="/teacher/rules"><div className="safe-bottom"><PageHeader title="抽题规则" description="等级综合与知识点专项使用独立规则；保存前会校验题库库存，新规则只影响新练习。" /><RuleEditor levels={levels} points={knowledgePoints} questions={questions} initialLevelRules={levelRules} initialKnowledgeRules={knowledgeRules} /></div></AppShell>; }
