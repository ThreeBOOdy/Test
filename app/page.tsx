import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, CheckCircle2, GraduationCap, Radio, ShieldCheck, SignalHigh, Target, Waves } from "lucide-react";
import { Logo } from "@/components/logo";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#061523] text-white">
      <div className="absolute inset-0 surface-grid opacity-[.08]" />
      <div className="relative mx-auto max-w-[1500px] px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between"><Logo inverse /><div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-xs font-bold text-cyan-100 backdrop-blur"><span className="size-1.5 rounded-full bg-emerald-400 signal-glow" />系统在线</div></header>
        <section className="grid min-h-[calc(100vh-6rem)] items-center gap-12 py-12 lg:grid-cols-[.92fr_1.08fr] lg:py-16">
          <div className="relative z-10 fade-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-200/[.06] px-3 py-1.5 text-xs font-black tracking-[0.13em] text-cyan-200"><Radio className="size-3.5" />AMATEUR RADIO EXAM SYSTEM</div>
            <h1 className="max-w-3xl text-5xl font-black leading-[1.05] tracking-[-0.065em] sm:text-6xl xl:text-7xl">把复杂考点，<br /><span className="bg-[linear-gradient(90deg,#5de1e5,#87f5dc,#ffc46d)] bg-clip-text text-transparent">调到清晰频道。</span></h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">专为无线电操作证备考设计。按等级、知识点与题型智能抽题，让学生看见进度，让教师掌控题库质量。</p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/student" className="group inline-flex h-13 items-center gap-3 rounded-xl bg-[linear-gradient(135deg,#18b8c2,#087b87)] px-6 font-extrabold text-white shadow-[0_18px_42px_rgba(0,185,198,.24)] transition hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(0,185,198,.34)]">进入学生学习舱<ArrowRight className="size-4 transition group-hover:translate-x-1" /></Link>
              <Link href="/teacher" className="group inline-flex h-13 items-center gap-3 rounded-xl border border-white/15 bg-white/[.07] px-6 font-extrabold backdrop-blur transition hover:-translate-y-1 hover:bg-white/[.12]">打开教师控制台<ArrowRight className="size-4 transition group-hover:translate-x-1" /></Link>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3 border-t border-white/10 pt-7"><Feature icon={Target} title="双维抽题" text="等级 × 知识点" /><Feature icon={ShieldCheck} title="服务端判题" text="答案安全隔离" /><Feature icon={BookOpenCheck} title="Excel 导入" text="兼容现有题库" /></div>
          </div>
          <div className="relative min-h-[560px] fade-up-delay lg:min-h-[690px]">
            <div className="absolute inset-0 overflow-hidden rounded-[36px] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,.42)]">
              <Image src="/visuals/radio-hero.png" alt="无线电操作台与频谱波形" fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,21,35,.72),transparent_44%),linear-gradient(0deg,rgba(6,21,35,.64),transparent_48%)]" />
            </div>
            <div className="glass-panel scan-line absolute left-5 top-7 w-[min(330px,80%)] rounded-[24px] p-5 sm:left-8 sm:top-10">
              <div className="flex items-center justify-between"><div className="text-[10px] font-black tracking-[0.2em] text-cyan-200/60">LIVE SPECTRUM</div><SignalHigh className="size-4 text-cyan-300" /></div>
              <div className="mt-5 flex h-20 items-end gap-1.5">{[32,56,41,74,46,88,54,96,66,42,78,51,68,36,58,80].map((height, index) => <span key={index} className="w-full rounded-full bg-[linear-gradient(180deg,#55f1e4,#1599a6)] opacity-90" style={{ height: `${height}%` }} />)}</div>
              <div className="mt-4 flex items-end justify-between"><div><div className="text-2xl font-black">144.000</div><div className="text-xs text-slate-400">MHz · 学习频道</div></div><div className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-300">信号优秀</div></div>
            </div>
            <div className="glass-panel absolute bottom-7 right-5 w-[min(350px,84%)] rounded-[24px] p-5 sm:bottom-10 sm:right-8">
              <div className="flex items-start gap-4"><div className="radio-waves grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-300/10 text-amber-300"><Waves className="relative z-10 size-6" /></div><div><div className="text-xs font-bold text-cyan-100/55">TODAY&apos;S MISSION</div><div className="mt-1 text-lg font-black">A级综合训练 · 60题</div><div className="mt-2 flex items-center gap-2 text-xs text-slate-300"><CheckCircle2 className="size-3.5 text-emerald-300" />题量与库存实时校验</div></div></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({ icon: Icon, title, text }: { icon: typeof GraduationCap; title: string; text: string }) {
  return <div><Icon className="size-4 text-cyan-300" /><div className="mt-3 text-sm font-extrabold">{title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{text}</div></div>;
}
