import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { MobileNavigation } from "@/components/mobile-navigation";
import { administratorNavigation, studentNavigation, teacherNavigation } from "@/components/navigation-items";
import { cn } from "@/lib/utils";

type ShellUser = { username: string; displayName: string };
type ShellRole = "student" | "teacher" | "admin";

export async function AppShell({ role, currentPath, children }: { role: ShellRole; currentPath: string; children: React.ReactNode }) {
  const { getCurrentUser } = await import("@/lib/server/session");
  const user = await getCurrentUser();
  if (!user) return null;
  return <AppShellView role={role} currentPath={currentPath} user={{ username: user.username, displayName: user.displayName }}>{children}</AppShellView>;
}

export function AppShellView({ role, currentPath, user, children }: { role: ShellRole; currentPath: string; user: ShellUser; children: React.ReactNode }) {
  const nav = role === "student" ? studentNavigation : role === "teacher" ? teacherNavigation : administratorNavigation;
  const label = role === "student" ? "学生训练空间" : role === "teacher" ? "教师控制台" : "管理员控制台";
  const displayName = user.displayName.trim() || user.username;
  const avatar = Array.from(displayName)[0] ?? "知";

  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-[var(--border)] bg-[color:rgba(9,14,23,.96)] px-5 py-6 lg:flex"><Logo /><div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-cyan-300/10 text-[var(--primary)]"><GraduationCap className="size-5" /></div><div><div className="text-xs text-[var(--muted-foreground)]">当前频道</div><div className="text-sm font-bold">{label}</div></div></div></div><nav className="mt-7 flex flex-col gap-1.5">{nav.map((item) => { const Icon = item.icon; const active = currentPath === item.href; return <Link key={item.href} href={item.href as never} className={cn("group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors", active ? "bg-cyan-300/12 text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]")}><Icon className="size-4" /><span>{item.label}</span><ChevronRight className={cn("ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100", active && "opacity-60")} /></Link>; })}</nav><LogoutButton /></aside>
    <div className="lg:pl-64"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[color:rgba(7,11,18,.84)] px-4 backdrop-blur-xl sm:px-8 lg:px-10"><div className="lg:hidden"><Logo compact /></div><div className="hidden text-sm text-[var(--muted-foreground)] lg:block">{label}</div><div className="flex items-center gap-3"><div className="text-right"><div className="text-sm font-bold">{displayName}</div><div className="text-xs text-[var(--muted-foreground)]">{role === "student" ? "训练数据已同步" : role === "teacher" ? "题库管理权限" : "学生账号管理权限"}</div></div><div className="grid size-10 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-sm font-bold text-[var(--primary)]">{avatar}</div></div></header><main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8 lg:px-10">{children}</main><MobileNavigation role={role} currentPath={currentPath} /></div>
  </div>;
}
