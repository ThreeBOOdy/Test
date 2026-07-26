"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { administratorNavigation, studentNavigation, teacherNavigation, type NavigationItem } from "@/components/navigation-items";
import { cn } from "@/lib/utils";

export function MobileNavigation({ role, currentPath }: { role: "student" | "teacher" | "admin"; currentPath: string }) {
  const [open, setOpen] = useState(false);
  const navigation = role === "student" ? studentNavigation : role === "teacher" ? teacherNavigation : administratorNavigation;
  const items = role === "student" ? navigation : [navigation[0], navigation[1], navigation[2]];
  const hasMore = role !== "student";
  const roleLabel = role === "admin" ? "管理员" : "教师";

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return <>
    <nav className={cn("fixed inset-x-3 bottom-3 z-40 grid rounded-2xl border border-[var(--border)] bg-[color:rgba(13,20,32,.96)] p-2 shadow-2xl backdrop-blur-xl lg:hidden", "grid-cols-4")} style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }} aria-label="移动端主导航">
      {items.map((item) => <MobileNavLink key={item.href} item={item} active={currentPath === item.href} onClick={() => setOpen(false)} />)}
      {hasMore ? <button type="button" aria-label="打开更多导航" aria-expanded={open} aria-controls="mobile-nav-sheet" onClick={() => setOpen(true)} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"><Menu className="size-4" />更多</button> : null}
    </nav>
    {hasMore && open ? <div className="fixed inset-0 z-50 lg:hidden"><button type="button" aria-label="关闭更多导航" className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setOpen(false)} /><section id="mobile-nav-sheet" role="dialog" aria-modal="true" aria-label={`${roleLabel}功能导航`} className="absolute inset-x-3 bottom-3 rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-2xl" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}><div className="mb-3 flex items-center justify-between"><div><div className="text-sm font-extrabold">{roleLabel}功能导航</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">所有管理入口均可在手机访问</div></div><button type="button" aria-label="关闭导航面板" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl bg-[var(--surface-soft)] text-[var(--muted-foreground)]"><X className="size-4" /></button></div><div className="grid grid-cols-2 gap-2">{navigation.map((item) => <MobileNavLink key={item.href} item={item} active={currentPath === item.href} onClick={() => setOpen(false)} expanded />)}</div></section></div> : null}
  </>;
}

function MobileNavLink({ item, active, onClick, expanded = false }: { item: NavigationItem; active: boolean; onClick: () => void; expanded?: boolean }) {
  const Icon = item.icon;
  return <Link href={item.href as never} aria-label={item.label} onClick={onClick} className={cn("flex min-h-12 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition-colors", expanded ? "flex-row justify-start text-xs" : "flex-col", active ? "bg-cyan-300/12 text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]")}><Icon className="size-4 shrink-0" /><span>{item.label}</span></Link>;
}
