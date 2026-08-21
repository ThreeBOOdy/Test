import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { TeacherStudentManager } from "@/components/teacher-student-manager";
import { prisma } from "@/lib/db";
import { requireTeacher } from "@/lib/server/api";
import { listTeacherStudents } from "@/lib/server/teacher-student-service";

export default async function TeacherStudentsPage() {
  await requireTeacher();
  const [students, levels] = await Promise.all([
    listTeacherStudents({ page: 1, pageSize: 20 }),
    prisma.level.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, enabled: true },
    }),
  ]);
  return <AppShell role="teacher" currentPath="/teacher/students"><div className="safe-bottom"><PageHeader title="学生管理" description="查看学生当前字母类，并为单个学生设置 A/B/C/未分配 的 activeLevel。" /><TeacherStudentManager initial={{ ...students, levels }} /></div></AppShell>;
}
