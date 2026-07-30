import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RegistrationReviewManager } from "@/components/registration-review-manager";

export default function RegistrationsPage() {
  return <AppShell role="admin" currentPath="/admin/registrations"><PageHeader title="注册审核" description="按状态筛选并逐页审核学生自主注册申请" /><div className="mt-4 flex justify-end"><Link href="/admin/students" className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-sm font-extrabold transition hover:border-[var(--border-strong)] hover:bg-[var(--secondary)]">学生账号管理</Link></div><div className="mt-6"><RegistrationReviewManager /></div></AppShell>;
}
