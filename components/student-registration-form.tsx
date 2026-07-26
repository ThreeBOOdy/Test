"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deriveGenderFromNationalId, normalizeNationalId, validateMainlandNationalId } from "@/lib/domain/student-identity";
import { Button } from "@/components/ui/button";

type Grade = { id: string; name: string };
type FormState = { username: string; displayName: string; nationalId: string; school: string; gradeId: string; phone: string; password: string; confirmPassword: string; truthAndPrivacyAccepted: boolean };
const empty: FormState = { username: "", displayName: "", nationalId: "", school: "", gradeId: "", phone: "", password: "", confirmPassword: "", truthAndPrivacyAccepted: false };

export function StudentRegistrationForm() {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/v1/grades/public", { cache: "no-store" }).then((response) => response.json()).then((result) => setGrades(result.grades ?? [])).catch(() => setError("年级加载失败，请稍后重试")); }, []);
  const gender = useMemo(() => { try { const id = normalizeNationalId(form.nationalId); return validateMainlandNationalId(id) ? deriveGenderFromNationalId(id) : null; } catch { return null; } }, [form.nationalId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (form.password !== form.confirmPassword) { setError("两次输入的密码不一致"); return; }
    if (!form.truthAndPrivacyAccepted) { setError("请确认信息真实性与隐私条款"); return; }
    setPending(true);
    try {
      const response = await fetch("/api/v1/auth/register", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) { setError(result.message ?? "注册失败"); return; }
      router.replace("/registration/status" as never);
      router.refresh();
    } catch { setError("注册失败：无法连接服务器"); }
    finally { setPending(false); }
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  return <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-2">
    <Field label="用户名"><input aria-label="用户名" value={form.username} onChange={(event) => update("username", event.target.value)} className={inputClass} autoComplete="username" required /></Field>
    <Field label="姓名"><input aria-label="姓名" value={form.displayName} onChange={(event) => update("displayName", event.target.value)} className={inputClass} required /></Field>
    <Field label="身份证号"><input aria-label="身份证号" value={form.nationalId} onChange={(event) => update("nationalId", event.target.value)} className={inputClass} required /></Field>
    <Field label="性别"><div className={`${inputClass} flex items-center`}>{gender === "MALE" ? "男" : gender === "FEMALE" ? "女" : "填写身份证后自动识别"}</div></Field>
    <Field label="学校"><input aria-label="学校" value={form.school} onChange={(event) => update("school", event.target.value)} className={inputClass} required /></Field>
    <Field label="年级"><select aria-label="年级" value={form.gradeId} onChange={(event) => update("gradeId", event.target.value)} className={inputClass} required><option value="">请选择年级</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></Field>
    <Field label="手机号"><input aria-label="手机号" value={form.phone} onChange={(event) => update("phone", event.target.value)} className={inputClass} inputMode="tel" required /></Field>
    <div />
    <Field label="密码"><input aria-label="密码" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} className={inputClass} autoComplete="new-password" required /></Field>
    <Field label="确认密码"><input aria-label="确认密码" type="password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} className={inputClass} autoComplete="new-password" required /></Field>
    <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm"><input type="checkbox" checked={form.truthAndPrivacyAccepted} onChange={(event) => update("truthAndPrivacyAccepted", event.target.checked)} className="mt-1" /><span>我确认以上信息真实，并同意系统为账号审核与学习服务处理这些资料。</span></label>
    {error ? <div role="alert" className="sm:col-span-2 rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div> : null}
    <div className="sm:col-span-2"><Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "正在提交…" : "提交注册申请"}</Button></div>
  </form>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label>; }
const inputClass = "h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 outline-none focus:border-[var(--border-strong)]";
