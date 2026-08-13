"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Row = {
  id: string;
  username: string;
  realName: string;
  school: string | null;
  grade: { name: string } | null;
  nationalIdMasked: string | null;
  phoneMasked: string | null;
  registrationSource: string | null;
  studentStatus: string | null;
  enabled: boolean;
  activationRequired: boolean;
  validFrom: string | null;
  validUntil: string | null;
  isLongTerm: boolean;
};

type StudentPage = { items: Row[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
type Grade = { id: string; name: string };
type Detail = { displayName: string; school: string | null; gradeId: string | null; enabled: boolean; validFrom: string | null; validUntil: string | null; isLongTerm: boolean; nationalIdMasked: string | null; phoneMasked: string | null };
type EditForm = { displayName: string; nationalId: string; school: string; gradeId: string; phone: string; enabled: boolean; validFrom: string; validUntil: string; isLongTerm: boolean };
type RevealedSensitiveValue = { value: string; expiresAt: number };
const SENSITIVE_VALUE_WINDOW_MS = 5 * 60 * 1000;

export function StudentManager({ initial }: { initial: StudentPage }) {
  const [result, setResult] = useState(initial);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pageSize, setPageSize] = useState(initial.pagination.pageSize);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sensitiveValues, setSensitiveValues] = useState<Record<string, RevealedSensitiveValue>>({});

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setSensitiveValues((current) => Object.fromEntries(Object.entries(current).filter(([, entry]) => entry.expiresAt > now)));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadStudents(page = 1, nextSearch = search, nextStatus = status, nextPageSize = pageSize) {
    setLoading(true);
    setMessage("");
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(nextPageSize) });
      if (nextSearch.trim()) query.set("search", nextSearch.trim());
      if (nextStatus) query.set("status", nextStatus);
      const response = await fetch(`/api/v1/admin/students?${query.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message ?? "读取学生账号失败"); return false; }
      setResult(data);
      setPageSize(data.pagination.pageSize);
      setSensitiveValues({});
      return true;
    } catch {
      setMessage("读取学生账号失败，请稍后重试");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function edit(row: Row) {
    setMessage("");
    try {
      const [detailResponse, gradesResponse] = await Promise.all([
        fetch(`/api/v1/admin/students/${row.id}`, { cache: "no-store" }),
        fetch("/api/v1/grades/public", { cache: "no-store" }),
      ]);
      const detail = await detailResponse.json() as Detail & { message?: string };
      const gradeResult = await gradesResponse.json();
      if (!detailResponse.ok) { setMessage(detail.message ?? "读取学生详情失败"); return; }
      if (!gradesResponse.ok) { setMessage(gradeResult.message ?? "读取年级失败"); return; }
      setGrades(gradeResult.grades ?? []);
      setEditing(row);
      setForm({ displayName: detail.displayName ?? "", nationalId: "", school: detail.school ?? "", gradeId: detail.gradeId ?? "", phone: "", enabled: detail.enabled ?? true, validFrom: detail.validFrom ?? "", validUntil: detail.validUntil ?? "", isLongTerm: detail.isLongTerm ?? false });
    } catch {
      setMessage("读取学生详情失败，请稍后重试");
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    setMessage("");
    try {
      const sensitive = { ...(form.nationalId ? { nationalId: form.nationalId } : {}), ...(form.phone ? { phone: form.phone } : {}) };
      const payload = form.isLongTerm
        ? { displayName: form.displayName, school: form.school, gradeId: form.gradeId, enabled: form.enabled, isLongTerm: true, ...sensitive }
        : { ...form, ...sensitive, ...(form.nationalId ? {} : { nationalId: undefined }), ...(form.phone ? {} : { phone: undefined }), isLongTerm: false };
      const response = await fetch(`/api/v1/admin/students/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message ?? "保存学生账号失败"); return; }
      setEditing(null);
      setForm(null);
      if (await loadStudents(result.pagination.page)) setMessage("学生账号已保存");
    } catch {
      setMessage("保存学生账号失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function reveal(row: Row, field: "nationalId" | "phone") {
    const password = window.prompt("请输入管理员密码以查看原文（验证有效期 5 分钟）");
    if (!password) return;
    setMessage("");
    try {
      const reverify = await fetch(`/api/v1/admin/students/${row.id}/sensitive-data`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const reverifyData = await reverify.json();
      if (!reverify.ok) { setMessage(reverifyData.message ?? "重新验证失败"); return; }
      const response = await fetch(`/api/v1/admin/students/${row.id}/sensitive-data?field=${field}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setMessage(data.message ?? "读取敏感资料失败"); return; }
      setSensitiveValues((current) => ({ ...current, [`${row.id}:${field}`]: { value: data.value, expiresAt: Date.now() + SENSITIVE_VALUE_WINDOW_MS } }));
    } catch {
      setMessage("读取敏感资料失败，请稍后重试");
    }
  }

  async function reset(row: Row) {
    setMessage("");
    try {
      const response = await fetch(`/api/v1/admin/students/${row.id}/reset-password`, { method: "POST" });
      const data = await response.json();
      setMessage(response.ok ? (data.activationRequired ? `新的初始密码：${data.initialPassword}；新的激活码：${data.activationCode}；有效至 ${new Date(data.expiresAt).toLocaleDateString("zh-CN")}` : `临时密码：${data.temporaryPassword}`) : data.message ?? "重置密码失败");
    } catch {
      setMessage("重置密码失败，请稍后重试");
    }
  }

  const update = <K extends keyof EditForm>(key: K, value: EditForm[K]) => setForm((current) => current ? { ...current, [key]: value } : current);
  return <>
    <Card><CardContent className="pt-6"><div className="grid gap-3 md:grid-cols-4"><input aria-label="搜索学生" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="姓名、人物用户名、学校或手机号后四位" className={inputClass} /><select aria-label="学生状态筛选" value={status} onChange={(event) => { const nextStatus = event.target.value; setStatus(nextStatus); void loadStudents(1, search, nextStatus, pageSize); }} className={inputClass}><option value="">全部状态</option><option value="PENDING">待审核</option><option value="ACTIVE">正常</option><option value="REJECTED">已拒绝</option></select><select aria-label="每页显示条数" value={pageSize} onChange={(event) => { const nextPageSize = Number(event.target.value); setPageSize(nextPageSize); void loadStudents(1, search, status, nextPageSize); }} className={inputClass}><option value={20}>每页 20 条</option><option value={50}>每页 50 条</option><option value={100}>每页 100 条</option></select><Button onClick={() => void loadStudents(1)} disabled={loading}>{loading ? "正在搜索…" : "搜索"}</Button></div>{message ? <p role="status" className="mt-4 text-sm text-[var(--muted-foreground)]">{message}</p> : null}</CardContent></Card>
    {editing && form ? <Card className="mt-5"><CardContent className="pt-6"><form onSubmit={save}><h2 className="mb-2 text-lg font-bold">编辑学生账号</h2><p className="mb-2 text-sm text-[var(--muted-foreground)]">人物用户名（永久不可修改）：{editing.username}</p><p className="mb-5 text-sm text-[var(--muted-foreground)]">敏感字段默认不回显；留空即保持当前值，填写后将直接加密保存。</p><div className="grid gap-4 md:grid-cols-2"><Field label="真实姓名"><input aria-label="真实姓名" value={form.displayName} onChange={(event) => update("displayName", event.target.value)} className={inputClass} required /></Field><Field label="身份证号（可选更新）"><input aria-label="身份证号" value={form.nationalId} onChange={(event) => update("nationalId", event.target.value)} className={inputClass} /></Field><Field label="手机号（可选更新）"><input aria-label="手机号" value={form.phone} onChange={(event) => update("phone", event.target.value)} className={inputClass} /></Field><Field label="学校"><input aria-label="学校" value={form.school} onChange={(event) => update("school", event.target.value)} className={inputClass} required /></Field><Field label="年级"><select aria-label="年级" value={form.gradeId} onChange={(event) => update("gradeId", event.target.value)} className={inputClass} required><option value="">请选择年级</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></Field><Toggle label="账号启用" checked={form.enabled} onChange={(checked) => update("enabled", checked)} /><Field label="有效期开始"><input aria-label="有效期开始" type="date" value={form.validFrom} onChange={(event) => update("validFrom", event.target.value)} className={inputClass} disabled={form.isLongTerm} required={!form.isLongTerm} /></Field><Field label="有效期结束"><input aria-label="有效期结束" type="date" value={form.validUntil} onChange={(event) => update("validUntil", event.target.value)} className={inputClass} disabled={form.isLongTerm} required={!form.isLongTerm} /></Field><Toggle label="长期账号" checked={form.isLongTerm} onChange={(checked) => update("isLongTerm", checked)} /></div><div className="mt-5 flex justify-end"><Button type="submit" disabled={saving}>{saving ? "正在保存…" : "保存账号"}</Button></div></form></CardContent></Card> : null}
    <Card className="mt-5"><CardContent className="overflow-auto"><table className="responsive-data-table min-w-[1200px] w-full text-left text-sm"><thead><tr>{["学生姓名", "人物用户名", "来源", "账号状态", "激活状态", "有效期", "身份证", "手机号", "操作"].map((item) => <th key={item} className="px-3 py-3 text-xs">{item}</th>)}</tr></thead><tbody>{result.items.map((row) => <tr key={row.id} className="border-t border-[var(--border)]"><StudentCell label="学生姓名">{row.realName}</StudentCell><StudentCell label="人物用户名">{row.username}</StudentCell><StudentCell label="来源">{row.registrationSource ?? "—"}</StudentCell><StudentCell label="账号状态">{row.enabled ? studentStatusLabel(row.studentStatus) : `已停用（${studentStatusLabel(row.studentStatus)}）`}</StudentCell><StudentCell label="激活状态">{row.activationRequired ? "待激活" : "已激活"}</StudentCell><StudentCell label="有效期">{row.isLongTerm ? "长期" : `${row.validFrom ?? "—"} 至 ${row.validUntil ?? "—"}`}</StudentCell><StudentCell label="身份证"><SensitiveValue value={sensitiveValues[`${row.id}:nationalId`]?.value} masked={row.nationalIdMasked} onReveal={() => void reveal(row, "nationalId")} /></StudentCell><StudentCell label="手机号"><SensitiveValue value={sensitiveValues[`${row.id}:phone`]?.value} masked={row.phoneMasked} onReveal={() => void reveal(row, "phone")} /></StudentCell><StudentCell label="操作" actions><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void edit(row)}>编辑</Button><Button size="sm" variant="outline" onClick={() => void reset(row)}>{row.activationRequired ? "重置激活凭据" : "重置密码"}</Button></div></StudentCell></tr>)}</tbody></table>{!result.items.length ? <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">没有符合条件的学生账号。</p> : null}<div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-sm"><span>共 {result.pagination.total} 条，第 {result.pagination.page}/{result.pagination.totalPages} 页</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={loading || result.pagination.page <= 1} onClick={() => void loadStudents(result.pagination.page - 1)}>上一页</Button><Button size="sm" variant="outline" disabled={loading || result.pagination.page >= result.pagination.totalPages} onClick={() => void loadStudents(result.pagination.page + 1)}>下一页</Button></div></div></CardContent></Card>
  </>;
}

function SensitiveValue({ value, masked, onReveal }: { value?: string; masked: string | null; onReveal: () => void }) { return <div className="flex items-center gap-2"><span>{value ?? masked ?? "—"}</span>{!value ? <Button size="sm" variant="outline" onClick={onReveal}>查看原文</Button> : null}</div>; }
function studentStatusLabel(status: string | null) { return status === "PENDING" ? "待审核" : status === "ACTIVE" ? "正常" : status === "REJECTED" ? "已拒绝" : "—"; }
function StudentCell({ label, actions = false, children }: { label: string; actions?: boolean; children: React.ReactNode }) { return <td data-label={label} className={`px-3 py-3 ${actions ? "min-w-40" : ""}`}>{children}</td>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-3 pt-7 text-sm font-bold"><input type="checkbox" aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }
const inputClass = "h-12 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 outline-none focus:border-[var(--border-strong)]";
