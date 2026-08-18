"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookType, Pencil, Plus, Power, X } from "lucide-react";
import { authenticatedFetch } from "@/lib/client/authenticated-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KnowledgeManager, type KnowledgeRow } from "@/components/knowledge-manager";

export type KnowledgePointTypeRow = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  updatedAt: string;
  pointCount: number;
};

type TypeForm = {
  id?: string;
  code: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  updatedAt?: string;
};

export function KnowledgePointTypeManager({
  types,
  points,
  selectedTypeId,
}: {
  types: KnowledgePointTypeRow[];
  points: KnowledgeRow[];
  selectedTypeId: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<TypeForm | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const activeType = types.find((type) => type.id === selectedTypeId) ?? null;

  function openCreate() {
    setMessage("");
    setForm({ code: "", name: "", sortOrder: types.length, enabled: true });
  }

  function openEdit(type: KnowledgePointTypeRow) {
    setMessage("");
    setForm({ id: type.id, code: type.code, name: type.name, sortOrder: type.sortOrder, enabled: type.enabled, updatedAt: type.updatedAt });
  }

  async function saveType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setPending(true);
    setMessage("");
    try {
      const body = form.id
        ? { name: form.name, sortOrder: form.sortOrder, enabled: form.enabled, updatedAt: form.updatedAt }
        : { code: form.code, name: form.name, sortOrder: form.sortOrder, enabled: form.enabled };
      const response = await authenticatedFetch(form.id ? `/api/v1/teacher/knowledge-point-types/${form.id}` : "/api/v1/teacher/knowledge-point-types", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "保存知识点类型失败");
        return;
      }
      setForm(null);
      router.refresh();
    } catch {
      setMessage("保存知识点类型失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  async function disable(type: KnowledgePointTypeRow) {
    setPending(true);
    setMessage("");
    try {
      const response = await authenticatedFetch(`/api/v1/teacher/knowledge-point-types/${type.id}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "停用知识点类型失败");
        return;
      }
      router.refresh();
    } catch {
      setMessage("停用知识点类型失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return <>
    <div className="mb-5 flex justify-end"><Button onClick={openCreate}><Plus className="size-4" />新增类型</Button></div>
    <Card><CardContent className="p-0">
      <div className="hidden grid-cols-[1fr_90px_110px_100px_170px] border-b border-[var(--border)] bg-[var(--muted)] px-5 py-4 text-xs font-semibold text-[var(--muted-foreground)] md:grid"><span>知识点类型</span><span>排序</span><span>知识点</span><span>状态</span><span>操作</span></div>
      {types.map((type) => {
        const active = type.id === selectedTypeId;
        return <div key={type.id} data-testid={`knowledge-point-type-${type.id}`} className={`grid gap-3 border-b border-[var(--border)] px-4 py-4 last:border-0 md:grid-cols-[1fr_90px_110px_100px_170px] md:items-center md:px-5 ${active ? "bg-cyan-500/5" : ""}`}>
          <Link href={`/teacher/knowledge-types?typeId=${type.id}` as never} className="flex min-w-0 items-center gap-3 rounded-xl">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--secondary)] text-[var(--primary)]"><BookType className="size-4" /></div>
            <div className="min-w-0">
              <div className="font-extrabold">{type.name}</div>
              <div className="mt-1 text-xs text-[var(--muted-foreground)]">{type.code}{active ? " · 当前查看" : ""}</div>
            </div>
          </Link>
          <div className="text-sm"><span className="md:hidden text-[var(--muted-foreground)]">排序：</span>{type.sortOrder}</div>
          <div className="text-sm"><span className="md:hidden text-[var(--muted-foreground)]">知识点：</span>{type.pointCount}</div>
          <div><Badge tone={type.enabled ? "green" : "red"}>{type.enabled ? "启用" : "停用"}</Badge></div>
          <div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(type)}><Pencil className="size-4" />编辑</Button>{type.enabled ? <Button variant="ghost" size="sm" onClick={() => disable(type)} disabled={pending}><Power className="size-4" />停用</Button> : null}</div>
        </div>;
      })}
      {types.length === 0 ? <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">尚未配置知识点类型，请先新增类型</div> : null}
    </CardContent></Card>

    <div className="mt-8">
      {activeType ? <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">知识点树：{activeType.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">在类型 {activeType.code} 下新增分类号时会自动补齐缺失的父级目录。</p>
          </div>
          <Badge tone={activeType.enabled ? "green" : "red"}>{activeType.enabled ? "启用中" : "已停用"}</Badge>
        </div>
        {!activeType.enabled ? <div className="mb-4 rounded-xl border border-amber-600/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700">该类型已停用，仍可查看知识点树；需要先启用类型才能新增知识点。</div> : null}
        <KnowledgeManager points={points} typeId={activeType.id} />
      </> : <Card><CardContent className="p-10 text-center text-sm text-[var(--muted-foreground)]">选择上方一个知识点类型后，可在此维护其知识点树。</CardContent></Card>}
    </div>

    {form ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={form.id ? "编辑知识点类型" : "新增知识点类型"}><form onSubmit={saveType} className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-extrabold">{form.id ? "编辑知识点类型" : "新增知识点类型"}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">类型代码是机器码，如 DG、TX；同一代码不可重复。停用后不再用于新知识点/导入向导，已有树保留。</p></div><Button type="button" variant="ghost" size="sm" aria-label="关闭" onClick={() => setForm(null)}><X className="size-4" /></Button></div><div className="mt-5 grid gap-4"><label className="grid gap-2 text-sm font-semibold">类型代码<input aria-label="类型代码" required maxLength={50} readOnly={Boolean(form.id)} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)] read-only:opacity-60" placeholder="如 DG、TX" /></label><label className="grid gap-2 text-sm font-semibold">类型名称<input aria-label="类型名称" required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)]" /></label><label className="grid gap-2 text-sm font-semibold">排序<input aria-label="排序" required type="number" min={0} max={100000} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)]" /></label><label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-sm font-semibold"><input aria-label="启用" type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="size-4 accent-cyan-600" />启用，允许新增知识点与在导入向导中使用</label></div>{message ? <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{message}</p> : null}<div className="mt-6 flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setForm(null)}>取消</Button><Button type="submit" disabled={pending}>{pending ? "保存中..." : "保存类型"}</Button></div></form></div> : null}
  </>;
}
