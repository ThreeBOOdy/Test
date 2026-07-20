"use client";

import { authenticatedFetch } from "@/lib/client/authenticated-fetch";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Pencil, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type StudentRow = { id: string; username: string; displayName: string; enabled: boolean; mustChangePassword: boolean; sessionCount: number; accuracy: number; lastActive: string };
type StudentForm = { id?: string; username: string; displayName: string; password: string; enabled: boolean };

export function StudentManager({ students }: { students: StudentRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<StudentForm | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<{ name: string; value: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return keyword ? students.filter((student) => student.displayName.toLowerCase().includes(keyword) || student.username.toLowerCase().includes(keyword)) : students;
  }, [search, students]);

  function openCreate() {
    setMessage("");
    setForm({ username: "", displayName: "", password: "", enabled: true });
  }

  function openEdit(student: StudentRow) {
    setMessage("");
    setForm({ id: student.id, username: student.username, displayName: student.displayName, password: "", enabled: student.enabled });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setPending(true);
    setMessage("");
    const response = await authenticatedFetch(form.id ? `/api/v1/admin/students/${form.id}` : "/api/v1/admin/students", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form.id ? { action: "update", displayName: form.displayName, enabled: form.enabled } : { username: form.username, displayName: form.displayName, password: form.password }),
    });
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(result.message ?? "保存学生失败");
      return;
    }
    setForm(null);
    router.refresh();
  }

  async function resetPassword(student: StudentRow) {
    if (!window.confirm(`确定为 ${student.displayName} 重置密码吗？`)) return;
    setPending(true);
    const response = await authenticatedFetch(`/api/v1/admin/students/${student.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resetPassword" }) });
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      window.alert(result.message ?? "重置密码失败");
      return;
    }
    setCopied(false);
    setTemporaryPassword({ name: student.displayName, value: result.temporaryPassword });
    router.refresh();
  }

  async function copyPassword() {
    if (!temporaryPassword) return;
    await navigator.clipboard.writeText(temporaryPassword.value);
    setCopied(true);
  }

  return <>
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:flex-row"><label className="flex h-11 flex-1 items-center gap-3 rounded-xl bg-[var(--muted)] px-4"><Search className="size-4 text-[var(--muted-foreground)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="搜索姓名或用户名" /></label><Button onClick={openCreate}><Plus className="size-4" />创建学生</Button></div>
    <Card><CardContent className="overflow-x-auto p-0"><table className="min-w-[900px] w-full text-left"><thead><tr className="border-b border-[var(--border)] bg-[var(--muted)] text-xs text-[var(--muted-foreground)]"><Th>学生</Th><Th>账号状态</Th><Th>密码状态</Th><Th>累计练习</Th><Th>正确率</Th><Th>最近活跃</Th><Th>操作</Th></tr></thead><tbody>{filtered.map((student) => <tr key={student.id} className="border-b border-[var(--border)] last:border-0"><Td><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-full bg-[var(--secondary)] font-bold text-[var(--primary)]">{student.displayName[0]}</div><div><div className="font-extrabold">{student.displayName}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{student.username}</div></div></div></Td><Td><Badge tone={student.enabled ? "green" : "red"}>{student.enabled ? "启用" : "停用"}</Badge></Td><Td><Badge tone={student.mustChangePassword ? "amber" : "green"}>{student.mustChangePassword ? "待修改" : "已设置"}</Badge></Td><Td>{student.sessionCount} 次</Td><Td><span className="font-extrabold text-[var(--primary)]">{student.accuracy}%</span></Td><Td>{student.lastActive}</Td><Td><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => openEdit(student)}><Pencil className="size-4" />编辑</Button><Button variant="ghost" size="sm" onClick={() => resetPassword(student)} disabled={pending}><KeyRound className="size-4" />重置密码</Button></div></Td></tr>)}</tbody></table>{filtered.length === 0 ? <div className="p-10 text-center text-sm text-[var(--muted-foreground)]">没有符合条件的学生</div> : null}</CardContent></Card>
    {form ? <Modal title={form.id ? "编辑学生" : "创建学生"} onClose={() => setForm(null)}><form onSubmit={save} className="flex flex-col gap-5"><Field label="用户名"><input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className={`${inputClass} ${form.id ? "bg-[var(--muted)] text-[var(--muted-foreground)]" : ""}`} disabled={Boolean(form.id)} placeholder="字母、数字、点、横线或下划线" /></Field><Field label="显示姓名"><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className={inputClass} /></Field>{form.id ? <label className="flex items-center gap-3 rounded-xl bg-[var(--muted)] p-4"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} className="size-4" /><span className="text-sm font-bold">启用该学生账号</span></label> : <Field label="初始密码"><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className={inputClass} minLength={8} autoComplete="new-password" /><span className="mt-2 block text-xs text-[var(--muted-foreground)]">至少 8 位。学生首次登录后需修改密码。</span></Field>}{message ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</div> : null}<div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setForm(null)}>取消</Button><Button type="submit" disabled={pending}>{pending ? "保存中…" : "保存学生"}</Button></div></form></Modal> : null}
    {temporaryPassword ? <Modal title="临时密码已生成" onClose={() => setTemporaryPassword(null)}><div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">请立即将临时密码安全地交给 {temporaryPassword.name}。关闭后系统不会再次显示该明文密码。</div><div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--border)] p-4"><code className="min-w-0 flex-1 break-all text-lg font-bold">{temporaryPassword.value}</code><Button type="button" variant="outline" onClick={copyPassword}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "已复制" : "复制"}</Button></div><div className="mt-5 flex justify-end"><Button type="button" onClick={() => setTemporaryPassword(null)}>我已保存</Button></div></Modal> : null}
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label={title}><div className="w-full max-w-lg rounded-[24px] bg-white p-5 shadow-2xl sm:p-7"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-extrabold">{title}</h2><Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="关闭"><X className="size-5" /></Button></div>{children}</div></div>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-5 py-4 font-semibold">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-5 py-4 text-sm">{children}</td>; }
const inputClass = "h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm outline-none transition focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)]/20";