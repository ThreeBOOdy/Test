"use client";

import { authenticatedFetch } from "@/lib/client/authenticated-fetch";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, History, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QuestionRichText } from "@/components/question-rich-text";
import { extractImageMarkers } from "@/lib/domain/question-image-marker";
import type { KnowledgeTreeNode } from "@/lib/domain/knowledge-tree";
import type { QuestionOption, QuestionStatus, QuestionType } from "@/lib/domain/types";

type LevelChoice = { id: string; code: string; name: string; enabled: boolean };
type KnowledgePointTypeChoice = { id: string; code: string; name: string; enabled: boolean };
type QuestionRow = {
  id: string;
  levelIds: string[];
  knowledgePointId: string;
  knowledgePointTypeId: string;
  levelCode: string;
  knowledgeCode: string;
  knowledgeName: string;
  sourceBankCode: string;
  externalQuestionCode: string;
  stem: string;
  type: QuestionType;
  selectionSpec: string;
  preserveOptionOrder: boolean;
  options: QuestionOption[];
  correctOptionIds: string[];
  status: QuestionStatus;
  version: number;
};

type Revision = { revision: number; snapshot: { stem: string }; changeSource: string; createdAt: string; actorName: string };

type QuestionForm = {
  id?: string;
  levelIds: string[];
  knowledgePointTypeId: string;
  knowledgePointId: string;
  sourceBankCode: string;
  externalQuestionCode: string;
  stem: string;
  preserveOptionOrder: boolean;
  options: QuestionOption[];
  correctOptionIds: string[];
  status: QuestionStatus;
  version?: number;
};

const optionIds = ["A", "B", "C", "D", "E", "F", "G", "H"];

function findFirstLeaf(nodes: readonly KnowledgeTreeNode[]): string | undefined {
  for (const node of nodes) {
    if (node.children.length === 0) {
      if (node.enabled) return node.id;
      continue;
    }
    const child = findFirstLeaf(node.children);
    if (child) return child;
  }
  return undefined;
}

function KnowledgeTreePicker({ nodes, selectedId, onSelect }: { nodes: readonly KnowledgeTreeNode[]; selectedId: string; onSelect: (id: string) => void }) {
  if (nodes.length === 0) {
    return <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)] px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">该类型下暂无知识点，请先在“知识点类型维护”中创建。</div>;
  }
  return <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--muted)] p-2">{nodes.map((node) => <TreePickerRow key={node.id} node={node} selectedId={selectedId} onSelect={onSelect} depth={0} />)}</div>;
}

function TreePickerRow({ node, selectedId, onSelect, depth }: { node: KnowledgeTreeNode; selectedId: string; onSelect: (id: string) => void; depth: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const isLeaf = !hasChildren;
  const selected = selectedId === node.id;
  return <div>
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-soft)]" style={{ marginLeft: depth * 16 }}>
      <button type="button" onClick={() => setOpen(!open)} disabled={!hasChildren} aria-label={hasChildren ? (open ? "收起下级" : "展开下级") : undefined} className="grid size-6 shrink-0 place-items-center rounded-md text-[var(--muted-foreground)] disabled:opacity-40">
        {hasChildren ? open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" /> : <span className="size-4" />}
      </button>
      {isLeaf ? (
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1">
          <input type="radio" name="knowledgePoint" value={node.id} checked={selected} disabled={!node.enabled && !selected} onChange={() => onSelect(node.id)} className="size-4 shrink-0 accent-[var(--primary)]" />
          <span className={`truncate text-sm font-semibold ${node.enabled ? "" : "text-[var(--muted-foreground)]"}`}>{node.code} · {node.name}{node.enabled ? "" : "（已停用）"}</span>
        </label>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2 py-1">
          <span className="shrink-0 text-xs font-bold text-[var(--muted-foreground)]">{node.code}</span>
          <span className="truncate text-sm font-semibold">{node.name}</span>
          {node.children.length > 0 ? <span className="ml-auto shrink-0 text-xs text-[var(--muted-foreground)]">{node.children.length} 个下级</span> : null}
        </div>
      )}
    </div>
    {open && hasChildren ? <div>{node.children.map((child) => <TreePickerRow key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />)}</div> : null}
  </div>;
}

export function QuestionManager({ rows, levels, knowledgePointTypes, knowledgePointTrees }: { rows: QuestionRow[]; levels: LevelChoice[]; knowledgePointTypes: KnowledgePointTypeChoice[]; knowledgePointTrees: Record<string, KnowledgeTreeNode[]> }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [form, setForm] = useState<QuestionForm | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [revisions, setRevisions] = useState<{ question: QuestionRow; items: Revision[] } | null>(null);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !keyword || [row.stem, row.externalQuestionCode, row.sourceBankCode, row.knowledgeCode, row.knowledgeName].some((value) => value.toLowerCase().includes(keyword));
      return matchesSearch && (levelFilter === "ALL" || row.levelIds.includes(levelFilter)) && (typeFilter === "ALL" || row.type === typeFilter) && (statusFilter === "ALL" || row.status === statusFilter);
    });
  }, [levelFilter, rows, search, statusFilter, typeFilter]);

  function openCreate() {
    setMessage("");
    const initialType = knowledgePointTypes.find((type) => type.enabled) ?? knowledgePointTypes[0] ?? null;
    setForm({
      levelIds: [],
      knowledgePointTypeId: initialType?.id ?? "",
      knowledgePointId: initialType ? findFirstLeaf(knowledgePointTrees[initialType.id] ?? []) ?? "" : "",
      sourceBankCode: "",
      externalQuestionCode: "",
      stem: "",
      preserveOptionOrder: false,
      options: optionIds.slice(0, 4).map((id) => ({ id, text: "" })),
      correctOptionIds: ["A"],
      status: "ACTIVE",
    });
  }

  function openEdit(row: QuestionRow) {
    setMessage("");
    setForm({
      id: row.id,
      levelIds: [...row.levelIds],
      knowledgePointTypeId: row.knowledgePointTypeId,
      knowledgePointId: row.knowledgePointId,
      sourceBankCode: row.sourceBankCode,
      externalQuestionCode: row.externalQuestionCode,
      stem: row.stem,
      preserveOptionOrder: row.preserveOptionOrder,
      options: row.options.map((option) => ({ ...option })),
      correctOptionIds: [...row.correctOptionIds],
      status: row.status,
      version: row.version,
    });
  }

  async function openRevisions(question: QuestionRow) {
    setMessage("");
    const response = await authenticatedFetch(`/api/v1/teacher/questions/${question.id}/revisions`);
    const result = await response.json();
    if (!response.ok) { setMessage(result.message ?? "读取题目修订失败"); return; }
    setRevisions({ question, items: result.revisions });
  }

  async function restoreRevision(revision: number) {
    if (!revisions) return;
    setPending(true);
    const response = await authenticatedFetch(`/api/v1/teacher/questions/${revisions.question.id}/revisions/${revision}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: revisions.question.version }) });
    const result = await response.json();
    setPending(false);
    if (!response.ok) { setMessage(result.message ?? "恢复题目修订失败"); return; }
    setRevisions(null);
    router.refresh();
  }

  async function saveQuestion(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setPending(true);
    setMessage("");
    const payload = {
      levelIds: form.levelIds,
      knowledgePointId: form.knowledgePointId,
      sourceBankCode: form.sourceBankCode,
      externalQuestionCode: form.externalQuestionCode,
      stem: form.stem,
      preserveOptionOrder: form.preserveOptionOrder,
      options: form.options,
      correctOptionIds: form.correctOptionIds,
      status: form.status,
      ...(form.id ? { version: form.version } : {}),
    };
    const response = await authenticatedFetch(form.id ? `/api/v1/teacher/questions/${form.id}` : "/api/v1/teacher/questions", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(result.message ?? "保存题目失败");
      return;
    }
    setForm(null);
    router.refresh();
  }

  return <>
    <div className="mb-5 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 lg:grid-cols-[1fr_150px_150px_150px_auto]">
      <label className="flex h-11 items-center gap-3 rounded-xl bg-[var(--muted)] px-4"><Search className="size-4 text-[var(--muted-foreground)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="搜索题干、编号或知识点" /></label>
      <Select value={levelFilter} onChange={setLevelFilter}><option value="ALL">全部字母类</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.code}级</option>)}</Select>
      <Select value={typeFilter} onChange={setTypeFilter}><option value="ALL">全部题型</option><option value="SINGLE_CHOICE">单选题</option><option value="MULTIPLE_CHOICE">多选题</option></Select>
      <Select value={statusFilter} onChange={setStatusFilter}><option value="ALL">全部状态</option><option value="ACTIVE">启用</option><option value="DISABLED">停用</option><option value="ARCHIVED">归档</option></Select>
      <Button onClick={openCreate} disabled={!knowledgePointTypes.some((type) => type.enabled) || !Object.values(knowledgePointTrees).some((nodes) => findFirstLeaf(nodes))}><Plus className="size-4" />新增题目</Button>
    </div>
    <Card className="overflow-hidden"><CardContent className="overflow-x-auto p-0"><table className="responsive-data-table min-w-[1080px] w-full border-collapse text-left"><thead><tr className="border-b border-[var(--border)] bg-[var(--muted)] text-xs text-[var(--muted-foreground)]"><Th>题目编号</Th><Th>题干</Th><Th>字母类</Th><Th>知识点</Th><Th>题型</Th><Th>规格</Th><Th>状态</Th><Th>操作</Th></tr></thead><tbody>{filteredRows.map((question) => <tr key={question.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/60"><Td label="题目编号"><div className="font-semibold">{question.externalQuestionCode || "-"}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{question.sourceBankCode || "-"}</div></Td><Td label="题干">{extractImageMarkers(question.stem).length ? <div className="max-w-md font-semibold"><QuestionRichText text={question.stem} /></div> : <div className="max-w-md font-semibold md:truncate" title={question.stem}>{question.stem}</div>}</Td><Td label="字母类">{question.levelCode === "未归类" ? <Badge tone="neutral">未归类</Badge> : <div className="flex flex-wrap gap-1">{question.levelIds.map((levelId) => <Badge key={levelId} tone="green">{levels.find((level) => level.id === levelId)?.code ?? levelId}级</Badge>)}</div>}</Td><Td label="知识点"><div className="text-sm font-semibold">{question.knowledgeCode}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{question.knowledgeName}</div></Td><Td label="题型"><Badge tone={question.type === "SINGLE_CHOICE" ? "blue" : "amber"}>{question.type === "SINGLE_CHOICE" ? "单选" : "多选"}</Badge></Td><Td label="规格">{question.selectionSpec}</Td><Td label="状态"><StatusBadge status={question.status} /></Td><Td label="操作" actions><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(question)}><Pencil className="size-4" />编辑</Button><Button variant="ghost" size="sm" onClick={() => openRevisions(question)}><History className="size-4" />历史</Button></div></Td></tr>)}</tbody></table>{filteredRows.length === 0 ? <Empty text="没有符合当前条件的题目" /> : null}</CardContent></Card>
    {revisions ? <Modal title="题目修订历史" onClose={() => setRevisions(null)}><div className="flex flex-col gap-3">{revisions.items.map((revision) => <div key={revision.revision} className="rounded-xl border border-[var(--border)] p-4"><div className="flex items-start justify-between gap-4"><div><div className="font-bold">版本 {revision.revision} · {revision.changeSource}</div><div className="mt-1 text-sm text-[var(--muted-foreground)]"><QuestionRichText text={revision.snapshot.stem} /></div><div className="mt-2 text-xs text-[var(--muted-foreground)]">{revision.actorName} · {new Date(revision.createdAt).toLocaleString()}</div></div><Button type="button" variant="outline" size="sm" disabled={pending || revision.revision === revisions.question.version} onClick={() => restoreRevision(revision.revision)}><RotateCcw className="size-4" />恢复</Button></div></div>)}</div></Modal> : null}
    {form ? <Modal title={form.id ? "编辑题目" : "新增题目"} onClose={() => setForm(null)}><form onSubmit={saveQuestion} className="flex flex-col gap-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="字母类（可多选，可留空）"><div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--muted)] p-2">{levels.map((level) => { const selected = form.levelIds.includes(level.id); const keepDisabled = !level.enabled && !selected; return <label key={level.id} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm ${keepDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-[var(--surface-soft)]"}`}><input type="checkbox" aria-label={`字母类 ${level.code}`} checked={selected} disabled={keepDisabled} onChange={(event) => setForm({ ...form, levelIds: event.target.checked ? [...form.levelIds, level.id] : form.levelIds.filter((item) => item !== level.id) })} className="size-4 accent-[var(--primary)]" /><span><span className="font-bold">{level.code}级</span><span className="ml-2 text-[var(--muted-foreground)]">{level.name}{level.enabled ? "" : "（已停用）"}</span></span></label>; })}</div></Field><Field label="知识点类型"><select aria-label="知识点类型" value={form.knowledgePointTypeId} onChange={(event) => { const typeId = event.target.value; setForm({ ...form, knowledgePointTypeId: typeId, knowledgePointId: findFirstLeaf(knowledgePointTrees[typeId] ?? []) ?? "" }); }} className={inputClass}>{knowledgePointTypes.map((type) => <option key={type.id} value={type.id} disabled={!type.enabled && type.id !== form.knowledgePointTypeId}>{type.name}{type.enabled ? "" : "（已停用）"}</option>)}</select></Field><Field label="题库编号（可选）"><input aria-label="题库编号" value={form.sourceBankCode} onChange={(event) => setForm({ ...form, sourceBankCode: event.target.value })} className={inputClass} /></Field><Field label="题目编号（可选）"><input aria-label="题目编号" value={form.externalQuestionCode} onChange={(event) => setForm({ ...form, externalQuestionCode: event.target.value })} className={inputClass} /></Field></div><Field label="末级知识点（按类型树选择）"><KnowledgeTreePicker nodes={knowledgePointTrees[form.knowledgePointTypeId] ?? []} selectedId={form.knowledgePointId} onSelect={(knowledgePointId) => setForm({ ...form, knowledgePointId })} /></Field><Field label="题干"><textarea aria-label="题干" value={form.stem} onChange={(event) => setForm({ ...form, stem: event.target.value })} className={`${inputClass} min-h-28 py-3`} /></Field><div><div className="mb-3 flex items-center justify-between"><div><div className="text-sm font-bold">选项与标准答案</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">勾选正确选项，系统自动计算 {form.options.length}选{form.correctOptionIds.length}</div></div><Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, options: [...form.options, { id: optionIds[form.options.length], text: "" }] })} disabled={form.options.length >= optionIds.length}><Plus className="size-4" />增加选项</Button></div><div className="flex flex-col gap-3">{form.options.map((option, index) => <div key={option.id} className="grid grid-cols-[42px_1fr_auto] items-center gap-3"><label className="grid size-10 cursor-pointer place-items-center rounded-xl border border-[var(--border)] bg-[var(--muted)]"><input type="checkbox" checked={form.correctOptionIds.includes(option.id)} onChange={(event) => setForm({ ...form, correctOptionIds: event.target.checked ? [...form.correctOptionIds, option.id] : form.correctOptionIds.filter((id) => id !== option.id) })} className="sr-only" /><span className={form.correctOptionIds.includes(option.id) ? "font-black text-[var(--primary)]" : "font-bold text-[var(--muted-foreground)]"}>{form.correctOptionIds.includes(option.id) ? <Check className="size-4" /> : option.id}</span></label><input value={option.text} onChange={(event) => setForm({ ...form, options: form.options.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) })} className={inputClass} placeholder={`选项 ${option.id}`} />{form.options.length > 2 ? <Button type="button" variant="ghost" size="sm" aria-label={`删除选项 ${option.id}`} onClick={() => { const nextOptions = form.options.slice(0, -1); const validIds = new Set(nextOptions.map((item) => item.id)); setForm({ ...form, options: nextOptions, correctOptionIds: form.correctOptionIds.filter((id) => validIds.has(id)) }); }} disabled={index !== form.options.length - 1}><X className="size-4" /></Button> : <span className="w-9" />}</div>)}</div></div><Field label="选项顺序"><label className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3 text-sm"><input type="checkbox" checked={form.preserveOptionOrder} onChange={(event) => setForm({ ...form, preserveOptionOrder: event.target.checked })} /><span><span className="block font-bold">保持选项顺序</span><span className="block text-xs text-[var(--muted-foreground)]">仅在题干或答案依赖字母、序号或位置时开启</span></span></label></Field><Field label="状态"><select aria-label="状态" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as QuestionStatus })} className={inputClass}><option value="ACTIVE">启用</option><option value="DISABLED">停用</option><option value="ARCHIVED">归档</option></select></Field>{message ? <ErrorMessage message={message} /> : null}<div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setForm(null)}>取消</Button><Button type="submit" disabled={pending || !form.knowledgePointId}>{pending ? "保存中…" : "保存题目"}</Button></div></form></Modal> : null}
  </>;
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{children}</select>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><span className="mb-2 block text-sm font-bold">{label}</span>{children}</div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={title}><div className="my-auto w-full max-w-3xl rounded-[24px] bg-[var(--surface-soft)] p-5 shadow-2xl sm:p-7"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-extrabold">{title}</h2><Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="关闭"><X className="size-5" /></Button></div>{children}</div></div>; }
function StatusBadge({ status }: { status: QuestionStatus }) { return <Badge tone={status === "ACTIVE" ? "green" : status === "DISABLED" ? "amber" : "neutral"}>{status === "ACTIVE" ? "启用" : status === "DISABLED" ? "停用" : "归档"}</Badge>; }
function Empty({ text }: { text: string }) { return <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">{text}</div>; }
function ErrorMessage({ message }: { message: string }) { return <div role="alert" className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700">{message}</div>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-5 py-4 font-semibold">{children}</th>; }
function Td({ label, actions = false, children }: { label: string; actions?: boolean; children: React.ReactNode }) { return <td data-label={label} data-actions={actions || undefined} className="px-5 py-4 text-sm">{children}</td>; }
const inputClass = "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm outline-none transition focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20";
