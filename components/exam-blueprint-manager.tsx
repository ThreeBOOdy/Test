"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Copy, FolderTree, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authenticatedFetch } from "@/lib/client/authenticated-fetch";
import { buildKnowledgeTree, getDescendantIds } from "@/lib/domain/knowledge-tree";
import type { KnowledgePoint, Level, Question } from "@/lib/domain/types";

export type BlueprintManagerKnowledgePoint = {
  id: string;
  code: string;
  name: string;
  path: string;
};

export type BlueprintManagerItem = {
  id: string;
  knowledgePointId: string;
  knowledgePoint: BlueprintManagerKnowledgePoint | null;
  singleCount: number;
  multipleCount: number;
};

export type BlueprintManagerRow = {
  id: string;
  levelId: string;
  name: string;
  durationMinutes: number | null;
  passingCount: number;
  enabled: boolean;
  isDefault: boolean;
  totalCount: number;
  items: BlueprintManagerItem[];
};

type DraftItem = {
  key: string;
  id?: string;
  knowledgePointId: string;
  singleCount: number;
  multipleCount: number;
};

type EditorState = {
  id?: string;
  levelId: string;
  name: string;
  durationMinutes: string;
  passingCount: string;
  enabled: boolean;
  isDefault: boolean;
  items: DraftItem[];
};

type Inventory = {
  singleCount: number;
  multipleCount: number;
};

let draftKeySeq = 0;
function nextDraftKey() {
  draftKeySeq += 1;
  return `draft-${draftKeySeq}`;
}

function getDescendantsByPoint(points: readonly KnowledgePoint[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const point of points) {
    map.set(point.id, new Set(getDescendantIds(points, point.id)));
  }
  return map;
}

function getInventory(
  levelId: string,
  knowledgePointId: string,
  questions: readonly Question[],
  descendantsByPointId: ReadonlyMap<string, Set<string>>,
  pointById: ReadonlyMap<string, KnowledgePoint>,
): Inventory {
  const descendantIds = descendantsByPointId.get(knowledgePointId) ?? new Set([knowledgePointId]);
  let singleCount = 0;
  let multipleCount = 0;
  for (const question of questions) {
    if (question.status !== "ACTIVE") continue;
    if (!question.levelIds.includes(levelId)) continue;
    if (!descendantIds.has(question.knowledgePointId)) continue;
    if (!pointById.get(question.knowledgePointId)?.enabled) continue;
    if (question.type === "SINGLE_CHOICE") singleCount += 1;
    else multipleCount += 1;
  }
  return { singleCount, multipleCount };
}

function getDisabledPointIds(
  items: readonly DraftItem[],
  descendantsByPointId: ReadonlyMap<string, Set<string>>,
): Set<string> {
  const disabled = new Set<string>();
  for (const item of items) {
    const descendants = descendantsByPointId.get(item.knowledgePointId) ?? new Set([item.knowledgePointId]);
    for (const id of descendants) disabled.add(id);
  }
  for (const [id, descendants] of descendantsByPointId) {
    if (items.some((item) => descendants.has(item.knowledgePointId))) disabled.add(id);
  }
  return disabled;
}

function toDraftItems(items: readonly BlueprintManagerItem[]): DraftItem[] {
  return items.map((item) => ({
    key: nextDraftKey(),
    id: item.id,
    knowledgePointId: item.knowledgePointId,
    singleCount: item.singleCount,
    multipleCount: item.multipleCount,
  }));
}

export function ExamBlueprintManager({
  levels,
  points,
  questions,
  blueprints,
}: {
  levels: Level[];
  points: KnowledgePoint[];
  questions: Question[];
  blueprints: BlueprintManagerRow[];
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const descendantsByPointId = useMemo(() => getDescendantsByPoint(points), [points]);
  const grouped = useMemo(
    () => levels.map((level) => ({ level, blueprints: blueprints.filter((blueprint) => blueprint.levelId === level.id) })),
    [levels, blueprints],
  );

  function openCreate(levelId: string) {
    setMessage("");
    setEditor({
      levelId,
      name: "",
      durationMinutes: "",
      passingCount: "30",
      enabled: true,
      isDefault: false,
      items: [],
    });
  }

  function openEdit(blueprint: BlueprintManagerRow) {
    setMessage("");
    setEditor({
      id: blueprint.id,
      levelId: blueprint.levelId,
      name: blueprint.name,
      durationMinutes: blueprint.durationMinutes == null ? "" : String(blueprint.durationMinutes),
      passingCount: String(blueprint.passingCount),
      enabled: blueprint.enabled,
      isDefault: blueprint.isDefault,
      items: toDraftItems(blueprint.items),
    });
  }

  function closeEditor() {
    setEditor(null);
    setTreeOpen(false);
    setMessage("");
  }

  async function saveBlueprint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;

    const total = editor.items.reduce((sum, item) => sum + item.singleCount + item.multipleCount, 0);
    const passingCount = Number(editor.passingCount);
    const durationMinutes = editor.durationMinutes.trim() ? Number(editor.durationMinutes) : null;

    if (!editor.name.trim()) {
      setMessage("请输入蓝图名称");
      return;
    }
    if (editor.items.length === 0) {
      setMessage("蓝图至少需要一个条目");
      return;
    }
    if (editor.items.some((item) => item.singleCount + item.multipleCount <= 0)) {
      setMessage("蓝图条目题量不能为 0");
      return;
    }
    if (!Number.isInteger(passingCount) || passingCount <= 0) {
      setMessage("合格题数必须大于 0");
      return;
    }
    if (passingCount > total) {
      setMessage("合格题数不能超过试卷总题数");
      return;
    }
    if (durationMinutes != null && (!Number.isInteger(durationMinutes) || durationMinutes <= 0)) {
      setMessage("考试时间必须大于 0 分钟或留空表示不限时");
      return;
    }

    setPending(true);
    setMessage("");
    try {
      const body = {
        name: editor.name.trim(),
        durationMinutes,
        passingCount,
        enabled: editor.enabled,
        isDefault: editor.isDefault,
        items: editor.items.map((item) => ({
          knowledgePointId: item.knowledgePointId,
          singleCount: item.singleCount,
          multipleCount: item.multipleCount,
        })),
      };
      const response = await authenticatedFetch(
        editor.id ? `/api/v1/teacher/exam-blueprints/${editor.id}` : "/api/v1/teacher/exam-blueprints",
        {
          method: editor.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editor.id ? body : { ...body, levelId: editor.levelId }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "保存蓝图失败");
        return;
      }
      closeEditor();
      router.refresh();
    } catch {
      setMessage("保存蓝图失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  async function copyBlueprint(blueprint: BlueprintManagerRow) {
    setPending(true);
    setMessage("");
    try {
      const response = await authenticatedFetch(`/api/v1/teacher/exam-blueprints/${blueprint.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "复制蓝图失败");
        return;
      }
      router.refresh();
    } catch {
      setMessage("复制蓝图失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  async function deleteBlueprint(blueprint: BlueprintManagerRow) {
    if (!window.confirm(`确定删除蓝图“${blueprint.name}”？删除后不可恢复。`)) return;
    setPending(true);
    setMessage("");
    try {
      const response = await authenticatedFetch(`/api/v1/teacher/exam-blueprints/${blueprint.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "删除蓝图失败");
        return;
      }
      router.refresh();
    } catch {
      setMessage("删除蓝图失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  function addDraftItem(point: KnowledgePoint) {
    setEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        items: [
          ...current.items,
          { key: nextDraftKey(), knowledgePointId: point.id, singleCount: 1, multipleCount: 0 },
        ],
      };
    });
    setTreeOpen(false);
  }

  function updateDraftItem(key: string, patch: Partial<Pick<DraftItem, "singleCount" | "multipleCount">>) {
    setEditor((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
      };
    });
  }

  function removeDraftItem(key: string) {
    setEditor((current) => {
      if (!current) return current;
      return { ...current, items: current.items.filter((item) => item.key !== key) };
    });
  }

  const pointById = useMemo(() => new Map(points.map((point) => [point.id, point])), [points]);
  const editorStock = useMemo(() => {
    if (!editor) return [];
    return editor.items.map((item) => {
      const inventory = getInventory(editor.levelId, item.knowledgePointId, questions, descendantsByPointId, pointById);
      const issues: Array<{ label: string; required: number; available: number; missing: number }> = [];
      if (item.singleCount > inventory.singleCount) {
        issues.push({ label: "单选", required: item.singleCount, available: inventory.singleCount, missing: item.singleCount - inventory.singleCount });
      }
      if (item.multipleCount > inventory.multipleCount) {
        issues.push({ label: "多选", required: item.multipleCount, available: inventory.multipleCount, missing: item.multipleCount - inventory.multipleCount });
      }
      return { item, inventory, issues };
    });
  }, [editor, questions, descendantsByPointId, pointById]);

  const editorTotal = editor ? editor.items.reduce((sum, item) => sum + item.singleCount + item.multipleCount, 0) : 0;
  const editorStockIssues = editorStock.flatMap((entry) => entry.issues);

  return <>
    <div className="grid gap-6">
      {grouped.map(({ level, blueprints: levelBlueprints }) => (
        <Card key={level.id}>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="grid size-10 place-items-center rounded-xl bg-[var(--secondary)] font-radio text-sm font-black text-[var(--primary)]">{level.code}</div>
                <div>
                  <CardTitle>{level.name} · 模拟测试蓝图</CardTitle>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">可维护多套命名蓝图；学生模拟测试默认使用标记为“默认”的蓝图。</p>
                </div>
              </div>
            </div>
            <Button type="button" onClick={() => openCreate(level.id)} disabled={pending}><Plus className="size-4" />新增蓝图</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {levelBlueprints.map((blueprint) => (
              <div key={blueprint.id} data-testid={`blueprint-${blueprint.id}`} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold">{blueprint.name}</span>
                      {blueprint.isDefault ? <Badge tone="blue">默认</Badge> : null}
                      <Badge tone={blueprint.enabled ? "green" : "red"}>{blueprint.enabled ? "启用" : "停用"}</Badge>
                    </div>
                    <div className="mt-1 text-xs leading-6 text-[var(--muted-foreground)]">
                      {blueprint.items.length} 个条目 · 共 {blueprint.totalCount} 题 · {blueprint.durationMinutes == null ? "不限时" : `${blueprint.durationMinutes} 分钟`} · 合格 {blueprint.passingCount} 题
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(blueprint)}><Pencil className="size-4" />编辑</Button>
                    <Button variant="ghost" size="sm" onClick={() => copyBlueprint(blueprint)} disabled={pending}><Copy className="size-4" />复制</Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteBlueprint(blueprint)} disabled={pending}><Trash2 className="size-4" />删除</Button>
                  </div>
                </div>
              </div>
            ))}
            {levelBlueprints.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">该字母类尚未配置蓝图，点击右上角“新增蓝图”创建。</div> : null}
          </CardContent>
        </Card>
      ))}
      {levels.length === 0 ? <Card><CardContent className="p-10 text-center text-sm text-[var(--muted-foreground)]">尚未配置字母类，请先到“字母类维护”创建。</CardContent></Card> : null}
    </div>

    {message && !editor ? <p role="alert" className="mt-5 rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700">{message}</p> : null}

    {editor ? <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label={editor.id ? "编辑蓝图" : "新建蓝图"}>
      <form onSubmit={saveBlueprint} className="mx-auto my-6 w-full max-w-4xl rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold">{editor.id ? "编辑蓝图" : "新建蓝图"}</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">按知识点条目配置模拟试卷；同一蓝图内不能同时选择父子/祖先后代知识点。</p>
          </div>
          <Button type="button" variant="ghost" size="sm" aria-label="关闭" onClick={closeEditor}><X className="size-4" /></Button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {!editor.id ? <label className="grid gap-2 text-sm font-semibold">
            字母类
            <select aria-label="字母类" value={editor.levelId} onChange={(event) => setEditor({ ...editor, levelId: event.target.value })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)]">
              {levels.map((level) => <option key={level.id} value={level.id}>{level.code} · {level.name}</option>)}
            </select>
          </label> : null}
          <label className="grid gap-2 text-sm font-semibold">
            蓝图名称
            <input aria-label="蓝图名称" required maxLength={100} value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)]" placeholder="如 期中模拟、期末冲刺" />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            考试时间（分钟）
            <input aria-label="考试时间（分钟）" type="number" min={1} max={1440} value={editor.durationMinutes} onChange={(event) => setEditor({ ...editor, durationMinutes: event.target.value })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)]" placeholder="留空表示不限时" />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            合格题数
            <input aria-label="合格题数" required type="number" min={1} max={1000} value={editor.passingCount} onChange={(event) => setEditor({ ...editor, passingCount: event.target.value })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)]" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-sm font-semibold">
            <input aria-label="启用" type="checkbox" checked={editor.enabled} onChange={(event) => setEditor({ ...editor, enabled: event.target.checked })} className="size-4 accent-cyan-600" />
            启用该蓝图
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-sm font-semibold">
            <input aria-label="设为默认蓝图" type="checkbox" checked={editor.isDefault} onChange={(event) => setEditor({ ...editor, isDefault: event.target.checked })} className="size-4 accent-cyan-600" />
            设为该字母类默认蓝图
          </label>
        </div>

        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold">蓝图条目</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">任意层级知识点均可选择，已选知识点的父/子节点会自动禁用，避免重复抽取。</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setTreeOpen(true)}><Plus className="size-4" />添加知识点条目</Button>
          </div>

          {editor.items.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">尚未添加条目，请选择一个知识点。</div> : null}

          {editor.items.length > 0 ? <div className="mt-4 overflow-x-auto">
            <table className="responsive-data-table min-w-[760px] w-full">
              <thead>
                <tr className="border-y border-[var(--border)] bg-[var(--muted)] text-left text-xs font-semibold text-[var(--muted-foreground)]">
                  <th className="px-4 py-3">知识点</th>
                  <th className="px-4 py-3">单选</th>
                  <th className="px-4 py-3">多选</th>
                  <th className="px-4 py-3">当前库存</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {editorStock.map(({ item, inventory, issues }) => {
                  const point = pointById.get(item.knowledgePointId);
                  const name = point?.name ?? "未知知识点";
                  return <tr key={item.key} data-testid={`blueprint-item-${item.key}`} className="border-b border-[var(--border)]">
                    <td data-label="知识点" className="px-4 py-3">
                      <div className="font-extrabold">{point?.code}</div>
                      <div className="mt-1 text-xs text-[var(--muted-foreground)]">{name}</div>
                    </td>
                    <td data-label="单选" className="px-4 py-3"><input aria-label={`${point?.code ?? name} 单选数量`} type="number" min={0} max={1000} value={item.singleCount} onChange={(event) => updateDraftItem(item.key, { singleCount: Math.max(0, Number(event.target.value) || 0) })} className="h-10 w-20 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 outline-none focus:border-[var(--primary)]" /></td>
                    <td data-label="多选" className="px-4 py-3"><input aria-label={`${point?.code ?? name} 多选数量`} type="number" min={0} max={1000} value={item.multipleCount} onChange={(event) => updateDraftItem(item.key, { multipleCount: Math.max(0, Number(event.target.value) || 0) })} className="h-10 w-20 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 outline-none focus:border-[var(--primary)]" /></td>
                    <td data-label="当前库存" className="px-4 py-3 text-xs leading-5 text-[var(--muted-foreground)]">
                      <div>单选 {inventory.singleCount} · 多选 {inventory.multipleCount}</div>
                      {issues.map((issue) => <div key={issue.label} className="font-semibold text-rose-700">缺 {issue.missing} 题{issue.label}</div>)}
                    </td>
                    <td data-label="操作" data-actions className="px-4 py-3"><Button type="button" variant="ghost" size="sm" aria-label={`删除条目 ${point?.code ?? name}`} onClick={() => removeDraftItem(item.key)}><Trash2 className="size-4" /></Button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div> : null}
        </div>

        <div className={`mt-5 rounded-xl px-4 py-3 text-sm font-semibold ${editorStockIssues.length > 0 || editorTotal <= 0 || (Number(editor.passingCount) > editorTotal) ? "bg-rose-500/10 text-rose-700" : "bg-emerald-500/10 text-emerald-700"}`} role="status">
          共 {editorTotal} 题 · 合格 {editor.passingCount || 0} 题 · {editorStockIssues.length > 0 ? `库存不足：${editorStockIssues.map((issue) => `${issue.label}缺 ${issue.missing} 题`).join("；")}` : "实时库存校验通过"}
        </div>

        {message ? <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{message}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={closeEditor}>取消</Button>
          <Button type="submit" disabled={pending}>{pending ? "保存中…" : <><Save className="size-4" />保存蓝图</>}</Button>
        </div>
      </form>
    </div> : null}

    {treeOpen && editor ? <KnowledgePointTreePicker
      points={points}
      disabledIds={getDisabledPointIds(editor.items, descendantsByPointId)}
      onSelect={addDraftItem}
      onClose={() => setTreeOpen(false)}
    /> : null}
  </>;
}

function KnowledgePointTreePicker({
  points,
  disabledIds,
  onSelect,
  onClose,
}: {
  points: KnowledgePoint[];
  disabledIds: Set<string>;
  onSelect: (point: KnowledgePoint) => void;
  onClose: () => void;
}) {
  const tree = useMemo(() => buildKnowledgeTree(points), [points]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const parentIds = new Set<string>();
    for (const point of points) {
      if (point.parentId) parentIds.add(point.parentId);
    }
    return parentIds;
  });

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="选择知识点">
    <div className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold">选择知识点</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">任意层级均可选；灰色节点因与已选条目父子/祖先后代重叠而禁用。</p>
        </div>
        <Button type="button" variant="ghost" size="sm" aria-label="关闭" onClick={onClose}><X className="size-4" /></Button>
      </div>
      <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
        {tree.length === 0 ? <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">暂无知识点</div> : null}
        {tree.map((node) => <TreePickerRow key={node.id} node={node} depth={0} expanded={expanded} onToggle={toggleExpanded} disabledIds={disabledIds} onSelect={onSelect} />)}
      </div>
    </div>
  </div>;
}

function TreePickerRow({
  node,
  depth,
  expanded,
  onToggle,
  disabledIds,
  onSelect,
}: {
  node: ReturnType<typeof buildKnowledgeTree>[number];
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  disabledIds: Set<string>;
  onSelect: (point: KnowledgePoint) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const disabled = disabledIds.has(node.id) || !node.enabled;

  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2 hover:bg-[var(--muted)]" style={{ paddingLeft: `${Math.min(depth, 8) * 20 + 8}px` }}>
        <button type="button" onClick={() => onToggle(node.id)} disabled={!hasChildren} aria-label={hasChildren ? (isExpanded ? "收起" : "展开") : "无下级"} aria-expanded={hasChildren ? isExpanded : undefined} className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--muted-foreground)] disabled:opacity-40">
          {hasChildren ? isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" /> : <span className="size-4" />}
        </button>
        <button type="button" disabled={disabled} onClick={() => onSelect(node)} aria-label={`选择知识点 ${node.code} ${node.name}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 text-left disabled:cursor-not-allowed disabled:opacity-40">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--secondary)] text-[var(--primary)]"><FolderTree className="size-4" /></span>
          <span className="font-extrabold">{node.code}</span>
          <span className="truncate text-sm font-semibold">{node.name}</span>
          {disabled ? <span className="ml-auto shrink-0 text-xs text-[var(--muted-foreground)]">已禁用</span> : <Plus className="ml-auto size-4 shrink-0 text-[var(--primary)]" />}
        </button>
      </div>
      {hasChildren && isExpanded ? <div className="ml-8 mt-1 space-y-1 border-l border-[var(--border)] pl-2">{node.children.map((child) => <TreePickerRow key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} disabledIds={disabledIds} onSelect={onSelect} />)}</div> : null}
    </div>
  );
}
