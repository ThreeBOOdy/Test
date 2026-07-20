import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Bell, BookCopy, BookOpen, ChevronRight, FileSpreadsheet, GraduationCap, LayoutDashboard, LogOut, Radio, Settings2, SignalHigh, Target, UsersRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const studentNav = [
  { href: "/student", label: "学习首页", icon: LayoutDashboard },
  { href: "/student/history", label: "练习记录", icon: BarChart3 },
  { href: "/student/wrong", label: "我的错题", icon: BookCopy },
];
const teacherNav = [
  { href: "/teacher", label: "管理概览", icon: LayoutDashboard },
  { href: "/teacher/questions", label: "题库管理", icon: BookOpen },
  { href: "/teacher/knowledge", label: "知识点目录", icon: Target },
  { href: "/teacher/rules", label: "抽题规则", icon: Settings2 },
  { href: "/teacher/import", label: "Excel 导入", icon: FileSpreadsheet },
  { href: "/teacher/students", label: "学生管理", icon: UsersRound },
];

export function AppShell({ role, currentPath, children }: { role: "student" | "teacher"; currentPath: string; children: React.ReactNode }) {
  const nav = role === "student" ? studentNav : teacherNav;
  const label = role === "student" ? "学生学习舱" : "教师控制台";
  const name = role === "student" ? "林小知" : "陈老师";
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col overflow-hidden bg-[var(--ink)] px-5 py-6 text-white lg:flex">
        <div className="absolute inset-0 surface-grid opacity-[.08]" />
        <div className="absolute -left-28 top-28 size-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative"><Logo inverse /></div>
        <div className="glass-panel relative mt-8 rounded-[22px] p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-200/15"><GraduationCap className="size-5" /></div>
            <div className="min-w-0"><div className="text-[10px] font-bold tracking-[0.18em] text-cyan-100/50">CURRENT CHANNEL</div><div className="mt-1 truncate text-sm font-extrabold">{label}</div></div>
            <SignalHigh className="ml-auto size-4 text-cyan-300" />
          </div>
        </div>
        <nav className="relative mt-7 flex flex-col gap-1.5">
          <div className="mb-2 px-3 text-[10px] font-black tracking-[0.2em] text-slate-500">NAVIGATION</div>
          {nav.map((item) => <NavItem key={item.href} item={item} active={currentPath === item.href} />)}
        </nav>
        <div className="relative mt-auto">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[.035] px-3 py-2.5 text-xs text-slate-400"><span className="size-1.5 rounded-full bg-emerald-400 signal-glow" />题库服务运行正常</div>
          <form action="/api/v1/auth/logout" method="post"><button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-400 transition hover:bg-white/[.06] hover:text-white"><LogOut className="size-4" />退出登录</button></form>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-white/60 bg-[rgba(247,250,252,.82)] px-4 shadow-[0_1px_0_rgba(21,51,72,.03)] backdrop-blur-2xl sm:px-8 lg:px-10">
          <div className="lg:hidden"><Logo compact /></div>
          <div className="hidden items-center gap-3 lg:flex"><div className="grid size-9 place-items-center rounded-xl bg-white text-[var(--primary)] shadow-sm ring-1 ring-slate-200"><Radio className="size-4" /></div><div><div className="text-[10px] font-black tracking-[0.18em] text-[var(--muted-foreground)]">LIVE WORKSPACE</div><div className="text-sm font-extrabold">{label}</div></div></div>
          <div className="flex items-center gap-3"><button type="button" aria-label="通知" className="grid size-10 place-items-center rounded-full border border-[var(--border)] bg-white text-[var(--muted-foreground)] transition hover:border-cyan-300 hover:text-[var(--primary)]"><Bell className="size-4" /></button><div className="hidden text-right sm:block"><div className="text-sm font-extrabold">{name}</div><div className="text-xs text-[var(--muted-foreground)]">{role === "student" ? "A级 · 学习信号良好" : "题库管理员 · 在线"}</div></div><div className="grid size-10 place-items-center rounded-full bg-[linear-gradient(145deg,var(--ink),#163a52)] text-sm font-black text-white ring-4 ring-white">{name.slice(0, 1)}</div></div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-8 sm:py-8 lg:px-10">{children}</main>
        <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-3 rounded-[20px] border border-white/80 bg-white/90 p-2 shadow-[0_20px_60px_rgba(8,31,49,.22)] backdrop-blur-2xl lg:hidden">
          {nav.slice(0, 3).map((item) => <MobileNavItem key={item.href} item={item} active={currentPath === item.href} />)}
        </nav>
      </div>
    </div>
  );
}

type Nav = { href: string; label: string; icon: LucideIcon };
function NavItem({ item, active }: { item: Nav; active: boolean }) {
  const Icon = item.icon;
  return <Link href={item.href as never} className={cn("group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition", active ? "bg-[linear-gradient(135deg,rgba(16,178,189,.95),rgba(7,120,131,.95))] text-white shadow-[0_12px_28px_rgba(0,0,0,.18)]" : "text-slate-400 hover:bg-white/[.055] hover:text-white")}><Icon className="size-4" /><span>{item.label}</span><ChevronRight className={cn("ml-auto size-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100", active && "opacity-60")} /></Link>;
}
function MobileNavItem({ item, active }: { item: Nav; active: boolean }) {
  const Icon = item.icon;
  return <Link href={item.href as never} className={cn("flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold transition", active ? "bg-[var(--ink)] text-cyan-200" : "text-[var(--muted-foreground)]")}><Icon className="size-4" />{item.label}</Link>;
}
