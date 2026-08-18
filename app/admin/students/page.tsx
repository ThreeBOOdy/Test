import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StudentManager } from "@/components/student-manager";
import { listStudents } from "@/lib/server/student-account-service";

export default async function AdminStudentsPage() {
  const initial = await listStudents({ page: 1, pageSize: 20 });
  return <AppShell role="admin" currentPath="/admin/students"><PageHeader title="学生账号" description="维护学生实名资料、账号状态、有效期和激活凭据。"/><div className="mt-6"><StudentManager initial={initial} /></div></AppShell>;
}
