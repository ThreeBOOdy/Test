import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RadioPersonManager } from "@/components/radio-person-manager";
import { listRadioPeopleForAdministration } from "@/lib/server/student-account-service";

export default async function RadioPeoplePage() {
  const people = await listRadioPeopleForAdministration();
  return <AppShell role="admin" currentPath="/admin/radio-people"><PageHeader title="人物身份目录" description="维护学生可选的无线电人物身份。已绑定身份的用户名、名称和资料永久不可修改。" /><div className="mt-6"><RadioPersonManager initialPeople={people as never} /></div></AppShell>;
}