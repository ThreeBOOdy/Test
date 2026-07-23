"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, LogIn, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("student");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setPending(true); setError(""); try { const response = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }); const data = await response.json(); if (!response.ok) { setError(data.message ?? "登录失败"); return; } const requested = searchParams.get("next"); const fallback = data.user.role === "TEACHER" ? "/teacher" : "/student"; router.replace((data.user.mustChangePassword ? "/change-password" : requested?.startsWith("/") ? requested : fallback) as never); router.refresh(); } catch { setError("连接失败，请稍后重试"); } finally { setPending(false); } }
  return <form onSubmit={submit} className="mt-7 flex flex-col gap-4"><Field icon={UserRound} label="用户名"><input value={username} onChange={(event) => setUsername(event.target.value)} className="w-full bg-transparent outline-none" autoComplete="username" /></Field><Field icon={KeyRound} label="密码"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-transparent outline-none" autoComplete="current-password" /></Field>{error ? <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-200">{error}</div> : null}<Button type="submit" size="lg" disabled={pending} className="w-full"><LogIn className="size-4" /><span className="min-w-16">{pending ? "登录中…" : "登录"}</span></Button><details className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-xs leading-6 text-[var(--muted-foreground)]"><summary className="cursor-pointer font-bold text-[var(--foreground)]">演示账号</summary><div className="mt-2">学生：student / ChangeMe123!<br />教师：teacher / ChangeMe123!</div></details></form>;
}

function Field({ icon: Icon, label, children }: { icon: typeof UserRound; label: string; children: React.ReactNode }) { return <label><span className="mb-2 block text-sm font-bold">{label}</span><span className="flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 transition-colors focus-within:border-[var(--border-strong)] focus-within:ring-2 focus-within:ring-[var(--ring)]/20"><Icon className="size-4 text-[var(--muted-foreground)]" />{children}</span></label>; }
