import Link from "next/link";
import { ChevronRight, GraduationCap } from "lucide-react";
import { Logo } from "@/components/logo";
import { LogoutButton } from "@/components/logout-button";
import { MobileNavigation } from "@/components/mobile-navigation";
import { administratorNavigation, studentNavigation, teacherNavigation } from "@/components/navigation-items";
import { CallsignLabel, FrequencyScale, SignalMeter, SpectrumWaterfall } from "@/components/visual/radio-instruments";
import { cn } from "@/lib/utils";

type ShellUser = { username: string; displayName: string; role?: "STUDENT" | "TEACHER" | "ADMIN" };
type ShellRole = "student" | "teacher" | "admin";

export async function AppShell({ role, currentPath, children }: { role: ShellRole; currentPath: string; children: React.ReactNode }) {
  const { getCurrentUser } = await import("@/lib/server/session");
  const user = await getCurrentUser();
  if (!user) return null;
  return <AppShellView role={role} currentPath={currentPath} user={{ username: user.username, displayName: user.displayName, role: user.role }}>{children}</AppShellView>;
}

export function AppShellView({ role, currentPath, user, children }: { role: ShellRole; currentPath: string; user: ShellUser; children: React.ReactNode }) {
  const accountRole = user.role ?? (role === "student" ? "STUDENT" : role === "teacher" ? "TEACHER" : "ADMIN");
  const nav = role === "student" ? studentNavigation : role === "teacher" ? teacherNavigation : administratorNavigation;
  const label = role === "student" ? "学生训练空间" : role === "teacher" ? "教师控制台" : "管理员控制台";
  const channelCode = role === "student" ? "CH-STU / 7.050" : role === "teacher" ? "CH-EDU / 14.270" : "CH-ADM / 21.320";
  const accountDescription = accountRole === "ADMIN" ? "管理员账号 · 学生账号管理权限" : accountRole === "TEACHER" ? "教师账号 · 教学管理权限" : "学生账号 · 训练数据已同步";
  const displayName = user.displayName.trim() || user.username;
  const avatar = Array.from(displayName)[0] ?? "知";

  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <aside className="fixed inset-y-0 left-0 hidden w-[18rem] flex-col overflow-hidden border-r border-[var(--border)] bg-[color:rgba(5,10,16,.96)] px-5 py-6 lg:flex"><SpectrumWaterfall className="opacity-30" /><div className="relative z-10"><Logo /><div className="receiver-panel instrument-grid mt-8 rounded-2xl p-4"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl border border-cyan-300/15 bg-cyan-300/8 text-[var(--primary)]"><GraduationCap className="size-5" /></div><div className="min-w-0"><div className="font-radio text-[9px] font-bold tracking-[.14em] text-[var(--muted-foreground)]">CURRENT CHANNEL</div><div className="mt-1 truncate text-sm font-bold">{label}</div></div></div><div className="mt-4 flex items-center justify-between"><CallsignLabel value={channelCode} /><SignalMeter value={5} label="频道已同步" /></div><FrequencyScale active={role === "student" ? 2 : role === "teacher" ? 4 : 6} className="mt-3" /></div></div><nav className="relative z-10 mt-6 flex flex-1 flex-col gap-1.5 overflow-y-auto">{nav.map((item, index) => { const Icon = item.icon; const active = currentPath === item.href; return <Link key={item.href} href={item.href as never} aria-label={item.label} className={cn("group relative flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-200", active ? "border-cyan-300/20 bg-cyan-300/10 text-[var(--primary)]" : "border-transparent text-[var(--muted-foreground)] hover:translate-x-0.5 hover:border-[var(--border)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]")}><span aria-hidden="true" className="font-radio w-5 text-[9px] text-[var(--muted-foreground)]">{String(index + 1).padStart(2, "0")}</span><Icon className="size-4" /><span>{item.label}</span><ChevronRight className={cn("ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100", active && "opacity-70")} /></Link>; })}</nav><div className="relative z-10"><div className="morse-divider mb-3"><span>••• —</span><span>STANDBY</span><span>— •••</span></div><LogoutButton /></div></aside>
    <div className="lg:pl-[18rem]"><header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-[var(--border)] bg-[color:rgba(5,9,15,.82)] px-4 py-2 backdrop-blur-2xl sm:px-8 lg:px-10"><div className="lg:hidden"><Logo compact /></div><div className="hidden items-center gap-4 lg:flex"><CallsignLabel value={channelCode} /><div><div className="font-radio text-[9px] font-bold tracking-[.15em] text-[var(--muted-foreground)]">ACTIVE DESK</div><div className="mt-0.5 text-sm font-bold">{label}</div></div></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><div className="text-sm font-bold">{displayName}</div><div className="text-xs text-[var(--muted-foreground)]">{accountDescription}</div><div className="mt-0.5 flex items-center justify-end gap-2 font-radio text-[9px] text-[var(--primary)]"><SignalMeter value={5} label="频道已同步" />频道已同步</div></div><div className="grid size-10 place-items-center rounded-full border border-cyan-300/25 bg-[linear-gradient(145deg,rgba(92,225,230,.18),rgba(92,225,230,.04))] font-radio text-sm font-bold text-[var(--primary)]">{avatar}</div></div></header><main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-8 sm:py-8 lg:px-10">{children}</main><MobileNavigation role={role} currentPath={currentPath} /></div>
  </div>;
}
