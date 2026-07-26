"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeyRound, LogIn, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canUseNextPath, getDefaultPathForCapability } from "@/lib/domain/auth-routing";
import type { AccessCapability } from "@/lib/domain/student-access";

type LoginResult = { message?: string; user?: { role: "STUDENT" | "TEACHER" | "ADMIN"; mustChangePassword: boolean; capability: AccessCapability | null; }; };
function safeNext(value: string, role: "STUDENT" | "TEACHER" | "ADMIN") { return value.startsWith("/") && !value.startsWith("//") && canUseNextPath(value, role) ? value : null; }
async function browserSessionIsReady() { const response = await fetch("/api/v1/auth/session", { credentials: "include", cache: "no-store" }); return response.ok; }

export function LoginForm() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState(searchParams.get("error") === "role-mismatch" ? "当前浏览器登录的是另一种角色，请输入对应账号切换频道。" : searchParams.get("error") ?? "");
  const [pending, setPending] = useState(false);
  const next = searchParams.get("next") ?? "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const response = await fetch("/api/v1/auth/login", { method: "POST", credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, next }) });
      const data = await response.json() as LoginResult;
      if (!response.ok || !data.user) { setError(data.message ?? "登录失败"); return; }
      if (!await browserSessionIsReady()) { setError("浏览器未保存本站登录状态。请允许 localhost 使用 Cookie 后重试；页面不会自动跳转。"); return; }
      const fallback = data.user.capability ? getDefaultPathForCapability(data.user.capability) : "/change-password";
      const destination = data.user.mustChangePassword
        ? "/change-password"
        : data.user.capability === "REGISTRATION_ONLY"
          ? fallback
          : safeNext(next, data.user.role) ?? fallback;
      window.location.assign(destination);
    } catch { setError("登录失败：无法连接服务器，请确认服务正在运行后重试。"); }
    finally { setPending(false); }
  }

  return <form onSubmit={submit} className="mt-7 flex flex-col gap-4"><label><span className="mb-2 block text-sm font-extrabold">用户名</span><span className="flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/60 px-4 transition focus-within:border-cyan-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-100"><UserRound className="size-4 text-[var(--muted-foreground)]" /><input name="username" value={username} onChange={(event) => setUsername(event.target.value)} className="w-full bg-transparent outline-none" autoComplete="username" autoFocus required placeholder="请输入用户名" /></span></label><label><span className="mb-2 block text-sm font-extrabold">密码</span><span className="flex h-12 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/60 px-4 transition focus-within:border-cyan-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-100"><KeyRound className="size-4 text-[var(--muted-foreground)]" /><input name="password" type={passwordVisible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-transparent outline-none" autoComplete="current-password" minLength={8} required placeholder="请输入密码" /><button type="button" className="rounded-md p-1 text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? "切换为隐藏" : "切换为显示"} aria-pressed={passwordVisible}>{passwordVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>{error ? <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-700">{error}</div> : null}<Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}><LogIn className="size-4" />{pending ? "正在验证登录状态…" : "进入学习频道"}</Button><div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-3 text-xs leading-6 text-cyan-800"><span className="font-black">演示账号</span><br />学生：student / ChangeMe123!<br />教师：teacher / ChangeMe123!</div></form>;
}
