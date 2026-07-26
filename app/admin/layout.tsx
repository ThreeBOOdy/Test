import { redirect } from "next/navigation";
import { getLoginRedirectForRole } from "@/lib/domain/auth-routing";
import { getCurrentUser } from "@/lib/server/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.capability !== "FULL_ADMIN") redirect(getLoginRedirectForRole("ADMIN") as never);
  if (user.mustChangePassword) redirect("/change-password" as never);
  return children;
}
