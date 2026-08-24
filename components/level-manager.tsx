"use client";

import { useState } from "react";
import { Layers3, Pencil, Plus, Power, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/client/authenticated-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type LevelManagerRow = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  updatedAt: string;
  questionCount: number;
};

type LevelForm = {
  id?: string;
  code: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  updatedAt?: string;
};

export function LevelManager({ levels }: { levels: LevelManagerRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState<LevelForm | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function openCreate() {
    setMessage("");
    setForm({ code: "", name: "", sortOrder: levels.length, enabled: true });
  }

  function openEdit(level: LevelManagerRow) {
    setMessage("");
    setForm({ id: level.id, code: level.code, name: level.name, sortOrder: level.sortOrder, enabled: level.enabled, updatedAt: level.updatedAt });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setPending(true);
    setMessage("");
    try {
      const body = form.id
        ? { name: form.name, sortOrder: form.sortOrder, enabled: form.enabled, updatedAt: form.updatedAt }
        : { code: form.code, name: form.name, sortOrder: form.sortOrder, enabled: form.enabled };
      const response = await authenticatedFetch(form.id ? `/api/v1/teacher/levels/${form.id}` : "/api/v1/teacher/levels", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "保存字母类失败");
        return;
      }
      setForm(null);
      router.refresh();
    } catch {
      setMessage("保存字母类失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  async function disable(level: LevelManagerRow) {
    setPending(true);
    setMessage("");
    try {
      const response = await authenticatedFetch(`/api/v1/teacher/levels/${level.id}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "停用字母类失败");
        return;
      }
      router.refresh();
    } catch {
      setMessage("停用字母类失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return <>
    <div className="mb-5 flex justify-end"><Button onClick={openCreate}><Plus className="size-4" />新增字母类</Button></div>
    <Card><CardContent className="p-0">
      <div className="hidden grid-cols-[1fr_90px_110px_100px_160px] border-b border-[var(--border)] bg-[var(--muted)] px-5 py-4 text-xs font-semibold text-[var(--muted-foreground)] md:grid"><span>字母类</span><span>排序</span><span>关联题目</span><span>状态</span><span>操作</span></div>
      {levels.map((level) => <div key={level.id} data-testid={`level-${level.id}`} className="grid gap-3 border-b border-[var(--border)] px-4 py-4 last:border-0 md:grid-cols-[1fr_90px_110px_100px_160px] md:items-center md:px-5">
        <div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--secondary)] text-[var(--primary)]"><Layers3 className="size-4" /></div><div className="min-w-0"><div className="font-extrabold">{level.code}级</div></div></div>
        <div className="text-sm"><span className="md:hidden text-[var(--muted-foreground)]">排序：</span>{level.sortOrder}</div>
        <div className="text-sm"><span className="md:hidden text-[var(--muted-foreground)]">关联题目：</span>{level.questionCount}</div>
        <div><Badge tone={level.enabled ? "green" : "red"}>{level.enabled ? "启用" : "停用"}</Badge></div>
        <div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(level)}><Pencil className="size-4" />编辑</Button>{level.enabled ? <Button variant="ghost" size="sm" onClick={() => disable(level)} disabled={pending}><Power className="size-4" />停用</Button> : null}</div>
      </div>)}
      {levels.length === 0 ? <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">尚未配置字母类</div> : null}
    </CardContent></Card>
    {form ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={form.id ? "编辑字母类" : "新增字母类"}><form onSubmit={save} className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-extrabold">{form.id ? "编辑字母类" : "新增字母类"}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">字母类代码支持 A、B、C、K、AA 等多字母代码；停用后不在归类向导与练习入口出现，已有题目关联保留。</p></div><Button type="button" variant="ghost" size="sm" aria-label="关闭" onClick={() => setForm(null)}><X className="size-4" /></Button></div><div className="mt-5 grid gap-4"><label className="grid gap-2 text-sm font-semibold">字母类代码<input aria-label="字母类代码" required maxLength={50} readOnly={Boolean(form.id)} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)] read-only:opacity-60" placeholder="如 K、AA" /></label><label className="grid gap-2 text-sm font-semibold">字母类名称<input aria-label="字母类名称" required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)]" /></label><label className="grid gap-2 text-sm font-semibold">排序<input aria-label="排序" required type="number" min={0} max={100000} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)]" /></label><label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-sm font-semibold"><input aria-label="启用" type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="size-4 accent-cyan-600" />启用，允许在归类向导与练习入口使用</label></div>{message ? <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{message}</p> : null}<div className="mt-6 flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setForm(null)}>取消</Button><Button type="submit" disabled={pending}>{pending ? "保存中..." : "保存字母类"}</Button></div></form></div> : null}
  </>;
}
