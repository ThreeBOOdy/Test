import Link from "next/link";
import { ArrowRight, BookOpenCheck, Brain, GraduationCap, Orbit, RadioTower, ShieldCheck, Target, Waves } from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Artwork } from "@/components/visual/artwork";
import { CountUp } from "@/components/visual/count-up";
import { CursorGlow } from "@/components/visual/cursor-glow";
import { Magnetic } from "@/components/visual/magnetic";
import { LogoParticles } from "@/components/visual/logo-particles";
import { BearingCompass, CallsignLabel, FrequencyScale, MorseDivider, SignalMeter } from "@/components/visual/radio-instruments";
import { Reveal } from "@/components/visual/reveal";
import { ScrambleText } from "@/components/visual/scramble-text";
import { SignalField } from "@/components/visual/signal-field";
import { TiltCard } from "@/components/visual/tilt-card";
import { getEntryHrefForRole } from "@/lib/domain/auth-routing";
import { getCurrentUser } from "@/lib/server/session";

const MARQUEE_ITEMS: { text: string; strong?: boolean }[] = [
  { text: "CQ CQ CQ", strong: true },
  { text: "波段研习" },
  { text: "RADIO EXAM TRAINING LAB" },
  { text: "LEARN · LOCATE · MASTER", strong: true },
  { text: "SIGNAL OVER NOISE" },
  { text: "73", strong: true },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const studentHref = getEntryHrefForRole("STUDENT", user?.role ?? null);
  const teacherHref = getEntryHrefForRole("TEACHER", user?.role ?? null);

  return <main className="relative min-h-screen overflow-hidden bg-[var(--background-deep)]">
    {/* Three.js 信号粒子场: 波面 + 天线环 + 鼠标涟漪 */}
    <SignalField intensity="hero" className="absolute inset-0" />
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,transparent_35%,rgba(238,240,234,.55)_100%)]" />
    {/* 奖项级氛围层: 纸面纹理 + 跟随光标 + 滚动进度 */}
    <div className="noise-overlay" aria-hidden="true" />
    <CursorGlow progress />

    <div className="relative mx-auto max-w-[1480px] px-5 sm:px-8 lg:px-10">
      <header className="glass-bar rise rise-1 sticky top-4 z-40 flex items-center justify-between rounded-2xl border border-[var(--border)] px-5 py-3 shadow-[0_14px_40px_rgba(21,33,43,.08)]">
        <Logo />
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-xs text-[var(--muted-foreground)] md:flex"><SignalMeter value={5} label="公共频道在线" />公共频道在线</div>
          <Link href="/login" className="glow-btn inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] px-4 text-sm font-bold transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--secondary)]">账号登录</Link>
        </div>
      </header>

      <section className="relative grid min-h-[calc(100vh-7rem)] items-center gap-12 py-14 lg:grid-cols-[.92fr_1.08fr] lg:py-20">
        {/* 竖排装饰: 奖站标志性的边缘排字 */}
        <div aria-hidden="true" className="vertical-text pointer-events-none absolute -right-1 top-1/2 hidden -translate-y-1/2 select-none font-radio text-[10px] font-bold uppercase text-[var(--muted-foreground)] opacity-60 xl:block">信号调谐中 · TUNING · BD-01</div>

        <div>
          <div className="rise rise-2 flex flex-wrap items-center gap-3"><CallsignLabel value="CQ CQ / BD-01" /><Badge tone="amber">无线电考证训练平台</Badge></div>
          <h1 className="mt-8 max-w-3xl text-5xl font-black leading-[1.02] tracking-[-0.05em] sm:text-6xl xl:text-[4.6rem]">
            <span className="line-mask"><span className="line-mask__inner lm-d1">把知识噪声</span></span>
            <span className="line-mask"><span className="line-mask__inner lm-d2"><ScrambleText text="调谐为清晰信号" className="hero-gradient-text" duration={1100} delay={620} /></span></span>
          </h1>
          <p className="rise rise-4 mt-8 max-w-xl text-base leading-8 text-[var(--muted-foreground)]">波段研习把等级题库、知识点、模拟考试和错题收拢进同一个训练空间，让每一次作答都被记录、复盘，并在需要时再次找到。</p>
          <div className="rise rise-5 mt-10 flex flex-col gap-3 sm:flex-row">
            <Magnetic><Link href={studentHref as never} className="glow-btn inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-cyan-200/40 bg-[var(--primary)] px-7 font-bold text-[var(--primary-foreground)] shadow-[0_16px_40px_rgba(10,134,152,.26)] transition hover:-translate-y-0.5 hover:bg-[var(--primary-strong)] hover:shadow-[0_22px_50px_rgba(10,134,152,.32)]">进入学生频道<ArrowRight className="size-4" /></Link></Magnetic>
            <Magnetic><Link href={teacherHref as never} className="glow-btn inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] px-7 font-bold transition hover:-translate-y-0.5 hover:border-[var(--border-strong)]">进入教师控制台<ArrowRight className="size-4" /></Link></Magnetic>
          </div>
          <div className="rise rise-6 mt-11 grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)]">
            <Feature icon={ShieldCheck} label="作答即时判分" code="INSTANT" />
            <Feature icon={Target} label="按需智能组卷" code="SMART" />
            <Feature icon={BookOpenCheck} label="题库持续更新" code="FRESH" />
          </div>
          <MorseDivider text="LEARN · LOCATE · MASTER" className="rise rise-6 mt-9 max-w-xl" />
        </div>

        {/* 深空媒体面板: 亮页面上的奖项式对比焦点 */}
        <div className="rise rise-3 relative lg:pl-4">
          <TiltCard max={4.5} className="relative">
            <div className="on-dark receiver-panel float-y relative aspect-[16/11] overflow-hidden rounded-[2rem] border-transparent bg-[#07121b]">
              <Artwork src="/art/home-signal-laboratory-new.webp" alt="信号实验室与频谱观测夜空" sizes="(max-width: 1024px) 100vw, 55vw" preload variant="orbital" />
              <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(3,8,13,.88),transparent_62%),linear-gradient(90deg,rgba(3,8,13,.3),transparent_40%)]" />
              <div className="absolute left-5 top-5 flex items-center gap-3"><CallsignLabel value="RX / 145.800 MHz" /><SignalMeter value={4} label="接收信号" /></div>
              <div className="absolute right-6 top-6 hidden sm:block"><BearingCompass bearing={64} /></div>
              <div className="absolute inset-x-5 bottom-5 grid gap-3 sm:grid-cols-2">
                <RoleCard href={studentHref} icon={GraduationCap} title="学生学习空间" text="成长概览 · 学习记录 · 错题巩固" />
                <RoleCard href={teacherHref} icon={ShieldCheck} title="教师题库控制台" text="题库管理 · 表格导入 · 练习规则" />
              </div>
              <FrequencyScale active={5} className="absolute inset-x-8 bottom-[7.8rem] hidden sm:flex" />
            </div>
          </TiltCard>
        </div>

        <div className="scroll-cue absolute bottom-5 left-1/2 hidden -translate-x-1/2 lg:flex" aria-hidden="true">
          <span className="font-radio text-[9px] font-bold tracking-[.34em] text-[var(--muted-foreground)]">SCROLL</span>
          <span className="scroll-cue__line" />
        </div>
      </section>
    </div>

    {/* 全宽跑马灯带: 奖项站标志性的节奏分隔 */}
    <div className="marquee-band relative" aria-hidden="true">
      <div className="marquee-band__track">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex" aria-hidden={copy === 1 ? "true" : undefined}>
            {MARQUEE_ITEMS.map((item) => (
              <span key={`${copy}-${item.text}`} className="marquee-band__item">
                <span className="marquee-band__dot" />
                {item.strong ? <b>{item.text}</b> : item.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>

    <div className="relative mx-auto max-w-[1480px] px-5 sm:px-8 lg:px-10">
      {/* 训练频道特性带 */}
      <section className="relative pb-20 pt-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(180deg,transparent,black_20%,black_68%,transparent)]">
          <Artwork src="/art/channels-ionosphere-banner-alt.webp" alt="电离层反射信号路径背景" sizes="100vw" variant="spectrum" className="opacity-[0.08]" />
        </div>
        <div aria-hidden="true" className="outline-num pointer-events-none absolute -top-2 right-0 hidden select-none text-[11rem] lg:block">04</div>
        <Reveal from="up" className="mx-auto max-w-2xl text-center">
          <div className="eyebrow-radio">TRAINING CHANNELS</div>
          <h2 className="page-title mt-4"><ScrambleText text="四条常开频道，覆盖训练全链路" duration={1000} /></h2>
          <p className="page-subtitle mx-auto">从练习、作答到复盘，每一段信号都有明确的频率与归属。</p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Reveal from="up" delay={0}><ChannelCard index="01" icon={RadioTower} code="CH-01 / 7.050" title="等级题库频道" text="按等级与知识点系统整理题目，练什么、怎么练一目了然。" /></Reveal>
          <Reveal from="up" delay={90}><ChannelCard index="02" icon={Waves} code="CH-02 / 14.270" title="模拟考试频道" text="还原真实考试节奏，交卷即出成绩、用时与错题。" /></Reveal>
          <Reveal from="up" delay={180}><ChannelCard index="03" icon={Brain} code="CH-03 / 21.320" title="错题回环频道" text="错题自动收集归拢，按遗忘节奏提醒你重练。" /></Reveal>
          <Reveal from="up" delay={270}><ChannelCard index="04" icon={Orbit} code="CH-04 / 28.400" title="数据观测频道" text="班级练习数据实时更新，整体掌握度一眼可见。" /></Reveal>
        </div>
      </section>

      <div className="scan-divider" aria-hidden="true" />

      {/* 信号数据带: 深空媒体面板 + 数字滚动计数 */}
      <section className="relative py-20">
        <Reveal from="up">
          <div className="on-dark receiver-panel relative overflow-hidden rounded-[2rem] border-transparent bg-[#07121b] px-6 py-10 sm:px-10">
            <Artwork src="/art/channels-ionosphere-banner.webp" alt="电离层天波反射与收发两端信号路径" sizes="(max-width: 1480px) 100vw, 1480px" variant="spectrum" className="opacity-45" />
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,9,15,.42),rgba(4,9,15,.78)_80%)]" />
            <div className="relative grid gap-10 text-center sm:grid-cols-2 xl:grid-cols-4">
              <StatBlock value={120} label="真实无线电人物图鉴" code="OPERATORS" />
              <StatBlock value={3} label="等级频段 · A / B / C" code="BANDS" />
              <StatBlock value={2} label="两种题型分类训练" code="CHANNELS" />
              <StatBlock value={100} suffix="%" label="作答即时判分计时" code="INSTANT" />
            </div>
          </div>
        </Reveal>
      </section>

      {/* 品牌粒子墙: 粒子聚合 logo, 鼠标可拨动 (参考奖站/DSH 首页) */}
      <section className="relative pb-24 pt-4">
        <Reveal from="up" className="mx-auto mb-8 max-w-2xl text-center">
          <div className="eyebrow-radio">BRAND SIGNAL</div>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">海华信奥编程 · 移动鼠标，拨动汇聚成标志的粒子</p>
        </Reveal>
        <Reveal from="scale">
          <div className="receiver-panel relative overflow-hidden rounded-[2rem] px-4 py-8 sm:px-10 sm:py-10">
            <div aria-hidden="true" className="tech-grid pointer-events-none absolute inset-0 opacity-60" />
            <LogoParticles src="/brand/haihua-logo.png" label="海华信奥编程 品牌粒子标志" className="relative h-44 sm:h-56 lg:h-64" />
          </div>
        </Reveal>
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
  return <Link href={href as never}><Card variant="receiver" className="border-white/10 bg-[color:rgba(7,14,22,.78)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40"><CardContent className="flex items-center gap-3 p-4"><div className="grid size-10 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><Icon className="size-5" /></div><div className="min-w-0"><div className="text-sm font-extrabold text-white">{title}</div><div className="mt-1 truncate text-[11px] text-slate-400">{text}</div></div><ArrowRight className="ml-auto size-4 text-slate-400" /></CardContent></Card></Link>;
}

function ChannelCard({ index, icon: Icon, code, title, text }: { index: string; icon: typeof RadioTower; code: string; title: string; text: string }) {
  return (
    <div className="radio-card group relative h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-glass)] p-6 backdrop-blur-sm">
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[radial-gradient(circle,rgba(10,134,152,.12),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div aria-hidden="true" className="outline-num pointer-events-none absolute -bottom-5 -right-2 select-none text-7xl opacity-70">{index}</div>
      <div className="flex items-center justify-between">
        <div className="grid size-11 place-items-center rounded-xl border border-cyan-600/15 bg-cyan-500/8 text-[var(--primary)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"><Icon className="size-5" /></div>
        <ScrambleText text={code} className="font-radio text-[9px] font-bold tracking-[.16em] text-[var(--muted-foreground)]" duration={700} />
      </div>
      <h3 className="mt-5 text-lg font-extrabold tracking-[-0.02em]">{title}</h3>
      <p className="mt-2.5 text-sm leading-7 text-[var(--muted-foreground)]">{text}</p>
      <div className="mt-5 h-px w-full bg-[linear-gradient(90deg,var(--border-strong),transparent)] opacity-40 transition-opacity duration-300 group-hover:opacity-100" />
    </div>
  );
}

function StatBlock({ value, suffix, label, code }: { value: number; suffix?: string; label: string; code: string }) {
  return (
    <div className="group">
      <CountUp to={value} suffix={suffix} className="text-5xl font-black tracking-[-0.05em] text-cyan-300 drop-shadow-[0_0_22px_rgba(92,225,230,.3)]" />
      <div className="mt-3 text-sm font-bold text-white">{label}</div>
      <div className="font-radio mt-1.5 text-[9px] font-bold tracking-[.22em] text-white/50">{code}</div>
    </div>
  );
}
