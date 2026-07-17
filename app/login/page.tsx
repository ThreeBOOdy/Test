import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/server/session";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "TEACHER" ? "/teacher" : "/student");
  return <main className="grid min-h-screen place-items-center px-4 py-10"><Card className="w-full max-w-md"><CardContent className="p-7 sm:p-9"><Logo /><h1 className="mt-8 text-3xl font-black tracking-[-0.04em]">登录知练</h1><p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">使用教师分配的账号进入学习空间或管理工作台。</p><Suspense><LoginForm /></Suspense></CardContent></Card></main>;
}
