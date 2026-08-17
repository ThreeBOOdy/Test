"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return <button type="button" disabled={pending} onClick={async () => {
    setPending(true);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }} className="mt-auto flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-60"><LogOut className="size-4" />{pending ? "正在退出…" : "退出登录"}</button>;
}
