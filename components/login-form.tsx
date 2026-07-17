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

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    const response = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json(); setPending(false);
    if (!response.ok) { setError(data.message ?? "登录失败"); return; }
    const requested = searchParams.get("next");
    const fallback = data.user.role === "TEACHER" ? "/teacher" : "/student";
    router.replace((requested?.startsWith("/") ? requested : fallback) as never);
    router.refresh();
  }

  return <form onSubmit={submit} className="mt-7 flex flex-col gap-4"><label><span className="mb-2 block text-sm font-bold">用户名</span><span className="flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4"><UserRound className="size-4 text-[var(--muted-foreground)]" /><input value={username} onChange={(event) => setUsername(event.target.value)} className="w-full bg-transparent outline-none" autoComplete="username" /></span></label><label><span className="mb-2 block text-sm font-bold">密码</span><span className="flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-4"><KeyRound className="size-4 text-[var(--muted-foreground)]" /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-transparent outline-none" autoComplete="current-password" /></span></label>{error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}<Button type="submit" size="lg" disabled={pending}><LogIn className="size-4" />{pending ? "登录中…" : "登录"}</Button><div className="rounded-xl bg-[var(--muted)] p-3 text-xs leading-6 text-[var(--muted-foreground)]">学生：student / ChangeMe123!<br />教师：teacher / ChangeMe123!</div></form>;
}
