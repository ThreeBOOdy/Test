import { redirect } from "next/navigation";
import { AuthConsole } from "@/components/auth-console";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Artwork } from "@/components/visual/artwork";
import { getCurrentUser } from "@/lib/server/session";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/change-password");
  return <AuthConsole title="重置信道密钥" description={user.mustChangePassword ? "管理员为你创建或重置了密码，请先完成修改。" : "你可以在这里主动更新当前账号密码。"} callsign="SEC / 14.120" visual={<Artwork src="/art/auth-telegraph-console-new-v2.webp" alt="安全电报接收台" sizes="43vw" preload variant="antenna" className="opacity-85" />}><ChangePasswordForm role={user.role} /></AuthConsole>;
}
