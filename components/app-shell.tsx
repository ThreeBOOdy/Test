import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BarChart3, BookCopy, BookOpen, ChevronRight, FileSpreadsheet, GraduationCap, LayoutDashboard, LogOut, Settings2, Target, UsersRound } from "lucide-react";
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
  const label = role === "student" ? "学生空间" : "教师工作台";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-[var(--border)] bg-white px-5 py-6 lg:flex">
        <Logo />
        <div className="mt-8 rounded-2xl bg-[var(--secondary)] p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white text-[var(--primary)]"><GraduationCap className="size-5" /></div>
            <div><div className="text-xs text-[var(--muted-foreground)]">当前身份</div><div className="text-sm font-bold">{label}</div></div>
          </div>
        </div>
        <nav className="mt-7 flex flex-col gap-1.5">
          {nav.map((item) => <NavItem key={item.href} item={item} active={currentPath === item.href} />)}
        </nav>
        <Link href="/api/v1/auth/logout" className="mt-auto flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"><LogOut className="size-4" />退出登录</Link>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[color:rgba(247,248,244,.88)] px-4 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="lg:hidden"><Logo compact /></div>
          <div className="hidden text-sm text-[var(--muted-foreground)] lg:block">{label}</div>
          <div className="flex items-center gap-3"><div className="text-right"><div className="text-sm font-bold">{role === "student" ? "林小知" : "陈老师"}</div><div className="text-xs text-[var(--muted-foreground)]">{role === "student" ? "A级学习中" : "题库管理员"}</div></div><div className="grid size-10 place-items-center rounded-full bg-[var(--ink)] text-sm font-bold text-white">{role === "student" ? "林" : "陈"}</div></div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8 lg:px-10">{children}</main>
        <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-3 rounded-2xl border border-[var(--border)] bg-white/95 p-2 shadow-2xl backdrop-blur lg:hidden">
          {nav.slice(0, 3).map((item) => <MobileNavItem key={item.href} item={item} active={currentPath === item.href} />)}
        </nav>
      </div>
    </div>
  );
}

type Nav = { href: string; label: string; icon: LucideIcon };
function NavItem({ item, active }: { item: Nav; active: boolean }) {
  const Icon = item.icon;
  return <Link href={item.href as never} className={cn("group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition", active ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]")}><Icon className="size-4" /><span>{item.label}</span><ChevronRight className={cn("ml-auto size-4 opacity-0 transition group-hover:opacity-100", active && "opacity-60")} /></Link>;
}
function MobileNavItem({ item, active }: { item: Nav; active: boolean }) {
  const Icon = item.icon;
  return <Link href={item.href as never} className={cn("flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold", active ? "bg-[var(--secondary)] text-[var(--primary)]" : "text-[var(--muted-foreground)]")}><Icon className="size-4" />{item.label}</Link>;
}
