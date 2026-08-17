import Link from "next/link";
import { ArrowRight, BookOpenCheck, Brain, GraduationCap, Orbit, RadioTower, ShieldCheck, Target, Waves } from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Artwork } from "@/components/visual/artwork";
import { BearingCompass, CallsignLabel, FrequencyScale, MorseDivider, SignalMeter } from "@/components/visual/radio-instruments";
import { Reveal } from "@/components/visual/reveal";
import { SignalField } from "@/components/visual/signal-field";
import { TiltCard } from "@/components/visual/tilt-card";
import { getEntryHrefForRole } from "@/lib/domain/auth-routing";
import { getCurrentUser } from "@/lib/server/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  const studentHref = getEntryHrefForRole("STUDENT", user?.role ?? null);
  const teacherHref = getEntryHrefForRole("TEACHER", user?.role ?? null);

  return <main className="relative min-h-screen overflow-hidden bg-[var(--background-deep)]">
    {/* Three.js 信号粒子场: 波面 + 天线环 + 鼠标涟漪 */}
    <SignalField intensity="hero" className="absolute inset-0" />
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,transparent_30%,rgba(2,5,8,.72)_100%)]" />

    <div className="relative mx-auto max-w-[1480px] px-5 sm:px-8 lg:px-10">
      <header className="glass-bar rise rise-1 sticky top-4 z-40 flex items-center justify-between rounded-2xl border border-[var(--border)] px-5 py-3 shadow-[0_18px_60px_rgba(0,0,0,.35)]">
        <Logo />
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-xs text-[var(--muted-foreground)] md:flex"><SignalMeter value={5} label="公共频道在线" />公共频道在线</div>
          <Link href="/login" className="glow-btn inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] px-4 text-sm font-bold transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--secondary)]">账号登录</Link>
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-7rem)] items-center gap-12 py-14 lg:grid-cols-[.92fr_1.08fr] lg:py-20">
        <div>
          <div className="rise rise-2 flex flex-wrap items-center gap-3"><CallsignLabel value="CQ CQ / BD-01" /><Badge tone="amber">现代无线电训练实验室</Badge></div>
          <h1 className="rise rise-3 mt-8 max-w-3xl text-5xl font-black leading-[1.02] tracking-[-0.05em] sm:text-6xl xl:text-[4.6rem]">
            把知识噪声<br /><span className="hero-gradient-text">调谐为清晰信号</span>
          </h1>
          <p className="rise rise-4 mt-8 max-w-xl text-base leading-8 text-[var(--muted-foreground)]">波段研习将等级题库、知识点、模拟考试和错题信号收束到一套专业训练频道，让每一次作答都能被记录、复盘和再次定位。</p>
          <div className="rise rise-5 mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href={studentHref as never} className="glow-btn inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-cyan-100/20 bg-[var(--primary)] px-7 font-bold text-[var(--primary-foreground)] shadow-[0_16px_44px_rgba(92,225,230,.22)] transition hover:-translate-y-0.5 hover:bg-[var(--primary-strong)] hover:shadow-[0_22px_54px_rgba(92,225,230,.3)]">进入学生频道<ArrowRight className="size-4" /></Link>
            <Link href={teacherHref as never} className="glow-btn inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] px-7 font-bold transition hover:-translate-y-0.5 hover:border-[var(--border-strong)]">进入教师控制台<ArrowRight className="size-4" /></Link>
          </div>
          <div className="rise rise-6 mt-11 grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)]">
            <Feature icon={ShieldCheck} label="服务端判题" code="SEC-01" />
            <Feature icon={Target} label="双维度抽题" code="DF-02" />
            <Feature icon={BookOpenCheck} label="Excel 兼容" code="DB-03" />
          </div>
          <MorseDivider text="LEARN · LOCATE · MASTER" className="rise rise-6 mt-9 max-w-xl" />
        </div>

        <div className="rise rise-3 relative lg:pl-4">
          <TiltCard max={4.5} className="relative">
            <div className="receiver-panel float-y relative aspect-[16/11] overflow-hidden rounded-[2rem]">
              <Artwork src="/art/home-signal-laboratory-new.webp" alt="现代地下无线电实验室与环形天线阵列" sizes="(max-width: 1024px) 100vw, 55vw" preload variant="orbital" />
              <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(3,8,13,.92),transparent_62%),linear-gradient(90deg,rgba(3,8,13,.35),transparent_40%)]" />
              <div className="absolute left-5 top-5 flex items-center gap-3"><CallsignLabel value="RX / 145.800 MHz" /><SignalMeter value={4} label="接收信号" /></div>
              <div className="absolute right-6 top-6 hidden sm:block"><BearingCompass bearing={64} /></div>
              <div className="absolute inset-x-5 bottom-5 grid gap-3 sm:grid-cols-2">
                <RoleCard href={studentHref} icon={GraduationCap} title="学生学习空间" text="成长概览 · 学习记录 · 错题巩固" />
                <RoleCard href={teacherHref} icon={ShieldCheck} title="教师题库控制台" text="抽题规则 · 库存校验 · Excel 预检" />
              </div>
              <FrequencyScale active={5} className="absolute inset-x-8 bottom-[7.8rem] hidden sm:flex" />
            </div>
          </TiltCard>
        </div>
      </section>

      {/* 训练频道特性带 */}
      <section className="relative pb-24 pt-6">
        <Reveal from="up" className="mx-auto max-w-2xl text-center">
          <div className="eyebrow-radio">TRAINING CHANNELS</div>
          <h2 className="page-title mt-4">四条常开频道，覆盖训练全链路</h2>
          <p className="page-subtitle mx-auto">从抽题、作答到复盘，每一段信号都有明确的频率与归属。</p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Reveal from="up" delay={0}><ChannelCard icon={RadioTower} code="CH-01 / 7.050" title="等级题库频道" text="按等级与知识点双维度组织题库，库存实时校验，抽题即所得。" /></Reveal>
          <Reveal from="up" delay={90}><ChannelCard icon={Waves} code="CH-02 / 14.270" title="模拟考试频道" text="仿真考试节奏与判题流程，成绩、用时、错题一次落盘。" /></Reveal>
          <Reveal from="up" delay={180}><ChannelCard icon={Brain} code="CH-03 / 21.320" title="错题回环频道" text="错题自动捕获为可重练信号，按遗忘节奏回推到训练台。" /></Reveal>
          <Reveal from="up" delay={270}><ChannelCard icon={Orbit} code="CH-04 / 28.400" title="数据观测频道" text="教师端统计与报表持续在线，班级掌握度一眼可见。" /></Reveal>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-8">
        <Reveal from="up" className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Logo compact />
          <div className="font-radio text-[10px] tracking-[.2em] text-[var(--muted-foreground)]">波段研习 · RADIO EXAM TRAINING LAB · 73</div>
        </Reveal>
      </footer>
    </div>
  </main>;
}

function Feature({ icon: Icon, label, code }: { icon: typeof ShieldCheck; label: string; code: string }) {
  return <div className="bg-[var(--surface-glass)] p-4 backdrop-blur-sm transition-colors duration-200 hover:bg-[var(--surface-elevated)]"><Icon className="size-4 text-[var(--primary)]" /><div className="mt-3 text-sm font-bold">{label}</div><div className="font-radio mt-1 text-[9px] tracking-[.12em] text-[var(--muted-foreground)]">{code}</div></div>;
}

function RoleCard({ href, icon: Icon, title, text }: { href: string; icon: typeof GraduationCap; title: string; text: string }) {
  return <Link href={href as never}><Card variant="receiver" className="bg-[color:rgba(7,14,22,.82)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-[var(--border-strong)]"><CardContent className="flex items-center gap-3 p-4"><div className="grid size-10 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-[var(--primary)]"><Icon className="size-5" /></div><div className="min-w-0"><div className="text-sm font-extrabold">{title}</div><div className="mt-1 truncate text-[11px] text-[var(--muted-foreground)]">{text}</div></div><ArrowRight className="ml-auto size-4 text-[var(--muted-foreground)]" /></CardContent></Card></Link>;
}

function ChannelCard({ icon: Icon, code, title, text }: { icon: typeof RadioTower; code: string; title: string; text: string }) {
  return (
    <div className="radio-card group relative h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-glass)] p-6 backdrop-blur-sm">
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[radial-gradient(circle,rgba(92,225,230,.14),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="flex items-center justify-between">
        <div className="grid size-11 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/8 text-[var(--primary)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"><Icon className="size-5" /></div>
        <span className="font-radio text-[9px] font-bold tracking-[.16em] text-[var(--muted-foreground)]">{code}</span>
      </div>
      <h3 className="mt-5 text-lg font-extrabold tracking-[-0.02em]">{title}</h3>
      <p className="mt-2.5 text-sm leading-7 text-[var(--muted-foreground)]">{text}</p>
      <div className="mt-5 h-px w-full bg-[linear-gradient(90deg,var(--border-strong),transparent)] opacity-40 transition-opacity duration-300 group-hover:opacity-100" />
    </div>
  );
}
