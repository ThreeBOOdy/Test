import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShellView } from "@/components/app-shell";

describe("separate channel navigation", () => {
  it("does not expose administrator navigation inside the teacher console", () => {
    render(<AppShellView role="teacher" currentPath="/teacher" user={{ username: "teacher", displayName: "陈老师", role: "TEACHER" }}><div>教学内容</div></AppShellView>);

    expect(screen.getByText("教师账号 · 教学管理权限")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "管理员控制台" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "注册审核" })).not.toBeInTheDocument();
  });
});
