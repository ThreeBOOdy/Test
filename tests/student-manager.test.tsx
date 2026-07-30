import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentManager } from "@/components/student-manager";

const student = {
  id: "student-1",
  username: "student-one",
  displayName: "原姓名",
  realName: "原姓名",
  gender: "MALE",
  school: "原学校",
  grade: { name: "七年级" },
  nationalIdMasked: "**************0011",
  phoneMasked: "138****8000",
  registrationSource: "SELF_REGISTRATION",
  studentStatus: "ACTIVE",
  enabled: true,
  validFrom: "2026-07-27",
  validUntil: "2027-07-27",
  isLongTerm: false,
};

describe("student account manager", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("edits identity, school, grade, phone, status and validity in one form", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...student, nationalId: "11010519491231002X", gradeId: "grade-junior-1", phone: "13800138000" }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ grades: [
        { id: "grade-junior-1", name: "七年级" },
        { id: "grade-junior-2", name: "八年级" },
      ] }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<StudentManager students={[student]} />);

    await user.click(screen.getByRole("button", { name: "编辑" }));
    expect(await screen.findByRole("heading", { name: "编辑学生账号" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("真实姓名"));
    await user.type(screen.getByLabelText("真实姓名"), "新姓名");
    await user.clear(screen.getByLabelText("学校"));
    await user.type(screen.getByLabelText("学校"), "新学校");
    await user.selectOptions(screen.getByLabelText("年级"), "grade-junior-2");
    await user.click(screen.getByRole("checkbox", { name: "长期账号" }));
    await user.click(screen.getByRole("button", { name: "保存账号" }));

    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/admin/students/student-1", expect.objectContaining({ method: "PUT" })));
    const request = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({ displayName: "新姓名", nationalId: "11010519491231002X", school: "新学校", gradeId: "grade-junior-2", phone: "13800138000", enabled: true, isLongTerm: true });
    expect(body).not.toHaveProperty("validFrom");
    expect(body).not.toHaveProperty("validUntil");
    expect(await screen.findByText("学生账号已保存")).toBeInTheDocument();
  });
});
