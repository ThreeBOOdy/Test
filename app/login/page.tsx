import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";
import { Artwork } from "@/components/visual/artwork";
import { getCurrentUser } from "@/lib/server/session";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "TEACHER" ? "/teacher" : "/student");
  return <main className="grid min-h-screen place-items-center px-4 py-8"><div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] md:grid-cols-[44%_56%]"><div className="relative min-h-52 md:min-h-[680px]"><Artwork src="/art/login-antenna-array.webp" alt="蓝调时刻的精密无线电天线阵列" sizes="(max-width: 768px) 100vw, 44vw" preload variant="antenna" /><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,11,18,.72),transparent_60%)]" /><div className="absolute bottom-6 left-6 right-6"><div className="text-xs font-bold tracking-[.2em] text-[var(--primary)]">SECURE SIGNAL ACCESS</div><div className="mt-2 max-w-sm text-sm leading-7 text-slate-300">进入个人训练频道或教师题库控制台，所有判题与权限在服务端完成。</div></div></div><div className="flex items-center p-7 sm:p-10 md:p-14"><div className="mx-auto w-full max-w-md"><Logo /><h1 className="mt-9 text-3xl font-black tracking-[-0.04em]">连接知练无线电</h1><p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">使用教师分配的账号进入对应频道。</p><Suspense><LoginForm /></Suspense></div></div></div></main>;
}
