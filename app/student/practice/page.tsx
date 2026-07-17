import { redirect } from "next/navigation";
import { PracticeRunner } from "@/components/practice-runner";
import { createPracticeSession, getPracticeSession } from "@/lib/server/practice-service";
import { getCurrentUser } from "@/lib/server/session";

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ mode?: string; level?: string; knowledge?: string; session?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") redirect("/login?next=/student");
  const params = await searchParams;
  if (params.session) {
    const session = await getPracticeSession(user.id, params.session);
    if (!session) redirect("/student");
    return <main className="min-h-screen px-4 py-6 sm:px-8"><PracticeRunner session={session} /></main>;
  }
  const session = await createPracticeSession(user.id, { mode: params.mode === "knowledge" ? "knowledge" : "level", levelCode: params.level ?? "A", knowledgePointId: params.knowledge });
  redirect(`/student/practice?session=${session.id}`);
}
