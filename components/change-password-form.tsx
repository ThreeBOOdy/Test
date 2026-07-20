"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChangePasswordForm({ role }: { role: "STUDENT" | "TEACHER" }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (newPassword !== confirmation) {
      setMessage("两次输入的新密码不一致");
      return;
    }
    setPending(true);
    const response = await fetch("/api/v1/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
    const result = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(result.message ?? "修改密码失败");
      return;
    }
    router.replace(role === "TEACHER" ? "/teacher" : "/student");
    router.refresh();
  }

  return <form onSubmit={submit} className="mt-7 flex flex-col gap-4"><PasswordField label="当前密码" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" /><PasswordField label="新密码" value={newPassword} onChange={setNewPassword} autoComplete="new-password" /><PasswordField label="确认新密码" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />{message ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{message}</div> : null}<Button type="submit" size="lg" disabled={pending}><ShieldCheck className="size-4" />{pending ? "保存中…" : "保存新密码"}</Button><div className="rounded-xl bg-[var(--muted)] p-3 text-xs leading-6 text-[var(--muted-foreground)]">密码至少 8 位。建议同时包含大小写字母、数字和符号，不要与其他网站共用。</div></form>;
}

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string }) { return <label><span className="mb-2 block text-sm font-bold">{label}</span><span className="flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4"><KeyRound className="size-4 text-[var(--muted-foreground)]" /><input type="password" value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent outline-none" minLength={8} maxLength={128} autoComplete={autoComplete} /></span></label>; }