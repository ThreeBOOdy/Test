import Link from "next/link";
import { ArrowRight, BookOpenCheck, GraduationCap, ShieldCheck, Target } from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Artwork } from "@/components/visual/artwork";
import { SignalBackdrop } from "@/components/visual/signal-backdrop";
import { getEntryHrefForRole } from "@/lib/domain/auth-routing";
import { getCurrentUser } from "@/lib/server/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  const studentHref = getEntryHrefForRole("STUDENT", user?.role ?? null);
  const teacherHref = getEntryHrefForRole("TEACHER", user?.role ?? null);

  return <main className="relative min-h-screen overflow-hidden">
    <SignalBackdrop />
    <div className="relative mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between"><Logo /><Link href="/login" className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-sm font-bold hover:border-[var(--border-strong)]">账号登录</Link></header>
      <section className="grid min-h-[calc(100vh-7rem)] items-center gap-12 py-14 lg:grid-cols-[.92fr_1.08fr]">
        <div>
          <Badge tone="blue">无线电题库 · 专业训练系统</Badge>
          <h1 className="mt-6 max-w-2xl text-5xl font-black leading-[1.04] tracking-[-0.06em] sm:text-6xl">把复杂题库<br /><span className="text-[var(--primary)]">调谐成清晰训练</span></h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-[var(--muted-foreground)]">为学生提供成长概览、统一练习、学习记录与错题沉淀；为教师提供题库、知识目录、抽题规则与 Excel 导入控制台。</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href={studentHref as never} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[var(--primary)] px-6 font-bold text-[var(--primary-foreground)]">进入学生空间<ArrowRight className="size-4" /></Link><Link href={teacherHref as never} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-6 font-bold hover:border-[var(--border-strong)]">进入教师控制台<ArrowRight className="size-4" /></Link></div>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-[var(--muted-foreground)]"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-[var(--primary)]" />服务端判题</span><span className="flex items-center gap-2"><Target className="size-4 text-[var(--primary)]" />双维度抽题</span><span className="flex items-center gap-2"><BookOpenCheck className="size-4 text-[var(--primary)]" />兼容现有 Excel</span></div>
        </div>
        <div className="relative"><div className="relative aspect-[16/11] overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"><Artwork src="/art/home-orbital-network.webp" alt="环绕地球的无线电通信网络" sizes="(max-width: 1024px) 100vw, 52vw" preload variant="orbital" /><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,11,18,.65),transparent_55%)]" /><div className="absolute inset-x-5 bottom-5 grid gap-3 sm:grid-cols-2"><RoleCard href={studentHref} icon={GraduationCap} title="学生学习空间" text="成长概览 · 学习记录 · 错题巩固" /><RoleCard href={teacherHref} icon={ShieldCheck} title="教师题库控制台" text="抽题规则 · 库存校验 · Excel 预检" /></div></div></div>
      </section>
    </div>
  </main>;
}

function RoleCard({ href, icon: Icon, title, text }: { href: string; icon: typeof GraduationCap; title: string; text: string }) {
  return <Link href={href as never}><Card className="border-white/10 bg-[color:rgba(10,16,26,.82)] backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5"><CardContent className="flex items-center gap-3 p-4"><div className="grid size-10 place-items-center rounded-xl bg-cyan-300/10 text-[var(--primary)]"><Icon className="size-5" /></div><div><div className="text-sm font-extrabold">{title}</div><div className="mt-1 text-[11px] text-[var(--muted-foreground)]">{text}</div></div></CardContent></Card></Link>;
}
