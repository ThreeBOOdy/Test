"use client";

import { useState } from "react";
import { Pencil, Plus, School, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/client/authenticated-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type GradeManagerRow = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  updatedAt: string;
  studentCount: number;
};

type GradeForm = {
  id?: string;
  code: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
  updatedAt?: string;
};

export function GradeManager({ grades }: { grades: GradeManagerRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState<GradeForm | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function openCreate() {
    setMessage("");
    setForm({ code: "", name: "", sortOrder: grades.length, enabled: true });
  }

  function openEdit(grade: GradeManagerRow) {
    setMessage("");
    setForm({ id: grade.id, code: grade.code, name: grade.name, sortOrder: grade.sortOrder, enabled: grade.enabled, updatedAt: grade.updatedAt });
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
      const response = await authenticatedFetch(form.id ? `/api/v1/admin/grades/${form.id}` : "/api/v1/admin/grades", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "保存年级失败");
        return;
      }
      setForm(null);
      router.refresh();
    } catch {
      setMessage("保存年级失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return <>
    <div className="mb-5 flex justify-end"><Button onClick={openCreate}><Plus className="size-4" />新增年级</Button></div>
    <Card><CardContent className="p-0">
      <div className="hidden grid-cols-[1fr_110px_120px_110px_100px] border-b border-[var(--border)] bg-[var(--muted)] px-5 py-4 text-xs font-semibold text-[var(--muted-foreground)] md:grid"><span>年级</span><span>排序</span><span>关联学生</span><span>状态</span><span>操作</span></div>
      {grades.map((grade) => <div key={grade.id} data-testid={`grade-${grade.id}`} className="grid gap-3 border-b border-[var(--border)] px-4 py-4 last:border-0 md:grid-cols-[1fr_110px_120px_110px_100px] md:items-center md:px-5">
        <div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--secondary)] text-[var(--primary)]"><School className="size-4" /></div><div className="min-w-0"><div className="font-extrabold">{grade.name}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{grade.code}</div></div></div>
        <div className="text-sm"><span className="md:hidden text-[var(--muted-foreground)]">排序：</span>{grade.sortOrder}</div>
        <div className="text-sm"><span className="md:hidden text-[var(--muted-foreground)]">关联学生：</span>{grade.studentCount}</div>
        <div><Badge tone={grade.enabled ? "green" : "red"}>{grade.enabled ? "启用" : "停用"}</Badge></div>
        <div><Button variant="ghost" size="sm" onClick={() => openEdit(grade)}><Pencil className="size-4" />编辑</Button></div>
      </div>)}
      {grades.length === 0 ? <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">尚未配置年级</div> : null}
    </CardContent></Card>
    {form ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={form.id ? "编辑年级" : "新增年级"}><form onSubmit={save} className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-extrabold">{form.id ? "编辑年级" : "新增年级"}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">停用后不再作为学生注册可选项，已有学生关系保留。</p></div><Button type="button" variant="ghost" size="sm" aria-label="关闭" onClick={() => setForm(null)}><X className="size-4" /></Button></div><div className="mt-5 grid gap-4"><label className="grid gap-2 text-sm font-semibold">年级代码<input aria-label="年级代码" required maxLength={50} readOnly={Boolean(form.id)} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)] read-only:opacity-60" /></label><label className="grid gap-2 text-sm font-semibold">年级名称<input aria-label="年级名称" required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)]" /></label><label className="grid gap-2 text-sm font-semibold">排序<input aria-label="排序" required type="number" min={0} max={100000} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} className="h-11 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 outline-none focus:border-[var(--primary)]" /></label><label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)] px-4 py-3 text-sm font-semibold"><input aria-label="启用" type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="size-4 accent-cyan-600" />启用，允许学生注册选择</label></div>{message ? <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-700">{message}</p> : null}<div className="mt-6 flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setForm(null)}>取消</Button><Button type="submit" disabled={pending}>{pending ? "保存中..." : "保存年级"}</Button></div></form></div> : null}
  </>;
}
