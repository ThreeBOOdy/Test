"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Row = {
  id: string;
  username: string;
  displayName: string;
  realName: string;
  gender: string | null;
  school: string | null;
  grade: { name: string } | null;
  nationalIdMasked: string | null;
  phoneMasked: string | null;
  registrationSource: string | null;
  studentStatus: string | null;
  enabled: boolean;
  validFrom: string | null;
  validUntil: string | null;
  isLongTerm: boolean;
};

type Grade = { id: string; name: string };
type EditForm = {
  displayName: string;
  nationalId: string;
  school: string;
  gradeId: string;
  phone: string;
  enabled: boolean;
  validFrom: string;
  validUntil: string;
  isLongTerm: boolean;
};

export function StudentManager({ students }: { students: Row[] }) {
  const [rows, setRows] = useState(students);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => rows.filter((row) => `${row.username} ${row.realName} ${row.school ?? ""}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);

  async function edit(row: Row) {
    setMessage("");
    const [detailResponse, gradesResponse] = await Promise.all([
      fetch(`/api/v1/admin/students/${row.id}`, { cache: "no-store" }),
      fetch("/api/v1/grades/public", { cache: "no-store" }),
    ]);
    const detail = await detailResponse.json();
    const gradeResult = await gradesResponse.json();
    if (!detailResponse.ok) { setMessage(detail.message ?? "读取学生详情失败"); return; }
    if (!gradesResponse.ok) { setMessage(gradeResult.message ?? "读取年级失败"); return; }
    setGrades(gradeResult.grades ?? []);
    setEditing(row);
    setForm({
      displayName: detail.displayName ?? "",
      nationalId: detail.nationalId ?? "",
      school: detail.school ?? "",
      gradeId: detail.gradeId ?? "",
      phone: detail.phone ?? "",
      enabled: detail.enabled ?? true,
      validFrom: detail.validFrom ?? "",
      validUntil: detail.validUntil ?? "",
      isLongTerm: detail.isLongTerm ?? false,
    });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = form.isLongTerm
        ? { displayName: form.displayName, nationalId: form.nationalId, school: form.school, gradeId: form.gradeId, phone: form.phone, enabled: form.enabled, isLongTerm: true }
        : { ...form, isLongTerm: false };
      const response = await fetch(`/api/v1/admin/students/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "保存学生账号失败"); return; }
      const grade = grades.find((item) => item.id === form.gradeId) ?? null;
      setRows((current) => current.map((item) => item.id === editing.id ? {
        ...item,
        realName: form.displayName,
        displayName: form.displayName,
        school: form.school,
        grade: grade ? { name: grade.name } : null,
        nationalIdMasked: maskNationalId(form.nationalId),
        phoneMasked: maskPhone(form.phone),
        enabled: form.enabled,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        isLongTerm: form.isLongTerm,
      } : item));
      setEditing(null);
      setForm(null);
      setMessage("学生账号已保存");
    } finally {
      setSaving(false);
    }
  }

  async function reset(row: Row) {
    const response = await fetch(`/api/v1/admin/students/${row.id}/reset-password`, { method: "POST" });
    const result = await response.json();
    setMessage(response.ok ? `临时密码：${result.temporaryPassword}` : result.message);
  }

  const update = <K extends keyof EditForm>(key: K, value: EditForm[K]) => setForm((current) => current ? { ...current, [key]: value } : current);

  return <>
    <div className="flex flex-wrap gap-3"><input aria-label="搜索学生" value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} placeholder="用户名、姓名或学校" /></div>
    {message ? <div className="mt-4 rounded-xl bg-[var(--surface-soft)] p-3 text-sm">{message}</div> : null}
    {editing && form ? <Card className="mt-5"><CardContent><form onSubmit={save}>
      <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-extrabold">编辑学生账号</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">人物用户名（不可修改）：{editing.username}</p></div><Button type="button" variant="outline" onClick={() => { setEditing(null); setForm(null); }}>取消</Button></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="真实姓名"><input aria-label="真实姓名" value={form.displayName} onChange={(event) => update("displayName", event.target.value)} className={inputClass} required /></Field>
        <Field label="身份证号"><input aria-label="身份证号" value={form.nationalId} onChange={(event) => update("nationalId", event.target.value)} className={inputClass} required /></Field>
        <Field label="手机号"><input aria-label="手机号" value={form.phone} onChange={(event) => update("phone", event.target.value)} className={inputClass} required /></Field>
        <Field label="学校"><input aria-label="学校" value={form.school} onChange={(event) => update("school", event.target.value)} className={inputClass} required /></Field>
        <Field label="年级"><select aria-label="年级" value={form.gradeId} onChange={(event) => update("gradeId", event.target.value)} className={inputClass} required><option value="">请选择年级</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></Field>
        <Toggle label="账号启用" checked={form.enabled} onChange={(checked) => update("enabled", checked)} />
        <Field label="有效期开始"><input aria-label="有效期开始" type="date" value={form.validFrom} onChange={(event) => update("validFrom", event.target.value)} className={inputClass} disabled={form.isLongTerm} required={!form.isLongTerm} /></Field>
        <Field label="有效期结束"><input aria-label="有效期结束" type="date" value={form.validUntil} onChange={(event) => update("validUntil", event.target.value)} className={inputClass} disabled={form.isLongTerm} required={!form.isLongTerm} /></Field>
        <Toggle label="长期账号" checked={form.isLongTerm} onChange={(checked) => update("isLongTerm", checked)} />
      </div>
      <div className="mt-5 flex justify-end"><Button type="submit" disabled={saving}>{saving ? "正在保存…" : "保存账号"}</Button></div>
    </form></CardContent></Card> : null}
    <Card className="mt-5"><CardContent className="overflow-auto"><table className="responsive-data-table min-w-[1150px] w-full text-left text-sm"><thead><tr>{["人物用户名", "真实姓名", "性别", "学校/年级", "身份证", "手机号", "来源", "状态", "有效期", "操作"].map((item) => <th key={item} className="px-3 py-3 text-xs">{item}</th>)}</tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-t border-[var(--border)]"><StudentCell label="人物用户名">{row.username}</StudentCell><StudentCell label="真实姓名">{row.realName}</StudentCell><StudentCell label="性别">{row.gender === "MALE" ? "男" : row.gender === "FEMALE" ? "女" : "—"}</StudentCell><StudentCell label="学校/年级">{row.school} · {row.grade?.name}</StudentCell><StudentCell label="身份证">{row.nationalIdMasked}</StudentCell><StudentCell label="手机号">{row.phoneMasked}</StudentCell><StudentCell label="来源">{row.registrationSource}</StudentCell><StudentCell label="状态">{row.enabled ? row.studentStatus : "已停用"}</StudentCell><StudentCell label="有效期">{row.isLongTerm ? "长期" : `${row.validFrom ?? "—"} 至 ${row.validUntil ?? "—"}`}</StudentCell><StudentCell label="操作" actions><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => edit(row)}>编辑</Button><Button size="sm" variant="outline" onClick={() => reset(row)}>重置密码</Button></div></StudentCell></tr>)}</tbody></table></CardContent></Card>
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-sm font-extrabold">{label}</span>{children}</label>; }
function StudentCell({ label, actions = false, children }: { label: string; actions?: boolean; children: React.ReactNode }) { return <td data-label={label} data-actions={actions || undefined} className="px-3 py-3">{children}</td>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="mt-auto flex h-11 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3"><input aria-label={label} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="font-semibold">{label}</span></label>; }
function maskNationalId(value: string) { return value.length >= 4 ? `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : value; }
function maskPhone(value: string) { return value.length === 11 ? `${value.slice(0, 3)}****${value.slice(-4)}` : value; }
const inputClass = "h-11 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--border-strong)] focus:ring-2 focus:ring-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-50";
