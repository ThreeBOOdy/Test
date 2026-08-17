"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RadioPersonPicker } from "@/components/radio-person-picker";

type Person = { id: string; username: string; name: string; profile: string };

export function StudentActivationForm() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [initialPassword, setInitialPassword] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [radioPersonId, setRadioPersonId] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void fetch("/api/v1/radio-people", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error((await response.json()).message)))
      .then((result: { people: Person[] }) => setPeople(result.people))
      .catch(() => setMessage("无法读取可选人物身份，请稍后重试"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage("两次输入的新密码不一致");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/auth/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initialPassword, activationCode, newPassword, radioPersonId }) });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message ?? "学生激活失败");
        return;
      }
      router.replace("/student");
      router.refresh();
    } catch {
      setMessage("学生激活失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="mt-7 space-y-4">
    <p className="rounded-xl border border-cyan-300/20 bg-cyan-300/[.07] p-3 text-sm leading-6 text-cyan-100">请同时输入管理员提供的初始密码和激活码，设置新密码后选择人物身份。激活码只能使用一次。</p>
    <label className="block"><span className="mb-2 block text-sm font-extrabold">初始密码</span><input aria-label="初始密码" type="password" value={initialPassword} onChange={(event) => setInitialPassword(event.target.value)} className={inputClass} required autoComplete="current-password" /></label>
    <label className="block"><span className="mb-2 block text-sm font-extrabold">激活码</span><input aria-label="激活码" value={activationCode} onChange={(event) => setActivationCode(event.target.value)} className={inputClass} required autoComplete="one-time-code" /></label>
    <label className="block"><span className="mb-2 block text-sm font-extrabold">新密码</span><input aria-label="新密码" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} required minLength={8} autoComplete="new-password" /></label>
    <label className="block"><span className="mb-2 block text-sm font-extrabold">确认新密码</span><input aria-label="确认新密码" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} required minLength={8} autoComplete="new-password" /></label>
    <fieldset className="space-y-2"><legend className="mb-2 text-sm font-extrabold">选择无线电人物身份</legend><RadioPersonPicker people={people} value={radioPersonId} onChange={setRadioPersonId} /></fieldset>
    {message ? <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{message}</div> : null}
    <Button type="submit" className="w-full" disabled={pending}>{pending ? "正在激活…" : "完成激活"}</Button>
  </form>;
}

const inputClass = "h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]";
