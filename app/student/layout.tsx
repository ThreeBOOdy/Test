import { redirect } from "next/navigation";
import { getLoginRedirectForRole } from "@/lib/domain/auth-routing";
import { getCurrentUser } from "@/lib/server/session";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/student");
  if (user.role !== "STUDENT") redirect(getLoginRedirectForRole("STUDENT") as never);
  if (user.mustChangePassword) redirect("/change-password" as never);
  if (user.capability !== "FULL_STUDENT") redirect("/login");
  return children;
}
