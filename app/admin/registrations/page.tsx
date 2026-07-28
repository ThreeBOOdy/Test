import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RegistrationReviewManager } from "@/components/registration-review-manager";
import { listStudents } from "@/lib/server/student-account-service";
export default async function RegistrationsPage() { const rows = await listStudents({ status: "PENDING" }); return <AppShell role="admin" currentPath="/admin/registrations"><PageHeader title="注册审核" description={`当前待审核 ${rows.length} 项`} /><div className="mt-4 flex justify-end"><Link href="/admin/students" className="inline-flex h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 text-sm font-extrabold transition hover:border-[var(--border-strong)] hover:bg-[var(--secondary)]">学生账号管理</Link></div><div className="mt-6"><RegistrationReviewManager initialRows={rows as never} /></div></AppShell>; }
