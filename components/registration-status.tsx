"use client";

import { useMemo, useState } from "react";
import { deriveGenderFromNationalId, normalizeNationalId, validateMainlandNationalId } from "@/lib/domain/student-identity";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";

export type RegistrationStatusData = {
  username: string;
  realName: string;
  displayName: string;
  nationalIdMasked: string;
  gender: "MALE" | "FEMALE";
  school: string;
  grade: { id: string; name: string };
  phoneMasked: string;
  studentStatus: "PENDING" | "REJECTED";
  submittedAt: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
};

type GradeOption = { id: string; name: string };
type EditProfile = { username: string; displayName: string; nationalId: string; gender: "MALE" | "FEMALE"; school: string; gradeId: string; phone: string };

export function RegistrationStatus({ initialData, grades }: { initialData: RegistrationStatusData; grades: GradeOption[] }) {
  const [data, setData] = useState(initialData);
  const [form, setForm] = useState<EditProfile | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const derivedGender = useMemo(() => {
    if (!form) return data.gender;
    try {
      const normalized = normalizeNationalId(form.nationalId);
      validateMainlandNationalId(normalized);
      return deriveGenderFromNationalId(normalized);
    } catch {
      return form.gender;
    }
  }, [data.gender, form]);

  async function edit() {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/v1/registration?edit=true", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "加载资料失败"); return; }
      setForm(result as EditProfile);
    } catch { setMessage("加载资料失败，请稍后重试"); }
    finally { setPending(false); }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!form) return;
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/v1/registration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: form.displayName, nationalId: form.nationalId, school: form.school, gradeId: form.gradeId, phone: form.phone }),
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "保存失败"); return; }
      const grade = grades.find((item) => item.id === form.gradeId) ?? data.grade;
      setData({ ...data, realName: form.displayName.trim(), displayName: form.displayName.trim(), school: form.school.trim(), grade, gender: derivedGender ?? form.gender });
      setForm(null);
      setMessage(data.studentStatus === "PENDING" ? "资料已保存，当前仍在等待审核。" : "资料已保存，请确认后重新提交审核。");
    } catch { setMessage("保存失败，请稍后重试"); }
    finally { setPending(false); }
  }

  async function resubmit() {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/v1/registration/resubmit", { method: "POST" });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "重新提交失败"); return; }
      setMessage("已重新提交，请重新登录查看最新状态。");
    } catch { setMessage("重新提交失败，请稍后重试"); }
    finally { setPending(false); }
  }

  return <div className="mx-auto min-h-screen max-w-4xl px-4 py-8 sm:px-8">
    <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black tracking-[.18em] text-[var(--primary)]">REGISTRATION STATUS</div><h1 className="mt-2 text-3xl font-black">{data.studentStatus === "PENDING" ? "等待审核" : "审核未通过"}</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">账号资料会在管理员审核通过后生效。</p></div><LogoutButton /></div>
    {data.studentStatus === "REJECTED" ? <Card className="mt-6 border-rose-400/30"><CardContent><div className="font-extrabold text-rose-300">拒绝原因</div><p className="mt-2 text-sm leading-6">{data.rejectionReason}</p><p className="mt-3 text-xs text-[var(--muted-foreground)]">审核人：{data.reviewerName ?? "管理员"}{data.reviewedAt ? ` · ${new Date(data.reviewedAt).toLocaleString("zh-CN")}` : ""}</p></CardContent></Card> : null}
    <Card className="mt-6"><CardContent className="grid gap-4 sm:grid-cols-2"><Info label="人物用户名" value={data.username} /><Info label="真实姓名" value={data.realName} /><Info label="身份证号" value={data.nationalIdMasked} /><Info label="性别" value={data.gender === "MALE" ? "男" : "女"} /><Info label="学校" value={data.school} /><Info label="年级" value={data.grade.name} /><Info label="手机号" value={data.phoneMasked} /><Info label="提交时间" value={data.submittedAt ? new Date(data.submittedAt).toLocaleString("zh-CN") : "—"} /></CardContent></Card>
    <div className="mt-5 flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={edit} disabled={pending}>修改资料</Button>{data.studentStatus === "REJECTED" ? <Button type="button" onClick={resubmit} disabled={pending}>重新提交审核</Button> : null}</div>
    {message ? <div role="status" className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm font-semibold">{message}</div> : null}
    {form ? <Card className="mt-6"><CardContent><form onSubmit={save} className="grid gap-4 sm:grid-cols-2"><Info label="人物用户名（不可修改）" value={form.username} /><Field label="真实姓名"><input aria-label="真实姓名" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className={inputClass} required /></Field><Field label="身份证号"><input aria-label="身份证号" value={form.nationalId} onChange={(event) => setForm({ ...form, nationalId: event.target.value })} className={inputClass} required /></Field><Info label="性别" value={derivedGender === "MALE" ? "男" : "女"} /><Field label="学校"><input aria-label="学校" value={form.school} onChange={(event) => setForm({ ...form, school: event.target.value })} className={inputClass} required /></Field><Field label="年级"><select aria-label="年级" value={form.gradeId} onChange={(event) => setForm({ ...form, gradeId: event.target.value })} className={inputClass}>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></Field><Field label="手机号"><input aria-label="手机号" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={inputClass} required /></Field><div className="flex items-end gap-3"><Button type="submit" disabled={pending}>保存修改</Button><Button type="button" variant="ghost" onClick={() => setForm(null)}>取消</Button></div></form></CardContent></Card> : null}
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-xs font-bold text-[var(--muted-foreground)]">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-xs font-bold text-[var(--muted-foreground)]">{label}</span>{children}</label>; }
const inputClass = "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 outline-none focus:border-[var(--border-strong)]";
