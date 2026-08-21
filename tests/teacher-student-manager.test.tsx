import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeacherStudentManager } from "@/components/teacher-student-manager";

const levels = [
  { id: "level-a", code: "A", name: "基础掌握", enabled: true },
  { id: "level-b", code: "B", name: "综合提升", enabled: true },
  { id: "level-c", code: "C", name: "高阶挑战", enabled: true },
];

const assignedStudent = {
  id: "student-1",
  username: "student-one",
  realName: "学生一",
  school: "示例中学",
  grade: { name: "七年级" },
  studentStatus: "ACTIVE",
  enabled: true,
  activeLevel: { id: "level-a", code: "A", name: "基础掌握" },
};

const unassignedStudent = {
  id: "student-2",
  username: "student-two",
  realName: "学生二",
  school: null,
  grade: null,
  studentStatus: "ACTIVE",
  enabled: true,
  activeLevel: null,
};

const initial = {
  items: [assignedStudent, unassignedStudent],
  pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
  levels,
};

describe("TeacherStudentManager", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows each student current activeLevel and enabled A/B/C options", () => {
    render(<TeacherStudentManager initial={initial} />);

    expect(screen.getByText("学生一")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("基础掌握")).toBeInTheDocument();
    expect(screen.getAllByText("未分配").length).toBeGreaterThan(0);

    const select = screen.getByLabelText("设置 学生二 的字母类") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(expect.arrayContaining(["A · 基础掌握", "B · 综合提升", "C · 高阶挑战"]));
  });

  it("keeps letter class options when reloading the student list", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ items: [assignedStudent, unassignedStudent], pagination: initial.pagination }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<TeacherStudentManager initial={initial} />);

    await user.click(screen.getByRole("button", { name: "搜索" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/teacher/students?page=1&pageSize=20", expect.anything()));
    const select = screen.getByLabelText("设置 学生二 的字母类") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(expect.arrayContaining(["A · 基础掌握", "B · 综合提升", "C · 高阶挑战"]));
  });

  it("saves a new activeLevel and updates the row locally", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ saved: true, activeLevelId: "level-b" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<TeacherStudentManager initial={initial} />);

    const row = screen.getByText("学生二").closest("tr")!;
    await user.selectOptions(within(row).getByLabelText("设置 学生二 的字母类"), "level-b");
    await user.click(within(row).getByRole("button", { name: "保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/teacher/students/student-2/active-level", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ activeLevelId: "level-b" }),
    })));
    expect(await screen.findByText("字母类已保存")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("综合提升")).toBeInTheDocument();
  });

  it("saves null to unassign a student", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ saved: true, activeLevelId: null }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<TeacherStudentManager initial={initial} />);

    const row = screen.getByText("学生一").closest("tr")!;
    await user.selectOptions(within(row).getByLabelText("设置 学生一 的字母类"), "");
    await user.click(within(row).getByRole("button", { name: "保存" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/teacher/students/student-1/active-level", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ activeLevelId: null }),
    })));
    expect(await screen.findByText("字母类已保存")).toBeInTheDocument();
    const studentOneRow = screen.getByText("学生一").closest("tr")!;
    expect(studentOneRow.querySelector('td[data-label="当前字母类"]')).toHaveTextContent("未分配");
  });

  it("shows server validation errors without losing the row state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "字母类不存在或已停用" }), { status: 404, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<TeacherStudentManager initial={initial} />);

    const row = screen.getByText("学生二").closest("tr")!;
    await user.selectOptions(within(row).getByLabelText("设置 学生二 的字母类"), "level-c");
    await user.click(within(row).getByRole("button", { name: "保存" }));

    expect(await screen.findByText("字母类不存在或已停用")).toBeInTheDocument();
    expect(screen.queryByText("字母类已保存")).not.toBeInTheDocument();
  });
});
