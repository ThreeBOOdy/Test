import { Suspense } from "react";
import Link from "next/link";
import { PublicAuthShell } from "@/components/public-auth-shell";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  await searchParams;
  return <PublicAuthShell title="学员登录" description="登录后进入你的训练空间；新同学也可以在线提交注册申请。"><Suspense><LoginForm showDemoAccounts={process.env.NODE_ENV !== "production"} /></Suspense><Link href="/register" className="mt-6 block text-center text-sm text-[var(--muted-foreground)] transition hover:text-[var(--primary)]">还没有账号？<span className="font-bold text-[var(--primary)]">注册学生账号</span></Link></PublicAuthShell>;
}
