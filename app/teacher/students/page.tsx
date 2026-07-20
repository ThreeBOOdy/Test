import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StudentManager } from "@/components/student-manager";
import { prisma } from "@/lib/db";

export default async function StudentsPage() {
  const students = await prisma.user.findMany({ where: { role: "STUDENT" }, include: { sessions: { select: { correctCount: true, singleCountSnapshot: true, multipleCountSnapshot: true, startedAt: true }, orderBy: { startedAt: "desc" } } }, orderBy: { createdAt: "desc" } });
  const rows = students.map((student) => {
    const answered = student.sessions.reduce((sum, item) => sum + item.singleCountSnapshot + item.multipleCountSnapshot, 0);
    const correct = student.sessions.reduce((sum, item) => sum + item.correctCount, 0);
    return { id: student.id, username: student.username, displayName: student.displayName, enabled: student.enabled, mustChangePassword: student.mustChangePassword, sessionCount: student.sessions.length, accuracy: answered ? Math.round(correct / answered * 100) : 0, lastActive: student.sessions[0]?.startedAt.toLocaleString("zh-CN") ?? "尚未练习" };
  });
  return <AppShell role="teacher" currentPath="/teacher/students"><div className="safe-bottom"><PageHeader title="学生管理" description={`当前共有 ${rows.length} 个学生账号。教师可创建账号、停用账号并生成一次性临时密码。`} /><StudentManager students={rows} /></div></AppShell>;
}