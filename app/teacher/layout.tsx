import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/session";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/teacher");
  if (user.role !== "TEACHER") redirect("/student");
  return children;
}
