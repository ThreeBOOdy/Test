import { KeyRound, Plus, Search, UserRoundCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const students = [
  { username: "S2026001", name: "林小知", level: "A级", accuracy: "82%", practices: 18, active: "今天 09:42" },
  { username: "S2026002", name: "周言", level: "A级", accuracy: "76%", practices: 12, active: "今天 08:15" },
  { username: "S2026003", name: "许安", level: "B级", accuracy: "88%", practices: 24, active: "昨天 20:31" },
  { username: "S2026004", name: "沈清", level: "A级", accuracy: "69%", practices: 9, active: "7月15日" },
];
export default function StudentsPage() { return <AppShell role="teacher" currentPath="/teacher/students"><div className="safe-bottom"><PageHeader title="学生管理" description="由教师创建账号、分配初始密码并查看学习状态；首版关闭学生公开注册。" action={<Button><Plus className="size-4" />创建学生</Button>} /><div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:flex-row"><label className="flex h-11 flex-1 items-center gap-3 rounded-xl bg-[var(--muted)] px-4"><Search className="size-4 text-[var(--muted-foreground)]" /><input className="w-full bg-transparent text-sm outline-none" placeholder="搜索姓名或用户名" /></label><Button variant="outline">批量导入学生</Button></div><Card><CardContent className="overflow-x-auto p-0"><table className="min-w-[820px] w-full text-left"><thead><tr className="border-b border-[var(--border)] bg-[var(--muted)] text-xs text-[var(--muted-foreground)]"><Th>学生</Th><Th>当前等级</Th><Th>累计练习</Th><Th>正确率</Th><Th>最近活跃</Th><Th>操作</Th></tr></thead><tbody>{students.map((student) => <tr key={student.username} className="border-b border-[var(--border)] last:border-0"><Td><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-full bg-[var(--secondary)] font-bold text-[var(--primary)]">{student.name[0]}</div><div><div className="font-extrabold">{student.name}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{student.username}</div></div></div></Td><Td><Badge tone="green">{student.level}</Badge></Td><Td>{student.practices} 次</Td><Td><span className="font-extrabold text-[var(--primary)]">{student.accuracy}</span></Td><Td>{student.active}</Td><Td><div className="flex gap-2"><Button variant="ghost" size="sm"><UserRoundCheck className="size-4" />详情</Button><Button variant="ghost" size="sm"><KeyRound className="size-4" />重置密码</Button></div></Td></tr>)}</tbody></table></CardContent></Card></div></AppShell>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-5 py-4 font-semibold">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-5 py-4 text-sm">{children}</td>; }
