import Link from "next/link";
import { PublicAuthShell } from "@/components/public-auth-shell";
import { StudentRegistrationForm } from "@/components/student-registration-form";

export default function RegisterPage() {
  return (
    <PublicAuthShell
      title="注册学生账号"
      description="填写实名资料并设置密码，再选择独立无线电人物用户名。审核通过前可登录查看状态并修改资料。"
    >
      <StudentRegistrationForm />
      <Link
        href="/login"
        className="mt-6 block text-center text-sm text-[var(--muted-foreground)] transition hover:text-[var(--primary)]"
      >
        已有账号？<span className="font-bold text-[var(--primary)]">返回登录</span>
      </Link>
    </PublicAuthShell>
  );
}
