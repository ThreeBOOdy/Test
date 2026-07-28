import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShellView } from "@/components/app-shell";

describe("administrator teaching channel navigation", () => {
  it("identifies the administrator account and provides a return link", () => {
    render(<AppShellView role="teacher" currentPath="/teacher" user={{ username: "teacher", displayName: "陈老师", role: "ADMIN" }}><div>教学内容</div></AppShellView>);

    expect(screen.getByText("管理员账号 · 当前教学频道")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "管理员控制台" }).length).toBeGreaterThan(0);
  });

  it("does not expose the administrator console to teacher accounts", () => {
    render(<AppShellView role="teacher" currentPath="/teacher" user={{ username: "instructor", displayName: "李老师", role: "TEACHER" }}><div>教学内容</div></AppShellView>);

    expect(screen.queryByRole("link", { name: "管理员控制台" })).not.toBeInTheDocument();
  });
});
