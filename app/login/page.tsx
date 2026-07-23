import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, Radio, ShieldCheck, SignalHigh } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/server/session";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "TEACHER" ? "/teacher" : "/student");
  return <main className="grid min-h-screen bg-[var(--ink)] lg:grid-cols-[1.08fr_.92fr]"><section className="relative hidden overflow-hidden lg:block"><Image src="/visuals/radio-hero.png" alt="无线电学习工作台" fill priority sizes="55vw" className="object-cover" /><div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,23,39,.25),rgba(7,23,39,.82)),linear-gradient(0deg,rgba(7,23,39,.78),transparent_58%)]" /><div className="absolute inset-0 surface-grid opacity-[.08]" /><div className="absolute left-10 top-9"><Logo inverse /></div><div className="glass-panel absolute bottom-10 left-10 right-10 max-w-xl rounded-[28px] p-7"><div className="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] text-cyan-200/60"><SignalHigh className="size-4 text-cyan-300" />SECURE LEARNING CHANNEL</div><h1 className="mt-4 text-3xl font-black tracking-[-0.045em] text-white">登录你的无线电学习频道</h1><p className="mt-3 text-sm leading-7 text-slate-300">分级练习、专项突破、错题复盘与教师题库管理，在同一个安全工作台完成。</p><div className="mt-6 grid grid-cols-3 gap-3"><LoginFeature icon={Radio} text="随机抽题" /><LoginFeature icon={ShieldCheck} text="安全判题" /><LoginFeature icon={CheckCircle2} text="进度同步" /></div></div></section><section className="surface-grid grid min-h-screen place-items-center bg-[#f5f8fa] px-5 py-10"><div className="w-full max-w-md fade-up"><div className="lg:hidden"><Logo /></div><div className="mt-8 rounded-[28px] border border-white bg-white/95 p-7 shadow-[0_28px_80px_rgba(7,31,48,.14)] backdrop-blur sm:p-9 lg:mt-0"><div className="text-[10px] font-black tracking-[0.2em] text-[var(--primary)]">ACCOUNT AUTHENTICATION</div><h2 className="mt-3 text-3xl font-black tracking-[-0.05em]">欢迎回来</h2><p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">使用教师分配的账号进入学习舱或管理控制台。</p><Suspense><LoginForm /></Suspense></div><p className="mt-5 text-center text-xs text-[var(--muted-foreground)]">波段研习 · 无线电考证智能题库</p></div></section></main>;
}

function LoginFeature({ icon: Icon, text }: { icon: typeof Radio; text: string }) { return <div className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-3 text-center text-xs font-bold text-slate-300"><Icon className="mx-auto mb-2 size-4 text-cyan-300" />{text}</div>; }
