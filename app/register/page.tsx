import Link from "next/link";
import { AuthConsole } from "@/components/auth-console";
import { StudentRegistrationForm } from "@/components/student-registration-form";
import { Artwork } from "@/components/visual/artwork";

export default function RegisterPage() {
  return <AuthConsole title="申请学生呼号" description="填写学生资料并设置密码，姓名将直接作为登录账号。审核通过前可登录查看状态并修改资料。" callsign="REG / 7.030" visual={<Artwork src="/art/register-signal-station.webp" alt="夜色中的学生信号接收站" sizes="(min-width: 768px) 43vw, 100vw" preload variant="antenna" className="[&>img]:object-[center_58%]" />}><StudentRegistrationForm /><div className="mt-6 text-center text-sm text-[var(--muted-foreground)]">已有账号？ <Link href="/login" className="font-bold text-[var(--primary)]">返回登录</Link></div></AuthConsole>;
}
