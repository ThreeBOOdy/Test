import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { FocusSessionPanel } from "@/components/focus-session-panel";
import { getCurrentUser } from "@/lib/server/session";
import { getFocusOverview } from "@/lib/server/focus-service";

export default async function StudentFocusPage() {
  const user = await getCurrentUser();
  if (!user || user.capability !== "FULL_STUDENT") redirect("/login");
  const overview = await getFocusOverview(user.id);

  return (
    <AppShell role="student" currentPath="/student/focus">
      <div className="safe-bottom">
        <PageHeader
          title="专注模式"
          description="Forest 式专注刷题：设定目标、完成打卡，连续记录你的学习节奏。"
          eyebrow="FOCUS SIGNAL"
        />
        <FocusSessionPanel initial={overview} />
      </div>
    </AppShell>
  );
}
