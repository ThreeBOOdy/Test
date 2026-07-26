import { redirect } from "next/navigation";
import { RegistrationStatus } from "@/components/registration-status";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/server/session";
import { getRegistrationStatus } from "@/lib/server/student-account-service";

export default async function RegistrationStatusPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/registration/status");
  if (user.capability !== "REGISTRATION_ONLY") redirect(user.capability === "FULL_STUDENT" ? "/student" : "/login");
  const [data, grades] = await Promise.all([
    getRegistrationStatus(user.id),
    prisma.grade.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  return <RegistrationStatus initialData={data as never} grades={grades} />;
}
