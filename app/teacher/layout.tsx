import { redirect } from "next/navigation";
import { getLoginRedirectForRole } from "@/lib/domain/auth-routing";
import { getCurrentUser } from "@/lib/server/session";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/teacher");
  if (user.mustChangePassword) redirect("/change-password" as never);
  if (user.capability !== "FULL_TEACHER") redirect(getLoginRedirectForRole("TEACHER") as never);
  return children;
}
