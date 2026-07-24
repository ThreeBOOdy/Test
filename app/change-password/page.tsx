import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Artwork } from "@/components/visual/artwork";
import { getCurrentUser } from "@/lib/server/session";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/change-password");
  return <main className="grid min-h-screen place-items-center p-4"><div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] md:grid-cols-[40%_60%]"><div className="relative hidden min-h-[640px] md:block"><Artwork src="/art/login-antenna-array.webp" alt="安全无线电连接天线" sizes="40vw" preload variant="antenna" className="opacity-75" /><div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,11,18,.85),transparent_60%)]" /></div><div className="flex items-center p-7 sm:p-10 md:p-14"><div className="mx-auto w-full max-w-md"><div className="grid size-12 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-[var(--primary)]"><ShieldCheck className="size-6" /></div><div className="mt-6 text-[10px] font-bold tracking-[.22em] text-[var(--primary)]">SECURE CREDENTIAL CHANNEL</div><h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em]">设置新的登录密码</h1><p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{user.mustChangePassword ? "管理员为你创建或重置了密码，请先完成修改。" : "你可以在这里主动更新当前账号密码。"}</p><ChangePasswordForm role={user.role} /></div></div></div></main>;
}
