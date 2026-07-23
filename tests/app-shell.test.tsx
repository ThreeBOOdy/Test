import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShellView } from "@/components/app-shell";
import { MobileNavigation } from "@/components/mobile-navigation";

describe("application shell", () => {
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
    for (const label of ["管理概览", "题库管理", "知识点目录", "抽题规则", "Excel 导入", "学生管理"]) expect(within(dialog).getByRole("link", { name: label })).toBeInTheDocument();
  });
});
