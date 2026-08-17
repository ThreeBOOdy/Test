"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Teacher = { id: string; username: string; displayName: string; enabled: boolean; mustChangePassword: boolean; createdAt: Date };
type Credential = { username: string; temporaryPassword: string; action: "created" | "reset" };

export function TeacherAccountManager({ teachers }: { teachers: Teacher[] }) {
  const [rows, setRows] = useState(teachers);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [credential, setCredential] = useState<Credential | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function responseBody(response: Response) {
    const body = await response.json() as { message?: string };
    if (!response.ok) throw new Error(body.message ?? "操作失败");
    return body;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage("");
    try {
      const result = await responseBody(await fetch("/api/v1/admin/teachers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, displayName }) })) as { teacher: Teacher; temporaryPassword: string };
      setRows((current) => [...current, result.teacher].sort((left, right) => left.username.localeCompare(right.username)));
      setCredential({ username: result.teacher.username, temporaryPassword: result.temporaryPassword, action: "created" });
      setUsername(""); setDisplayName("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "创建教师账号失败"); }
    finally { setSaving(false); }
  }

  async function reset(teacher: Teacher) {
    if (!window.confirm(`确认重置 ${teacher.displayName} 的密码？该教师的全部会话将立即失效。`)) return;
    setSaving(true); setMessage("");
    try {
      const result = await responseBody(await fetch(`/api/v1/admin/teachers/${teacher.id}/reset-password`, { method: "POST" })) as { temporaryPassword: string };
      setCredential({ username: teacher.username, temporaryPassword: result.temporaryPassword, action: "reset" });
      setRows((current) => current.map((row) => row.id === teacher.id ? { ...row, mustChangePassword: true } : row));
    } catch (error) { setMessage(error instanceof Error ? error.message : "重置教师密码失败"); }
    finally { setSaving(false); }
  }

  async function deactivate(teacher: Teacher) {
    if (!window.confirm(`确认停用 ${teacher.displayName}？停用后无法登录，历史教学数据将保留。`)) return;
    setSaving(true); setMessage("");
    try {
      await responseBody(await fetch(`/api/v1/admin/teachers/${teacher.id}/disable`, { method: "POST" }));
      setRows((current) => current.map((row) => row.id === teacher.id ? { ...row, enabled: false } : row));
    } catch (error) { setMessage(error instanceof Error ? error.message : "停用教师账号失败"); }
    finally { setSaving(false); }
  }

  return <div className="space-y-5">
    <Card><CardHeader><CardTitle>创建教师账号</CardTitle><CardDescription>用户名创建后不可修改；系统会生成符合教师密码规则的一次性临时密码。</CardDescription></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={create}><Field label="用户名"><input aria-label="用户名" value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass} autoComplete="off" required /></Field><Field label="教师真实姓名"><input aria-label="教师真实姓名" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={inputClass} autoComplete="name" required /></Field><div className="flex items-end"><Button type="submit" disabled={saving}>{saving ? "正在创建…" : "创建教师"}</Button></div></form></CardContent></Card>
    {credential ? <Card variant="danger"><CardHeader><CardTitle>{credential.action === "created" ? "教师账号已创建" : "教师密码已重置"}</CardTitle><CardDescription>请立即安全转交此临时密码。关闭本提示后无法再次查看明文密码。</CardDescription></CardHeader><CardContent><div className="rounded-xl border border-rose-200/20 bg-black/20 p-4"><p className="text-sm text-[var(--muted-foreground)]">用户名</p><p className="font-mono font-bold">{credential.username}</p><p className="mt-3 text-sm text-[var(--muted-foreground)]">一次性临时密码</p><p className="select-all break-all font-mono text-lg font-extrabold">{credential.temporaryPassword}</p></div><div className="mt-4 flex justify-end"><Button type="button" variant="outline" onClick={() => setCredential(null)}>我已安全记录</Button></div></CardContent></Card> : null}
    {message ? <p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{message}</p> : null}
    <Card><CardContent className="overflow-auto"><table className="responsive-data-table min-w-[760px] w-full text-left text-sm"><thead><tr>{["用户名", "真实姓名", "状态", "首次改密", "创建时间", "操作"].map((label) => <th key={label} className="px-3 py-3 text-xs">{label}</th>)}</tr></thead><tbody>{rows.map((teacher) => <tr key={teacher.id} className="border-t border-[var(--border)]"><Cell label="用户名"><span className="font-mono">{teacher.username}</span></Cell><Cell label="真实姓名">{teacher.displayName}</Cell><Cell label="状态">{teacher.enabled ? "启用" : "已停用"}</Cell><Cell label="首次改密">{teacher.mustChangePassword ? "需要" : "已完成"}</Cell><Cell label="创建时间">{new Date(teacher.createdAt).toLocaleDateString("zh-CN")}</Cell><Cell label="操作" actions><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => reset(teacher)} disabled={saving}>重置密码</Button>{teacher.enabled ? <Button type="button" size="sm" variant="danger" onClick={() => deactivate(teacher)} disabled={saving}>停用</Button> : null}</div></Cell></tr>)}</tbody></table>{rows.length === 0 ? <p className="py-5 text-center text-sm text-[var(--muted-foreground)]">暂未创建教师账号。</p> : null}</CardContent></Card>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-sm font-extrabold">{label}</span>{children}</label>; }
function Cell({ label, actions = false, children }: { label: string; actions?: boolean; children: React.ReactNode }) { return <td data-label={label} data-actions={actions || undefined} className="px-3 py-3">{children}</td>; }
const inputClass = "h-11 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--border-strong)] focus:ring-2 focus:ring-cyan-400/15";
