import { cn } from "@/lib/utils";

export function SignalBackdrop({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}><div className="tech-grid absolute inset-0 opacity-70" /><div className="absolute -right-24 top-12 size-80 rounded-full border border-cyan-300/10" /><div className="absolute -right-8 top-28 size-52 rounded-full border border-violet-300/10" /></div>;
}
