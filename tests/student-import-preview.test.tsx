import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StudentImportPreview } from "@/components/student-import-preview";

const batch = {
  id: "batch-1",
  totalRows: 1,
  validRows: 1,
  errorRows: 0,
  rows: [
    {
      id: "row-1",
      sheetName: "七年级",
      sourceRowNumber: 2,
      payload: {
        username: "student_001",
        displayName: "张三",
        nationalId: "11010519491231002X",
        school: "示例中学",
        grade: "七年级",
        phone: "13800138000",
        gender: "FEMALE",
        enabled: true,
        validFrom: "2026-07-26",
        validUntil: "2027-07-26",
        isLongTerm: false,
      },
      issues: [],
      valid: true,
    },
  ],
};

describe("StudentImportPreview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows administrators to edit every supported account field before import", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(batch), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const user = userEvent.setup();
    const { container } = render(<StudentImportPreview />);
    const file = new File(["xlsx"], "students.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await user.upload(screen.getByLabelText("学生账号 Excel"), file);
    await user.click(await screen.findByRole("button", { name: "编辑" }));

    expect(screen.getByRole("dialog", { name: "编辑导入学生" })).toBeInTheDocument();
    expect(screen.getByLabelText("用户名")).toHaveValue("student_001");
    expect(screen.getByLabelText("姓名")).toHaveValue("张三");
    expect(screen.getByLabelText("身份证号")).toHaveValue("11010519491231002X");
    expect(screen.getByLabelText("学校")).toHaveValue("示例中学");
    expect(screen.getByLabelText("年级")).toHaveValue("七年级");
    expect(screen.getByLabelText("手机号")).toHaveValue("13800138000");
    expect(screen.getByLabelText("初始密码")).toHaveValue("");
    expect(screen.getByLabelText("启用账号")).toBeChecked();
    expect(screen.getByLabelText("有效期开始")).toHaveValue("2026-07-26");
    expect(screen.getByLabelText("有效期结束")).toHaveValue("2027-07-26");
    expect(screen.getByLabelText("长期账号")).not.toBeChecked();
    expect(container.querySelector('input[name="gender"]')).toBeNull();
    expect(screen.getByText("性别由身份证号自动推导：女")).toBeInTheDocument();
  });
});
