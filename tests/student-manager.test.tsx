import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentManager } from "@/components/student-manager";

const student = {
  id: "student-1",
  username: "student-one",
  realName: "原姓名",
  school: "原学校",
  grade: { name: "七年级" },
  nationalIdMasked: "**************0011",
  phoneMasked: "138****8000",
  registrationSource: "SELF_REGISTRATION",
  studentStatus: "ACTIVE",
  enabled: true,
  activationRequired: false,
  validFrom: "2026-07-27",
  validUntil: "2027-07-27",
  isLongTerm: false,
};

const oneStudentPage = { items: [student], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } };

describe("student account manager", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("edits permitted profile fields while keeping the person username immutable", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...student, displayName: "原姓名", nationalIdMasked: "**************002X", gradeId: "grade-junior-1", phoneMasked: "138****8000" }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ grades: [{ id: "grade-junior-1", name: "七年级" }, { id: "grade-junior-2", name: "八年级" }] }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ saved: true }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ ...student, realName: "新姓名", school: "新学校", grade: { name: "八年级" }, nationalIdMasked: "**************002X", phoneMasked: "138****8000", isLongTerm: true }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<StudentManager initial={oneStudentPage} />);

    await user.click(screen.getByRole("button", { name: "编辑" }));
    expect(await screen.findByRole("heading", { name: "编辑学生账号" })).toBeInTheDocument();
    expect(screen.getByText(/人物用户名（永久不可修改）：student-one/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText("真实姓名"));
    await user.type(screen.getByLabelText("真实姓名"), "新姓名");
    await user.clear(screen.getByLabelText("学校"));
    await user.type(screen.getByLabelText("学校"), "新学校");
    await user.selectOptions(screen.getByLabelText("年级"), "grade-junior-2");
    await user.click(screen.getByRole("checkbox", { name: "长期账号" }));
    await user.click(screen.getByRole("button", { name: "保存账号" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/admin/students/student-1", expect.objectContaining({ method: "PUT" })));
    const request = fetchMock.mock.calls.find((call) => call[0] === "/api/v1/admin/students/student-1" && (call[1] as RequestInit | undefined)?.method === "PUT")?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({ displayName: "新姓名", school: "新学校", gradeId: "grade-junior-2", enabled: true, isLongTerm: true });
    expect(body).not.toHaveProperty("nationalId");
    expect(body).not.toHaveProperty("phone");
    expect(body).not.toHaveProperty("username");
    expect(body).not.toHaveProperty("radioPersonId");
    expect(body).not.toHaveProperty("validFrom");
    expect(body).not.toHaveProperty("validUntil");
    expect(await screen.findByText("学生账号已保存")).toBeInTheDocument();
    expect(screen.getByText("**************002X")).toBeInTheDocument();
  });

  it("loads search, status, and configurable pagination from the server", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [student], pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 } }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [student], pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 } }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [student], pagination: { page: 1, pageSize: 100, total: 21, totalPages: 1 } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const user = userEvent.setup();
    render(<StudentManager initial={{ ...oneStudentPage, pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 } }} />);

    await user.type(screen.getByLabelText("搜索学生"), "张三");
    await user.click(screen.getByRole("button", { name: "搜索" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/admin/students?page=1&pageSize=20&search=%E5%BC%A0%E4%B8%89", { cache: "no-store" }));
    await user.selectOptions(screen.getByLabelText("学生状态筛选"), "ACTIVE");
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/admin/students?page=1&pageSize=20&search=%E5%BC%A0%E4%B8%89&status=ACTIVE", { cache: "no-store" }));
    await user.selectOptions(screen.getByLabelText("每页显示条数"), "100");
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/admin/students?page=1&pageSize=100&search=%E5%BC%A0%E4%B8%89&status=ACTIVE", { cache: "no-store" }));
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
  });
});
