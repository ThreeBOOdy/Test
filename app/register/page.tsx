import Link from "next/link";
import { StudentRegistrationForm } from "@/components/student-registration-form";
import { Logo } from "@/components/logo";

export default function RegisterPage() {
  return <main className="min-h-screen px-4 py-8"><div className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] sm:p-10"><Logo /><h1 className="mt-8 text-3xl font-black">注册学生账号</h1><p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">提交后需等待管理员审核。审核通过前可登录查看状态并修改资料。</p><StudentRegistrationForm /><div className="mt-6 text-center text-sm text-[var(--muted-foreground)]">已有账号？ <Link href="/login" className="font-bold text-[var(--primary)]">返回登录</Link></div></div></main>;
}
