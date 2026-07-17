import Link from "next/link";
import { ArrowRight, BookOpenCheck, GraduationCap, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between"><Logo /><Badge tone="green">可运行 MVP</Badge></header>
        <section className="grid min-h-[calc(100vh-7rem)] items-center gap-12 py-14 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)]"><Sparkles className="size-4" />让每一次练习都有明确方向</div>
            <h1 className="max-w-3xl text-5xl font-black leading-[1.08] tracking-[-0.06em] sm:text-6xl">分等级、分知识点，<span className="text-[var(--primary)]">练到真正掌握。</span></h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-[var(--muted-foreground)] sm:text-lg">知练为学生提供随机刷题、即时判题和错题沉淀，为教师提供题库、知识目录、抽题规则与 Excel 导入的一体化工作台。</p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/student" className="inline-flex h-13 items-center gap-3 rounded-xl bg-[var(--primary)] px-6 font-bold text-white shadow-[0_12px_28px_rgba(17,94,89,.22)]">进入学生端<ArrowRight className="size-4" /></Link>
              <Link href="/teacher" className="inline-flex h-13 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-6 font-bold">进入教师端<ArrowRight className="size-4" /></Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-[var(--muted-foreground)]"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-[var(--primary)]" />服务端判题</span><span className="flex items-center gap-2"><Target className="size-4 text-[var(--primary)]" />双维度随机抽题</span><span className="flex items-center gap-2"><BookOpenCheck className="size-4 text-[var(--primary)]" />兼容现有 Excel</span></div>
          </div>
          <div className="relative">
            <div className="absolute -inset-10 rounded-full bg-emerald-100/60 blur-3xl" />
            <div className="relative grid gap-5 sm:grid-cols-2">
              <RoleCard href="/student" icon={GraduationCap} title="学生空间" description="按等级综合练习，或针对薄弱知识点专项突破。" stats={["即时反馈", "错题本", "学习记录"]} />
              <RoleCard href="/teacher" icon={ShieldCheck} title="教师工作台" description="配置题量、维护知识树、校验并导入题库。" stats={["随机规则", "题库库存", "Excel 预检"]} offset />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function RoleCard({ href, icon: Icon, title, description, stats, offset = false }: { href: string; icon: typeof GraduationCap; title: string; description: string; stats: string[]; offset?: boolean }) {
  return <Link href={href as never} className={offset ? "sm:mt-16" : ""}><Card className="group h-full transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(22,48,44,.14)]"><CardContent className="p-7"><div className="grid size-12 place-items-center rounded-2xl bg-[var(--secondary)] text-[var(--primary)]"><Icon className="size-6" /></div><h2 className="mt-6 text-2xl font-extrabold tracking-[-0.04em]">{title}</h2><p className="mt-3 min-h-20 text-sm leading-7 text-[var(--muted-foreground)]">{description}</p><div className="mt-5 flex flex-wrap gap-2">{stats.map((stat) => <Badge key={stat}>{stat}</Badge>)}</div><div className="mt-7 flex items-center gap-2 text-sm font-bold text-[var(--primary)]">打开演示<ArrowRight className="size-4 transition group-hover:translate-x-1" /></div></CardContent></Card></Link>;
}
