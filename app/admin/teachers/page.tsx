import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { TeacherAccountManager } from "@/components/teacher-account-manager";
import { listTeachers } from "@/lib/server/teacher-account-service";

export default async function AdminTeachersPage() {
  const teachers = await listTeachers();
  return <AppShell role="admin" currentPath="/admin/teachers"><PageHeader title="教师账号" description="创建教师账号、展示一次性临时密码，并停用或重置既有账号。" /><div className="mt-6"><TeacherAccountManager teachers={teachers} /></div></AppShell>;
}
