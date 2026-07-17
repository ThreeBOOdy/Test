import { PracticeRunner } from "@/components/practice-runner";
import { createDemoSession } from "@/lib/server/demo-session-store";

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ mode?: string; level?: string; knowledge?: string }> }) {
  const params = await searchParams;
  const session = createDemoSession({ mode: params.mode === "knowledge" ? "knowledge" : "level", levelCode: params.level ?? "A", knowledgePointId: params.knowledge });
  return <main className="min-h-screen px-4 py-6 sm:px-8"><PracticeRunner session={session} /></main>;
}
