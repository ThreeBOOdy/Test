import Link from "next/link";
import { ArrowRight, BookOpenCheck, GraduationCap, ShieldCheck, Target } from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Artwork } from "@/components/visual/artwork";
import { BearingCompass, CallsignLabel, FrequencyScale, MorseDivider, SignalMeter, SpectrumWaterfall } from "@/components/visual/radio-instruments";
import { SignalBackdrop } from "@/components/visual/signal-backdrop";
import { getEntryHrefForRole } from "@/lib/domain/auth-routing";
import { getCurrentUser } from "@/lib/server/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  const studentHref = getEntryHrefForRole("STUDENT", user?.role ?? null);
  const teacherHref = getEntryHrefForRole("TEACHER", user?.role ?? null);

  return <main className="relative min-h-screen overflow-hidden bg-[var(--background-deep)]">
    <SignalBackdrop />
    <SpectrumWaterfall className="opacity-20" />
    <div className="relative mx-auto max-w-[1480px] px-5 py-6 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between border-b border-[var(--border)] pb-5"><Logo /><div className="flex items-center gap-3"><div className="hidden items-center gap-2 text-xs text-[var(--muted-foreground)] sm:flex"><SignalMeter value={5} label="公共频道在线" />公共频道在线</div><Link href="/login" className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] px-4 text-sm font-bold transition hover:border-[var(--border-strong)] hover:bg-[var(--secondary)]">账号登录</Link></div></header>
      <section className="grid min-h-[calc(100vh-8rem)] items-center gap-10 py-10 lg:grid-cols-[.88fr_1.12fr] lg:py-14">
        <div>
          <div className="flex flex-wrap items-center gap-3"><CallsignLabel value="CQ CQ / BD-01" /><Badge tone="amber">现代无线电训练实验室</Badge></div>
          <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[.98] tracking-[-0.065em] sm:text-6xl xl:text-7xl">把知识噪声<br /><span className="text-[var(--primary)]">调谐为清晰信号</span></h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-[var(--muted-foreground)]">波段研习将等级题库、知识点、模拟考试和错题信号收束到一套专业训练频道，让每一次作答都能被记录、复盘和再次定位。</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href={studentHref as never} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-cyan-100/20 bg-[var(--primary)] px-6 font-bold text-[var(--primary-foreground)] shadow-[0_16px_40px_rgba(92,225,230,.16)] transition hover:-translate-y-0.5 hover:bg-[var(--primary-strong)]">进入学生频道<ArrowRight className="size-4" /></Link><Link href={teacherHref as never} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] px-6 font-bold transition hover:-translate-y-0.5 hover:border-[var(--border-strong)]">进入教师控制台<ArrowRight className="size-4" /></Link></div>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)]"><Feature icon={ShieldCheck} label="服务端判题" code="SEC-01" /><Feature icon={Target} label="双维度抽题" code="DF-02" /><Feature icon={BookOpenCheck} label="Excel 兼容" code="DB-03" /></div>
          <MorseDivider text="LEARN · LOCATE · MASTER" className="mt-8 max-w-xl" />
        </div>
        <div className="relative lg:pl-6"><div className="receiver-panel relative aspect-[16/11] overflow-hidden rounded-[2rem]"><Artwork src="/art/home-signal-laboratory-new.webp" alt="现代地下无线电实验室与环形天线阵列" sizes="(max-width: 1024px) 100vw, 55vw" preload variant="orbital" /><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(3,8,13,.92),transparent_62%),linear-gradient(90deg,rgba(3,8,13,.35),transparent_40%)]" /><div className="absolute left-5 top-5 flex items-center gap-3"><CallsignLabel value="RX / 145.800 MHz" /><SignalMeter value={4} label="接收信号" /></div><div className="absolute right-6 top-6 hidden sm:block"><BearingCompass bearing={64} /></div><div className="absolute inset-x-5 bottom-5 grid gap-3 sm:grid-cols-2"><RoleCard href={studentHref} icon={GraduationCap} title="学生学习空间" text="成长概览 · 学习记录 · 错题巩固" /><RoleCard href={teacherHref} icon={ShieldCheck} title="教师题库控制台" text="抽题规则 · 库存校验 · Excel 预检" /></div><FrequencyScale active={5} className="absolute inset-x-8 bottom-[7.8rem] hidden sm:flex" /></div></div>
      </section>
    </div>
  </main>;
}

function Feature({ icon: Icon, label, code }: { icon: typeof ShieldCheck; label: string; code: string }) { return <div className="bg-[var(--surface-glass)] p-4"><Icon className="size-4 text-[var(--primary)]" /><div className="mt-3 text-sm font-bold">{label}</div><div className="font-radio mt-1 text-[9px] tracking-[.12em] text-[var(--muted-foreground)]">{code}</div></div>; }

function RoleCard({ href, icon: Icon, title, text }: { href: string; icon: typeof GraduationCap; title: string; text: string }) {
  return <Link href={href as never}><Card variant="receiver" className="bg-[color:rgba(7,14,22,.82)] backdrop-blur-xl"><CardContent className="flex items-center gap-3 p-4"><div className="grid size-10 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-[var(--primary)]"><Icon className="size-5" /></div><div className="min-w-0"><div className="text-sm font-extrabold">{title}</div><div className="mt-1 truncate text-[11px] text-[var(--muted-foreground)]">{text}</div></div><ArrowRight className="ml-auto size-4 text-[var(--muted-foreground)]" /></CardContent></Card></Link>;
}
