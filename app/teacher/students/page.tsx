import { redirect } from "next/navigation";

export default async function StudentsPage() {
  redirect("/teacher" as never);
}
