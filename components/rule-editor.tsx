"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Save, Settings2, TimerReset } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExamRule, KnowledgePoint, Level, PracticeRule, Question } from "@/lib/domain/types";

type Mode = "level" | "knowledge" | "exam";

export function RuleEditor({ levels, points, questions, initialLevelRules, initialKnowledgeRules, initialExamRules }: { levels: Level[]; points: KnowledgePoint[]; questions: Question[]; initialLevelRules: Record<string, PracticeRule>; initialKnowledgeRules: Record<string, PracticeRule>; initialExamRules: Record<string, ExamRule> }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("level");
  const [levelRules, setLevelRules] = useState(initialLevelRules);
  const [knowledgeRules, setKnowledgeRules] = useState(initialKnowledgeRules);
  const [examRules, setExamRules] = useState(initialExamRules);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const leaves = points.filter((point) => point.depth === 2);

  async function save() {
    setPending(true); setError("");
    try {
      const response = await fetch("/api/v1/teacher/practice-rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        levelRules: Object.entries(levelRules).map(([levelId, rule]) => ({ levelId, ...rule })),
        knowledgeRules: Object.entries(knowledgeRules).map(([key, rule]) => { const [knowledgePointId, levelId] = key.split(":"); return { knowledgePointId, levelId, ...rule }; }),
        examRules: Object.entries(examRules).map(([levelId, rule]) => ({ levelId, ...rule })),
      }) });
      const data = await response.json();
      if (!response.ok) { setError(data.message ?? "保存失败"); return; }
      setSaved(true); router.refresh(); window.setTimeout(() => setSaved(false), 1800);
    } catch { setError("保存失败，请检查服务连接"); }
    finally { setPending(false); }
  }

  return <>
    <div className="mb-5 inline-flex flex-wrap rounded-xl bg-[var(--muted)] p-1">
      <ModeButton active={mode === "level"} onClick={() => setMode("level")}>等级综合规则</ModeButton>
      <ModeButton active={mode === "knowledge"} onClick={() => setMode("knowledge")}>知识点专项规则</ModeButton>
      <ModeButton active={mode === "exam"} onClick={() => setMode("exam")}>模拟考试规则</ModeButton>
    </div>
    {mode === "level" ? <div className="grid gap-4 lg:grid-cols-3">{levels.map((level) => { const rule = levelRules[level.id] ?? { singleCount: 0, multipleCount: 0 }; const inventory = getInventory(questions, level.id); return <RuleCard key={level.id} title={level.name} subtitle="顺序练习与智能随机共用此题量" rule={rule} inventory={inventory} onChange={(next) => setLevelRules((current) => ({ ...current, [level.id]: next }))} />; })}</div> : null}
    {mode === "knowledge" ? <Card><CardHeader><CardTitle>知识点 + 等级专项配置</CardTitle><CardDescription>未配置的组合不会在学生端展示。单选和多选不能同时为 0。</CardDescription></CardHeader><CardContent className="overflow-x-auto p-0"><table className="min-w-[900px] w-full"><thead><tr className="border-y border-[var(--border)] bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]"><Th>知识点</Th>{levels.map((level) => <Th key={level.id}>{level.code}级题量</Th>)}<Th>状态</Th></tr></thead><tbody>{leaves.map((point) => <tr key={point.id} className="border-b border-[var(--border)]"><Td><div className="font-extrabold">{point.code}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{point.name}</div></Td>{levels.map((level) => { const key = `${point.id}:${level.id}`; const rule = knowledgeRules[key] ?? { singleCount: 0, multipleCount: 0 }; return <Td key={level.id}><div className="flex items-center gap-2"><MiniInput label="单" value={rule.singleCount} onChange={(value) => setKnowledgeRules((current) => ({ ...current, [key]: { ...rule, singleCount: value } }))} /><MiniInput label="多" value={rule.multipleCount} onChange={(value) => setKnowledgeRules((current) => ({ ...current, [key]: { ...rule, multipleCount: value } }))} /></div></Td>; })}<Td><Badge tone="green">可配置</Badge></Td></tr>)}</tbody></table></CardContent></Card> : null}
    {mode === "exam" ? <div className="grid gap-4 lg:grid-cols-3">{levels.map((level) => { const rule = examRules[level.id] ?? { singleCount: 0, multipleCount: 0, durationMinutes: 40, passingCount: 1 }; const inventory = getInventory(questions, level.id); const total = rule.singleCount + rule.multipleCount; const valid = rule.singleCount <= inventory.singleCount && rule.multipleCount <= inventory.multipleCount && total > 0 && rule.passingCount > 0 && rule.passingCount <= total && rule.durationMinutes > 0; return <Card key={level.id}><CardHeader><div className="flex items-start justify-between"><div><CardTitle>{level.name}</CardTitle><CardDescription>默认来源于资格考试标准，可按教学需要调整。</CardDescription></div><TimerReset className="size-5 text-[var(--primary)]" /></div></CardHeader><CardContent><div className="grid grid-cols-2 gap-3"><NumberField label="单选题数量" value={rule.singleCount} max={inventory.singleCount} onChange={(value) => setExamRules((current) => ({ ...current, [level.id]: { ...rule, singleCount: value } }))} /><NumberField label="多选题数量" value={rule.multipleCount} max={inventory.multipleCount} onChange={(value) => setExamRules((current) => ({ ...current, [level.id]: { ...rule, multipleCount: value } }))} /><NumberField label="考试时间（分钟）" value={rule.durationMinutes} max={1440} onChange={(value) => setExamRules((current) => ({ ...current, [level.id]: { ...rule, durationMinutes: value } }))} /><NumberField label="合格题数" value={rule.passingCount} max={Math.max(1, total)} onChange={(value) => setExamRules((current) => ({ ...current, [level.id]: { ...rule, passingCount: value } }))} /></div><div className={`mt-4 rounded-xl px-3 py-3 text-xs font-semibold ${valid ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}>{valid ? `共 ${total} 题 · ${rule.durationMinutes} 分钟 · 答对 ${rule.passingCount} 题合格` : "题量、时间或合格线无效，或超过当前库存"}</div></CardContent></Card>; })}</div> : null}
    {error ? <div className="mt-5 rounded-xl bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">{error}</div> : null}
    <div className="mt-6 flex justify-end"><Button onClick={save} disabled={pending}>{saved ? <Check className="size-4" /> : <Save className="size-4" />}{pending ? "保存中…" : saved ? "已保存到数据库" : "保存规则"}</Button></div>
  </>;
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" className={`rounded-lg px-4 py-2 text-sm font-bold ${active ? "bg-[var(--surface-soft)] text-[var(--primary)] shadow-sm" : "text-[var(--muted-foreground)]"}`} onClick={onClick}>{children}</button>; }
function RuleCard({ title, subtitle, rule, inventory, onChange }: { title: string; subtitle: string; rule: PracticeRule; inventory: PracticeRule; onChange: (rule: PracticeRule) => void }) { const valid = rule.singleCount <= inventory.singleCount && rule.multipleCount <= inventory.multipleCount && (rule.singleCount > 0 || rule.multipleCount > 0); return <Card><CardHeader><div className="flex items-start justify-between"><div><CardTitle>{title}</CardTitle><CardDescription>{subtitle}</CardDescription></div><Settings2 className="size-5 text-[var(--primary)]" /></div></CardHeader><CardContent><div className="grid grid-cols-2 gap-3"><NumberField label="单选题数量" value={rule.singleCount} max={inventory.singleCount} onChange={(value) => onChange({ ...rule, singleCount: value })} /><NumberField label="多选题数量" value={rule.multipleCount} max={inventory.multipleCount} onChange={(value) => onChange({ ...rule, multipleCount: value })} /></div><div className={`mt-4 rounded-xl px-3 py-3 text-xs font-semibold ${valid ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}>{valid ? `库存充足：单选 ${inventory.singleCount} / 多选 ${inventory.multipleCount}` : "配置超过库存或题量全部为 0"}</div></CardContent></Card>; }
function NumberField({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) { return <label className="rounded-xl bg-[var(--muted)] p-3"><span className="text-xs font-semibold text-[var(--muted-foreground)]">{label}</span><input type="number" min={0} max={max} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} className="mt-2 w-full bg-transparent text-2xl font-extrabold outline-none" /><span className="text-[11px] text-[var(--muted-foreground)]">上限 {max}</span></label>; }
function MiniInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="flex h-9 items-center gap-1 rounded-lg bg-[var(--muted)] px-2 text-xs"><span>{label}</span><input type="number" min={0} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} className="w-9 bg-transparent font-bold outline-none" /></label>; }
function getInventory(questions: Question[], levelId: string): PracticeRule { const eligible = questions.filter((question) => question.levelId === levelId && question.status === "ACTIVE"); return { singleCount: eligible.filter((question) => question.type === "SINGLE_CHOICE").length, multipleCount: eligible.filter((question) => question.type === "MULTIPLE_CHOICE").length }; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-5 py-4 font-semibold">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-5 py-4 text-sm">{children}</td>; }
