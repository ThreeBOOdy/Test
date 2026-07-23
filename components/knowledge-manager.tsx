"use client";

import { authenticatedFetch } from "@/lib/client/authenticated-fetch";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderTree, Pencil, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type KnowledgeRow = { id: string; code: string; name: string; depth: number; sortOrder: number; enabled: boolean; childCount: number; questionCount: number };
type FormState = { id?: string; code: string; name: string; sortOrder: number; enabled: boolean };

export function KnowledgeManager({ points }: { points: KnowledgeRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return keyword ? points.filter((point) => point.code.toLowerCase().includes(keyword) || point.name.toLowerCase().includes(keyword)) : points;
  }, [points, search]);

  function openCreate() {
    setMessage("");
    setForm({ code: "", name: "", sortOrder: 0, enabled: true });
  }

  function openEdit(point: KnowledgeRow) {
    setMessage("");
    setForm({ id: point.id, code: point.code, name: point.name, sortOrder: point.sortOrder, enabled: point.enabled });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setPending(true);
    setMessage("");
    const response = await authenticatedFetch(form.id ? `/api/v1/admin/knowledge-points/${form.id}` : "/api/v1/admin/knowledge-points", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(result.message ?? "保存知识点失败");
      return;
    }
    setForm(null);
    router.refresh();
  }

  return <>
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 sm:flex-row"><label className="flex h-11 flex-1 items-center gap-3 rounded-xl bg-[var(--muted)] px-4"><Search className="size-4 text-[var(--muted-foreground)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="搜索分类号或知识点名称" /></label><Button onClick={openCreate}><Plus className="size-4" />新增知识点</Button></div>
    <Card><CardContent className="p-0"><div className="hidden grid-cols-[1fr_120px_120px_110px_100px] border-b border-[var(--border)] bg-[var(--muted)] px-5 py-4 text-xs font-semibold text-[var(--muted-foreground)] md:grid"><span>知识点目录</span><span>下级节点</span><span>题目数量</span><span>状态</span><span>操作</span></div>{filtered.map((point) => <div key={point.id} className="grid gap-3 border-b border-[var(--border)] px-4 py-4 last:border-0 md:grid-cols-[1fr_120px_120px_110px_100px] md:items-center md:px-5"><div className="flex min-w-0 items-center gap-3" style={{ paddingLeft: `${Math.min(point.depth, 6) * 18}px` }}><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--secondary)] text-[var(--primary)]"><FolderTree className="size-4" /></div><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-extrabold">{point.code}</span><span className="truncate text-sm font-semibold">{point.name}</span></div><div className="mt-1 text-xs text-[var(--muted-foreground)]">第 {point.depth + 1} 层 · 排序 {point.sortOrder}</div></div></div><div className="text-sm"><span className="md:hidden text-[var(--muted-foreground)]">下级节点：</span>{point.childCount}</div><div className="text-sm"><span className="md:hidden text-[var(--muted-foreground)]">直接题目：</span>{point.questionCount}</div><div><Badge tone={point.enabled ? "green" : "red"}>{point.enabled ? "启用" : "停用"}</Badge></div><div><Button variant="ghost" size="sm" onClick={() => openEdit(point)}><Pencil className="size-4" />编辑</Button></div></div>)}{filtered.length === 0 ? <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">没有符合条件的知识点</div> : null}</CardContent></Card>
    {form ? <Modal title={form.id ? "编辑知识点" : "新增知识点"} onClose={() => setForm(null)}><form onSubmit={save} className="flex flex-col gap-5"><Field label="分类号"><input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className={`${inputClass} ${form.id ? "bg-[var(--muted)] text-[var(--muted-foreground)]" : ""}`} placeholder="例如 4.1.1" disabled={Boolean(form.id)} /></Field><Field label="知识点名称"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} placeholder="例如 导体和绝缘体" /></Field><Field label="同级排序"><input type="number" min={0} max={100000} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} className={inputClass} /></Field>{form.id ? <label className="flex items-start gap-3 rounded-xl bg-[var(--muted)] p-4"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="mt-1 size-4" /><span><span className="block text-sm font-bold">启用该知识点</span><span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">停用父节点时会同步停用全部后代，新练习入口将隐藏，历史记录保留。</span></span></label> : null}{message ? <div className="rounded-xl bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">{message}</div> : null}<div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setForm(null)}>取消</Button><Button type="submit" disabled={pending}>{pending ? "保存中…" : "保存知识点"}</Button></div></form></Modal> : null}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label={title}><div className="w-full max-w-lg rounded-[24px] bg-[var(--surface-soft)] p-5 shadow-2xl sm:p-7"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-extrabold">{title}</h2><Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="关闭"><X className="size-5" /></Button></div>{children}</div></div>; }
const inputClass = "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm outline-none transition focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20";
