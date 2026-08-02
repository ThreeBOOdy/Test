import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShellView } from "@/components/app-shell";
import { MobileNavigation } from "@/components/mobile-navigation";
import AdminLayout from "@/app/admin/layout";
import TeacherLayout from "@/app/teacher/layout";

const { getCurrentUser, redirect } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser }));
vi.mock("next/navigation", () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("application shell", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    redirect.mockClear();
  });

  it("shows the authenticated display name", () => {
    render(<AppShellView role="student" currentPath="/student" user={{ username: "student-7", displayName: "周同学" }}><div>训练内容</div></AppShellView>);
    expect(screen.getByText("周同学")).toBeInTheDocument();
    expect(screen.queryByText("林小知")).not.toBeInTheDocument();
  });

  it("makes every teacher section reachable on mobile", async () => {
    const user = userEvent.setup();
    render(<MobileNavigation role="teacher" currentPath="/teacher" />);
    await user.click(screen.getByRole("button", { name: "打开更多导航" }));
    const dialog = screen.getByRole("dialog", { name: "教师功能导航" });
    for (const label of ["管理概览", "题库管理", "知识点目录", "抽题规则", "题库导入", "教学统计"]) expect(within(dialog).getByRole("link", { name: label })).toBeInTheDocument();
    for (const label of ["注册审核", "学生账号", "学生导入", "年级配置", "人物身份目录", "学生管理"]) expect(within(dialog).queryByRole("link", { name: label })).not.toBeInTheDocument();
  });

  it("keeps administrator account tools out of the teacher desktop navigation", () => {
    render(<AppShellView role="teacher" currentPath="/teacher" user={{ username: "teacher", displayName: "李老师" }}><div>教学内容</div></AppShellView>);

    for (const label of ["注册审核", "学生账号", "学生导入", "年级配置", "人物身份目录", "学生管理"]) expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
  });

  it("shows only administrator account tools in the administrator console", () => {
    render(<AppShellView role="admin" currentPath="/admin" user={{ username: "admin", displayName: "系统管理员" }}><div>管理内容</div></AppShellView>);
    for (const label of ["注册审核", "学生账号", "学生导入", "年级配置", "人物身份目录"]) expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThan(0);
    for (const label of ["教学控制台", "题库管理", "知识点目录", "抽题规则", "题库导入", "教学统计"]) expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument();
  });

  it("makes every administrator section reachable on mobile", async () => {
    const user = userEvent.setup();
    render(<MobileNavigation role="admin" currentPath="/admin" />);
    await user.click(screen.getByRole("button", { name: "打开更多导航" }));
    const dialog = screen.getByRole("dialog", { name: "管理员功能导航" });
    for (const label of ["注册审核", "学生账号", "学生导入", "年级配置", "人物身份目录"]) expect(within(dialog).getByRole("link", { name: label })).toBeInTheDocument();
    expect(within(dialog).queryByRole("link", { name: "教学控制台" })).not.toBeInTheDocument();
  });

  it("allows only full administrators into the administrator layout", async () => {
    getCurrentUser.mockResolvedValue({ capability: "FULL_ADMIN", mustChangePassword: false });
    await expect(AdminLayout({ children: <div>管理员页面</div> })).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated and non-admin users away from administrator pages", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(AdminLayout({ children: <div>管理员页面</div> })).rejects.toThrow("redirect:/login?next=/admin");
    expect(redirect).toHaveBeenCalledWith("/login?next=/admin");

    redirect.mockClear();
    getCurrentUser.mockResolvedValue({ capability: "FULL_TEACHER", mustChangePassword: false });
    await expect(AdminLayout({ children: <div>管理员页面</div> })).rejects.toThrow("redirect:/login?next=%2Fadmin&error=role-mismatch");
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fadmin&error=role-mismatch");
  });

  it("allows only full teachers into the teaching console", async () => {
    getCurrentUser.mockResolvedValue({ capability: "FULL_TEACHER", mustChangePassword: false });
    await expect(TeacherLayout({ children: <div>教师页面</div> })).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();

    getCurrentUser.mockResolvedValue({ capability: "FULL_ADMIN", mustChangePassword: false });
    await expect(TeacherLayout({ children: <div>教师页面</div> })).rejects.toThrow("redirect:/login?next=%2Fteacher&error=role-mismatch");
  });
});
