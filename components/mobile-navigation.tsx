"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BarChart3, BookCopy, BookOpen, FileSpreadsheet, LayoutDashboard, Menu, Settings2, Target, UsersRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

export const studentNavigation: NavItem[] = [
  { href: "/student", label: "学习首页", icon: LayoutDashboard },
  { href: "/student/history", label: "练习记录", icon: BarChart3 },
  { href: "/student/wrong", label: "我的错题", icon: BookCopy },
];

export const teacherNavigation: NavItem[] = [
  { href: "/teacher", label: "管理概览", icon: LayoutDashboard },
  { href: "/teacher/questions", label: "题库管理", icon: BookOpen },
  { href: "/teacher/knowledge", label: "知识点目录", icon: Target },
  { href: "/teacher/rules", label: "抽题规则", icon: Settings2 },
  { href: "/teacher/import", label: "Excel 导入", icon: FileSpreadsheet },
  { href: "/teacher/students", label: "学生管理", icon: UsersRound },
];

export function MobileNavigation({ role, currentPath }: { role: "student" | "teacher"; currentPath: string }) {
  const [open, setOpen] = useState(false);
  const items = role === "student" ? studentNavigation : [teacherNavigation[0], teacherNavigation[1], teacherNavigation[5]];

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <>
    <nav className={cn("fixed inset-x-3 bottom-3 z-40 grid rounded-2xl border border-[var(--border)] bg-[color:rgba(13,20,32,.96)] p-2 shadow-2xl backdrop-blur-xl lg:hidden", role === "student" ? "grid-cols-3" : "grid-cols-4")} style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }} aria-label="移动端主导航">
      {items.map((item) => <MobileNavLink key={item.href} item={item} active={currentPath === item.href} onClick={() => setOpen(false)} />)}
      {role === "teacher" ? <button type="button" aria-label="打开更多导航" aria-expanded={open} aria-controls="mobile-nav-sheet" onClick={() => setOpen(true)} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"><Menu className="size-4" />更多</button> : null}
    </nav>
    {role === "teacher" && open ? <div className="fixed inset-0 z-50 lg:hidden"><button type="button" aria-label="关闭更多导航" className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setOpen(false)} /><section id="mobile-nav-sheet" role="dialog" aria-modal="true" aria-label="教师功能导航" className="absolute inset-x-3 bottom-3 rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-2xl" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}><div className="mb-3 flex items-center justify-between"><div><div className="text-sm font-extrabold">教师功能导航</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">所有管理入口均可在手机访问</div></div><button type="button" aria-label="关闭导航面板" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--muted-foreground)]"><X className="size-4" /></button></div><div className="grid grid-cols-2 gap-2">{teacherNavigation.map((item) => <MobileNavLink key={item.href} item={item} active={currentPath === item.href} onClick={() => setOpen(false)} expanded />)}</div></section></div> : null}
  </>;
}

function MobileNavLink({ item, active, onClick, expanded = false }: { item: NavItem; active: boolean; onClick: () => void; expanded?: boolean }) {
  const Icon = item.icon;
  return <Link href={item.href as never} aria-label={item.label} onClick={onClick} className={cn("flex min-h-12 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition-colors", expanded ? "flex-row justify-start text-xs" : "flex-col", active ? "bg-cyan-300/12 text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]")}><Icon className="size-4 shrink-0" /><span>{item.label}</span></Link>;
}
