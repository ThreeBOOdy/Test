import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/session";

export default async function StudentsPage() {
  const user = await getCurrentUser();
  if (user?.capability === "FULL_ADMIN") redirect("/admin/students" as never);
  redirect("/login?next=%2Fadmin%2Fstudents&error=role-mismatch" as never);
}
