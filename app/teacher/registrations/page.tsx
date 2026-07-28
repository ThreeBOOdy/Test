import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RegistrationReviewManager } from "@/components/registration-review-manager";
import { listStudents } from "@/lib/server/student-account-service";

export default async function TeacherRegistrationsPage() {
  const rows = await listStudents({ status: "PENDING" });

  return (
    <AppShell role="teacher" currentPath="/teacher/registrations">
      <PageHeader title="注册审核" description={`当前待审核 ${rows.length} 项`} />
      <div className="mt-6">
        <RegistrationReviewManager initialRows={rows as never} />
      </div>
    </AppShell>
  );
}
