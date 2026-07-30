import Link from "next/link";
import { ClipboardCheck, FileSpreadsheet, School, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

const administratorActions = [
  { href: "/admin/registrations", label: "注册审核", description: "审核学生自主提交的注册资料", icon: ClipboardCheck },
  { href: "/admin/students", label: "学生账号", description: "维护账号状态、有效期和长期设置", icon: UsersRound },
  { href: "/admin/student-import", label: "学生导入", description: "通过 Excel 批量创建并直接启用账号", icon: FileSpreadsheet },
  { href: "/admin/grades", label: "年级配置", description: "维护学生注册和导入可选年级", icon: School },
];

export default function AdminPage() {
  return <AppShell role="admin" currentPath="/admin"><div className="safe-bottom"><PageHeader title="管理员控制台" description="统一处理学生账号、注册审核、批量导入与基础配置。" /><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{administratorActions.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href as never} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/40"><div className="grid size-11 place-items-center rounded-xl bg-cyan-300/10 text-[var(--primary)]"><Icon className="size-5" /></div><h2 className="mt-4 font-extrabold">{label}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p></Link>)}</div></div></AppShell>;
}
