import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { KnowledgeMapView } from "@/components/knowledge-map-view";
import { getStudentKnowledgeMap } from "@/lib/server/knowledge-map-service";
import { getCurrentUser } from "@/lib/server/session";

export default async function StudentKnowledgeMapPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT" || user.capability !== "FULL_STUDENT") redirect("/login?next=/student/map");
  const map = await getStudentKnowledgeMap(user.id);
  return (
    <AppShell role="student" currentPath="/student/map">
      <KnowledgeMapView initial={map} />
    </AppShell>
  );
}
