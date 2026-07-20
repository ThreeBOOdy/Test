import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/server/session";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/change-password");
  return <main className="grid min-h-screen place-items-center p-4"><Card className="w-full max-w-md"><CardContent className="p-6 sm:p-8"><div className="grid size-12 place-items-center rounded-2xl bg-[var(--secondary)] text-[var(--primary)]"><ShieldCheck className="size-6" /></div><h1 className="mt-6 text-2xl font-extrabold tracking-[-0.04em]">设置新的登录密码</h1><p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{user.mustChangePassword ? "管理员为你创建或重置了密码，请先完成修改。" : "你可以在这里主动更新当前账号密码。"}</p><ChangePasswordForm role={user.role} /></CardContent></Card></main>;
}