import { Filter, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { knowledgePoints, levels, questions } from "@/lib/data/demo";

export default function QuestionsPage() {
  const rows = questions.slice(0, 12);
  return <AppShell role="teacher" currentPath="/teacher/questions"><div className="safe-bottom"><PageHeader title="题库管理" description="按等级、知识点、题型和选项规格筛选题目，停用题目不会影响历史练习。" action={<Button><Plus className="size-4" />新增题目</Button>} /><div className="mb-5 grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 md:grid-cols-[1fr_auto_auto]"><label className="flex h-11 items-center gap-3 rounded-xl bg-[var(--muted)] px-4"><Search className="size-4 text-[var(--muted-foreground)]" /><input className="w-full bg-transparent text-sm outline-none" placeholder="搜索题干、题库编号或题目编号" /></label><Button variant="outline"><Filter className="size-4" />筛选条件</Button><Button variant="secondary">导出当前结果</Button></div><Card className="overflow-hidden"><CardContent className="overflow-x-auto p-0"><table className="min-w-[980px] w-full border-collapse text-left"><thead><tr className="border-b border-[var(--border)] bg-[var(--muted)] text-xs text-[var(--muted-foreground)]"><Th>题目编号</Th><Th>题干</Th><Th>等级</Th><Th>知识点</Th><Th>题型</Th><Th>规格</Th><Th>状态</Th></tr></thead><tbody>{rows.map((question) => { const level = levels.find((item) => item.id === question.levelId); const point = knowledgePoints.find((item) => item.id === question.knowledgePointId); return <tr key={question.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/60"><Td><div className="font-semibold">{question.externalQuestionCode}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{question.sourceBankCode}</div></Td><Td><div className="max-w-md truncate font-semibold">{question.stem}</div></Td><Td><Badge tone="green">{level?.code}级</Badge></Td><Td><div className="text-sm font-semibold">{point?.code}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{point?.name}</div></Td><Td><Badge tone={question.type === "SINGLE_CHOICE" ? "blue" : "amber"}>{question.type === "SINGLE_CHOICE" ? "单选" : "多选"}</Badge></Td><Td>{question.selectionSpec}</Td><Td><Badge tone="green">启用</Badge></Td></tr>; })}</tbody></table></CardContent></Card></div></AppShell>;
}
function Th({ children }: { children: React.ReactNode }) { return <th className="px-5 py-4 font-semibold">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-5 py-4 text-sm">{children}</td>; }
