"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const handleClick = async () => {
    setPending(true);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  };
  if (compact) {
    return (
      <button
        type="button"
        aria-label="退出登录"
        disabled={pending}
        onClick={handleClick}
        className={`grid size-10 place-items-center rounded-full border border-cyan-600/20 bg-[var(--surface-soft)] text-[var(--muted-foreground)] transition hover:border-rose-300/40 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60 ${className}`}
      >
        <LogOut className="size-4" />
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className={`mt-auto flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-60 ${className}`}
    >
      <LogOut className="size-4" />{pending ? "正在退出…" : "退出登录"}
    </button>
  );
}
