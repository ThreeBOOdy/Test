import { AuthConsole } from "@/components/auth-console";
import { StudentActivationForm } from "@/components/student-activation-form";
import { Artwork } from "@/components/visual/artwork";

export default function ActivatePage() {
  return <AuthConsole title="激活学生账号" description="一次性验证初始凭据，完成改密与人物身份选择。" callsign="ACTIVATE / 10.140" visual={<Artwork src="/art/auth-telegraph-console-new-v2.webp" alt="现代电报键与无线电接收台" sizes="(max-width: 768px) 100vw, 43vw" variant="antenna" />}><StudentActivationForm /></AuthConsole>;
}
