import { Suspense } from "react";
import Link from "next/link";
import { AuthConsole } from "@/components/auth-console";
import { LoginForm } from "@/components/login-form";
import { Artwork } from "@/components/visual/artwork";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  await searchParams;
  return <AuthConsole title="欢迎回到波段研习" description="登录后进入你的训练空间；新同学也可以在线提交注册申请。" callsign="AUTH / 10.140" visual={<Artwork src="/art/auth-telegraph-console-new-v2.webp" alt="现代电报键与无线电接收台" sizes="(max-width: 768px) 100vw, 43vw" preload variant="antenna" />}><Suspense><LoginForm /></Suspense><Link href={"/register" as never} className="mt-4 flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] text-sm font-bold transition hover:border-[var(--border-strong)] hover:bg-[var(--secondary)]">注册学生账号</Link></AuthConsole>;
}
