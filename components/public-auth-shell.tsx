import { Logo } from "@/components/logo";
import { SignalField } from "@/components/visual/signal-field";
import { cn } from "@/lib/utils";

export function PublicAuthShell({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return <main className={cn("relative grid min-h-screen place-items-center overflow-hidden px-4 py-10", className)}><SignalField intensity="ambient" className="pointer-events-none absolute inset-0 opacity-50" /><div className="relative z-10 w-full max-w-md"><div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-glass)] p-8 shadow-[var(--shadow-card)] backdrop-blur-xl sm:p-10"><Logo /><div className="mt-8"><h1 className="text-3xl font-black tracking-[-0.045em]">{title}</h1>{description ? <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{description}</p> : null}</div><div className="mt-8">{children}</div></div><p className="mt-6 text-center text-xs text-[var(--muted-foreground)]">波段研习 · 无线电考证智能刷题</p></div></main>;
}
