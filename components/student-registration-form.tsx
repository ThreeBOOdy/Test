"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deriveGenderFromNationalId, normalizeNationalId, validateMainlandNationalId } from "@/lib/domain/student-identity";
import { Button } from "@/components/ui/button";
import { RadioPersonPicker } from "@/components/radio-person-picker";

type Grade = { id: string; name: string };
type RadioPerson = { id: string; username: string; name: string; profile: string };
type FormState = { realName: string; nationalId: string; school: string; gradeId: string; phone: string; password: string; confirmPassword: string; truthAndPrivacyAccepted: boolean; radioPersonId: string };
const empty: FormState = { realName: "", nationalId: "", school: "", gradeId: "", phone: "", password: "", confirmPassword: "", truthAndPrivacyAccepted: false, radioPersonId: "" };

export function StudentRegistrationForm() {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [people, setPeople] = useState<RadioPerson[]>([]);
  const [step, setStep] = useState<"profile" | "person">("profile");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/grades/public", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/v1/radio-people", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([gradeResult, peopleResult]) => {
      setGrades(gradeResult.grades ?? []);
      setPeople(peopleResult.people ?? []);
    }).catch(() => setError("注册所需资料加载失败，请稍后重试"));
  }, []);

  const gender = useMemo(() => {
    try {
      const nationalId = normalizeNationalId(form.nationalId);
      return validateMainlandNationalId(nationalId) ? deriveGenderFromNationalId(nationalId) : null;
    } catch {
      return null;
    }
  }, [form.nationalId]);
  const selectedPerson = people.find((person) => person.id === form.radioPersonId);

  function continueToPeople(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) return setError("两次输入的密码不一致");
    if (!form.truthAndPrivacyAccepted) return setError("请确认信息真实性与隐私条款");
    if (!form.realName.trim() || !form.nationalId.trim() || !form.school.trim() || !form.gradeId || !form.phone.trim()) return setError("请完整填写实名资料");
    setStep("person");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.radioPersonId) return setError("请选择人物身份");
    setPending(true);
    try {
      const response = await fetch("/api/v1/auth/register", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message ?? "注册失败");
        if (response.status === 409 && result.message?.includes("人物身份")) {
          setForm((current) => ({ ...current, radioPersonId: "" }));
          const refreshed = await fetch("/api/v1/radio-people", { cache: "no-store" }).then((item) => item.json());
          setPeople(refreshed.people ?? []);
        }
        return;
      }
      router.replace("/registration/status" as never);
      router.refresh();
    } catch {
      setError("注册失败：无法连接服务器");
    } finally {
      setPending(false);
    }
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  if (step === "profile") return <form onSubmit={continueToPeople} className="mt-7 grid gap-4 sm:grid-cols-2">
    <div className="sm:col-span-2"><Field label="真实姓名" hint="仅用于实名审核，不作为登录用户名"><input aria-label="真实姓名" value={form.realName} onChange={(event) => update("realName", event.target.value)} className={inputClass} autoComplete="name" required /></Field></div>
    <Field label="身份证号"><input aria-label="身份证号" value={form.nationalId} onChange={(event) => update("nationalId", event.target.value)} className={inputClass} required /></Field>
    <Field label="性别"><div className={`${inputClass} flex items-center`}>{gender === "MALE" ? "男" : gender === "FEMALE" ? "女" : "填写身份证后自动识别"}</div></Field>
    <Field label="学校"><input aria-label="学校" value={form.school} onChange={(event) => update("school", event.target.value)} className={inputClass} required /></Field>
    <Field label="年级"><select aria-label="年级" value={form.gradeId} onChange={(event) => update("gradeId", event.target.value)} className={inputClass} required><option value="">请选择年级</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></Field>
    <div className="sm:col-span-2"><Field label="手机号"><input aria-label="手机号" value={form.phone} onChange={(event) => update("phone", event.target.value)} className={inputClass} inputMode="tel" required /></Field></div>
    <Field label="密码" hint="至少 8 位，不限制字符组合"><input aria-label="密码" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} className={inputClass} autoComplete="new-password" minLength={8} maxLength={128} required /></Field>
    <Field label="确认密码"><input aria-label="确认密码" type="password" value={form.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} className={inputClass} autoComplete="new-password" minLength={8} maxLength={128} required /></Field>
    <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-sm"><input type="checkbox" checked={form.truthAndPrivacyAccepted} onChange={(event) => update("truthAndPrivacyAccepted", event.target.checked)} className="mt-1" /><span>我确认以上信息真实，并同意系统为账号审核与学习服务处理这些资料。</span></label>
    {error ? <div role="alert" className="sm:col-span-2 rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div> : null}
    <div className="sm:col-span-2"><Button type="submit" size="lg" className="w-full">下一步：选择人物身份</Button></div>
  </form>;

  return <form onSubmit={submit} className="mt-7 space-y-5">
    <div><h2 className="text-xl font-extrabold">选择无线电人物身份</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">确认后将成为你的独立登录用户名，审核结果、停用或到期均不会释放或变更该身份。</p></div>
    <RadioPersonPicker people={people} value={form.radioPersonId} onChange={(personId) => update("radioPersonId", personId)} />
    {selectedPerson ? <div className="rounded-xl border border-[var(--primary)] bg-[var(--surface-soft)] p-4 text-sm">已选择：<strong>{selectedPerson.name}</strong>，登录用户名为 <strong>{selectedPerson.username}</strong>。确认提交后不可更换。</div> : null}
    {error ? <div role="alert" className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div> : null}
    <div className="flex gap-3"><Button type="button" variant="outline" onClick={() => setStep("profile")} disabled={pending}>返回修改实名资料</Button><Button type="submit" size="lg" className="flex-1" disabled={pending || !people.length}>{pending ? "正在确认…" : "确认人物并提交申请"}</Button></div>
  </form>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label><span className="mb-2 flex items-baseline justify-between gap-3"><span className="text-sm font-bold">{label}</span>{hint ? <span className="text-[11px] text-[var(--muted-foreground)]">{hint}</span> : null}</span>{children}</label>; }
const inputClass = "h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 outline-none focus:border-[var(--border-strong)]";
