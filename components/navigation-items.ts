import type { LucideIcon } from "lucide-react";
import { BarChart3, BookCopy, BookOpen, ClipboardCheck, FileSpreadsheet, LayoutDashboard, School, Settings2, Target, UserRoundCog, UsersRound } from "lucide-react";

export type NavigationItem = { href: string; label: string; icon: LucideIcon };

export const studentNavigation: NavigationItem[] = [
  { href: "/student", label: "学习首页", icon: LayoutDashboard },
  { href: "/student/practice/start", label: "开始练习", icon: Target },
  { href: "/student/history", label: "练习记录", icon: BarChart3 },
  { href: "/student/wrong", label: "我的错题", icon: BookCopy },
];

export const teacherNavigation: NavigationItem[] = [
  { href: "/teacher", label: "管理概览", icon: LayoutDashboard },
  { href: "/teacher/questions", label: "题库管理", icon: BookOpen },
  { href: "/teacher/knowledge", label: "知识点目录", icon: Target },
  { href: "/teacher/rules", label: "抽题规则", icon: Settings2 },
  { href: "/teacher/import", label: "Excel 导入", icon: FileSpreadsheet },
  { href: "/teacher/reports", label: "教学统计", icon: BarChart3 },
];

export const administratorNavigation: NavigationItem[] = [
  { href: "/admin", label: "管理概览", icon: LayoutDashboard },
  { href: "/admin/registrations", label: "注册审核", icon: ClipboardCheck },
  { href: "/admin/students", label: "学生账号", icon: UsersRound },
  { href: "/admin/teachers", label: "教师账号", icon: UserRoundCog },
  { href: "/admin/student-import", label: "学生导入", icon: FileSpreadsheet },
  { href: "/admin/grades", label: "年级配置", icon: School },
];
