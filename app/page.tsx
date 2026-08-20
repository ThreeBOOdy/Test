import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { SignalField } from "@/components/visual/signal-field";
import { getDefaultPathForCapability } from "@/lib/domain/auth-routing";
import { getCurrentUser } from "@/lib/server/session";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.capability ? getDefaultPathForCapability(user.capability) : "/change-password");
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <SignalField intensity="ambient" className="pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface-glass)] p-8 text-center shadow-[var(--shadow-card)] backdrop-blur-xl sm:p-10">
        <Logo />
        <h1 className="mt-8 text-3xl font-black tracking-[-0.045em]">波段研习 · 无线电考证智能刷题</h1>
        <Link
          href="/login?next=/student"
          className="glow-btn mt-8 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-cyan-200/40 bg-[var(--primary)] px-7 font-bold text-[var(--primary-foreground)] shadow-[0_16px_40px_rgba(10,134,152,.26)] transition hover:-translate-y-0.5 hover:bg-[var(--primary-strong)] hover:shadow-[0_22px_50px_rgba(10,134,152,.32)]"
        >
          开始刷题
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </main>
  );
}
