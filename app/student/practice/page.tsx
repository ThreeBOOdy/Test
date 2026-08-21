import { redirect } from "next/navigation";
import { PracticeRunner } from "@/components/practice-runner";
import { normalizePracticeLaunch } from "@/lib/domain/practice-launcher";
import { createPracticeSession, getPracticeSession } from "@/lib/server/practice-service";
import { getCurrentUser } from "@/lib/server/session";
import { getStudentActiveLevelAccess } from "@/lib/server/student-level-access";

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ mode?: string; level?: string; knowledge?: string; session?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") redirect("/login?next=/student");
  if (user.capability !== "FULL_STUDENT") redirect("/login");
  const params = await searchParams;
  if (params.session) {
    const session = await getPracticeSession(user.id, params.session);
    if (!session) redirect("/student");
    return <main className="practice-workbench min-h-screen px-4 py-6 sm:px-8"><PracticeRunner session={session} /></main>;
  }
  const activeLevelAccess = await getStudentActiveLevelAccess(user.id);
  if (!activeLevelAccess.activeLevelId || !activeLevelAccess.activeLevel?.enabled) redirect("/student/practice/start");
  const launch = normalizePracticeLaunch(params);
  const session = await createPracticeSession(user.id,
    launch.mode === "WRONG_QUESTION" ? { mode: "wrong", questionId: launch.questionId }
      : launch.mode === "KNOWLEDGE_POINT" ? { mode: "knowledge", levelCode: launch.levelCode ?? "", knowledgePointId: launch.knowledgePointId ?? "" }
        : launch.mode === "QUESTION_ORDER" ? { mode: "order", levelCode: launch.levelCode ?? "" }
          : launch.mode === "RANDOM_ALL" ? { mode: "random", levelCode: launch.levelCode ?? "" }
            : launch.mode === "MOCK_EXAM" ? { mode: "exam", levelCode: launch.levelCode ?? "" }
              : { mode: "level", levelCode: launch.levelCode ?? "" });
  redirect(`/student/practice?session=${session.id}`);
}
