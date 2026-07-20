import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/session";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/student");
  if (user.role !== "STUDENT") redirect("/teacher");
  if (user.mustChangePassword) redirect("/change-password" as never);
  return children;
}
