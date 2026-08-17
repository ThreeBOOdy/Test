"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const subscribeToHydration = () => () => {};
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

export function ChangePasswordForm({ role }: { role: "STUDENT" | "TEACHER" | "ADMIN" }) {
  const router = useRouter();
  const ready = useSyncExternalStore(subscribeToHydration, getHydratedSnapshot, getServerSnapshot);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setMessage(""); if (newPassword !== confirmation) { setMessage("两次输入的新密码不一致"); return; } setPending(true); try { const response = await fetch("/api/v1/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) }); const result = await response.json(); if (!response.ok) { setMessage(result.message ?? "修改密码失败"); return; } router.replace((role === "ADMIN" ? "/admin" : role === "TEACHER" ? "/teacher" : "/student") as never); router.refresh(); } catch { setMessage("连接失败，请稍后重试"); } finally { setPending(false); } }
  const minimumLength = role === "STUDENT" ? 8 : 12;
  return <form onSubmit={submit} className="mt-7 flex flex-col gap-4"><PasswordField label="当前密码" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" disabled={!ready || pending} minimumLength={1} /><PasswordField label={`新密码（至少 ${minimumLength} 位）`} value={newPassword} onChange={setNewPassword} autoComplete="new-password" disabled={!ready || pending} minimumLength={minimumLength} /><PasswordField label="确认新密码" value={confirmation} onChange={setConfirmation} autoComplete="new-password" disabled={!ready || pending} minimumLength={minimumLength} />{message ? <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">{message}</div> : null}<Button type="submit" size="lg" disabled={!ready || pending} className="w-full"><ShieldCheck className="size-4" /><span className="min-w-24">{pending ? "保存中…" : "保存新密码"}</span></Button><div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-xs leading-6 text-[var(--muted-foreground)]">{role === "STUDENT" ? "学生密码至少 8 位" : "教师和管理员密码至少 12 位"}，不限制字母、数字或符号组合。请避免与其他网站共用。</div></form>;
}

function PasswordField({ label, value, onChange, autoComplete, disabled, minimumLength }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string; disabled: boolean; minimumLength: number }) { return <label><span className="mb-2 block text-sm font-bold">{label}</span><span className="flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 transition-colors focus-within:border-[var(--border-strong)] focus-within:ring-2 focus-within:ring-[var(--ring)]/20"><KeyRound className="size-4 text-[var(--muted-foreground)]" /><input type="password" value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent outline-none disabled:cursor-wait" minLength={minimumLength} maxLength={128} autoComplete={autoComplete} disabled={disabled} /></span></label>; }
