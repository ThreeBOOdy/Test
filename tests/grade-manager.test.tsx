import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticatedFetch, refresh, requireAdministrator, gradeFindMany, gradeFindUnique, gradeCreate, gradeUpdateMany, gradeDelete, writeAuditLog } = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  refresh: vi.fn(),
  requireAdministrator: vi.fn(),
  gradeFindMany: vi.fn(),
  gradeFindUnique: vi.fn(),
  gradeCreate: vi.fn(),
  gradeUpdateMany: vi.fn(),
  gradeDelete: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/client/authenticated-fetch", () => ({ authenticatedFetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireAdministrator };
});
vi.mock("@/lib/server/audit", () => ({ writeAuditLog }));
vi.mock("@/lib/db", () => ({
  prisma: {
    grade: {
      findMany: gradeFindMany,
      findUnique: gradeFindUnique,
      create: gradeCreate,
      updateMany: gradeUpdateMany,
      delete: gradeDelete,
    },
  },
}));

import { GradeManager } from "@/components/grade-manager";
import { GET, POST } from "@/app/api/v1/admin/grades/route";
import { DELETE, PUT } from "@/app/api/v1/admin/grades/[id]/route";

const grades = [
  { id: "grade-7", code: "GRADE_7", name: "七年级", sortOrder: 7, enabled: true, updatedAt: "2026-07-26T08:00:00.000Z", studentCount: 3 },
  { id: "grade-8", code: "GRADE_8", name: "八年级", sortOrder: 8, enabled: false, updatedAt: "2026-07-26T09:00:00.000Z", studentCount: 0 },
];

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("grade administration API", () => {
  beforeEach(() => {
    requireAdministrator.mockReset();
    requireAdministrator.mockResolvedValue({ id: "admin-1" });
    gradeFindMany.mockReset();
    gradeFindUnique.mockReset();
    gradeCreate.mockReset();
    gradeUpdateMany.mockReset();
    gradeDelete.mockReset();
    writeAuditLog.mockReset();
  });

  it("requires an administrator and lists grades with associated student counts", async () => {
    gradeFindMany.mockResolvedValue([{ ...grades[0], updatedAt: new Date(grades[0].updatedAt), _count: { students: 3 } }]);
    const response = await GET();
    expect(requireAdministrator).toHaveBeenCalledOnce();
    expect(gradeFindMany).toHaveBeenCalledWith(expect.objectContaining({ include: { _count: { select: { students: true } } } }));
    await expect(response.json()).resolves.toEqual({ grades: [grades[0]] });
  });

  it("creates a grade and maps duplicate code or name to conflict", async () => {
    gradeCreate.mockResolvedValue({ id: "grade-9" });
    const response = await POST(jsonRequest("http://localhost/api/v1/admin/grades", "POST", { code: "GRADE_9", name: "九年级", sortOrder: 9, enabled: true }));
    expect(response.status).toBe(201);
    expect(gradeCreate).toHaveBeenCalledWith({ data: { code: "GRADE_9", name: "九年级", sortOrder: 9, enabled: true } });

    gradeCreate.mockRejectedValueOnce({ code: "P2002", name: "PrismaClientKnownRequestError", message: "duplicate" });
    const duplicate = await POST(jsonRequest("http://localhost/api/v1/admin/grades", "POST", { code: "GRADE_9", name: "九年级", sortOrder: 9, enabled: true }));
    expect(duplicate.status).toBe(409);
  });

  it("renames, sorts, enables and disables with an updatedAt optimistic lock", async () => {
    gradeFindUnique.mockResolvedValue({ ...grades[0], updatedAt: new Date(grades[0].updatedAt) });
    gradeUpdateMany.mockResolvedValue({ count: 1 });
    const response = await PUT(jsonRequest("http://localhost/api/v1/admin/grades/grade-7", "PUT", {
      name: "初一", sortOrder: 70, enabled: false, updatedAt: grades[0].updatedAt,
    }), { params: Promise.resolve({ id: "grade-7" }) });
    expect(response.status).toBe(200);
    expect(gradeUpdateMany).toHaveBeenCalledWith({
      where: { id: "grade-7", updatedAt: new Date(grades[0].updatedAt) },
      data: { name: "初一", sortOrder: 70, enabled: false },
    });

    gradeUpdateMany.mockResolvedValueOnce({ count: 0 });
    const conflict = await PUT(jsonRequest("http://localhost/api/v1/admin/grades/grade-7", "PUT", {
      name: "初一", sortOrder: 70, enabled: true, updatedAt: grades[0].updatedAt,
    }), { params: Promise.resolve({ id: "grade-7" }) });
    expect(conflict.status).toBe(409);
  });

  it("refuses DELETE when a grade is referenced and otherwise directs administrators to disable it", async () => {
    gradeFindUnique.mockResolvedValueOnce({ id: "grade-7", _count: { students: 3 } });
    const referenced = await DELETE(jsonRequest("http://localhost/api/v1/admin/grades/grade-7", "DELETE"), { params: Promise.resolve({ id: "grade-7" }) });
    expect(referenced.status).toBe(409);
    expect(gradeDelete).not.toHaveBeenCalled();

    gradeFindUnique.mockResolvedValueOnce({ id: "grade-8", _count: { students: 0 } });
    const unreferenced = await DELETE(jsonRequest("http://localhost/api/v1/admin/grades/grade-8", "DELETE"), { params: Promise.resolve({ id: "grade-8" }) });
    expect(unreferenced.status).toBe(409);
    expect(gradeDelete).not.toHaveBeenCalled();
  });
});

describe("GradeManager", () => {
  beforeEach(() => {
    authenticatedFetch.mockReset();
    refresh.mockReset();
  });

  it("shows grade details, student counts and enabled state", () => {
    render(<GradeManager grades={grades} />);
    const gradeSeven = screen.getByTestId("grade-grade-7");
    expect(within(gradeSeven).getByText("GRADE_7")).toBeInTheDocument();
    expect(within(gradeSeven).getByText("七年级")).toBeInTheDocument();
    expect(within(gradeSeven).getByText("3")).toBeInTheDocument();
    expect(within(gradeSeven).getByText("启用")).toBeInTheDocument();
    expect(within(screen.getByTestId("grade-grade-8")).getByText("停用")).toBeInTheDocument();
  });

  it("adds a grade", async () => {
    const user = userEvent.setup();
    authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ id: "grade-9" }) });
    render(<GradeManager grades={grades} />);
    await user.click(screen.getByRole("button", { name: "新增年级" }));
    await user.type(screen.getByLabelText("年级代码"), "GRADE_9");
    await user.type(screen.getByLabelText("年级名称"), "九年级");
    fireEvent.change(screen.getByLabelText("排序"), { target: { value: "9" } });
    await user.click(screen.getByRole("button", { name: "保存年级" }));
    expect(authenticatedFetch).toHaveBeenCalledWith("/api/v1/admin/grades", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ code: "GRADE_9", name: "九年级", sortOrder: 9, enabled: true }),
    }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("edits name, order and enabled state using the row updatedAt", async () => {
    const user = userEvent.setup();
    authenticatedFetch.mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
    render(<GradeManager grades={grades} />);
    await user.click(within(screen.getByTestId("grade-grade-7")).getByRole("button", { name: "编辑" }));
    await user.clear(screen.getByLabelText("年级名称"));
    await user.type(screen.getByLabelText("年级名称"), "初一");
    fireEvent.change(screen.getByLabelText("排序"), { target: { value: "70" } });
    await user.click(screen.getByLabelText("启用"));
    await user.click(screen.getByRole("button", { name: "保存年级" }));
    expect(authenticatedFetch).toHaveBeenCalledWith("/api/v1/admin/grades/grade-7", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ name: "初一", sortOrder: 70, enabled: false, updatedAt: grades[0].updatedAt }),
    }));
  });

  it("shows API conflicts without refreshing", async () => {
    const user = userEvent.setup();
    authenticatedFetch.mockResolvedValue({ ok: false, json: async () => ({ message: "年级已被其他管理员修改，请刷新后重试" }) });
    render(<GradeManager grades={grades} />);
    await user.click(within(screen.getByTestId("grade-grade-7")).getByRole("button", { name: "编辑" }));
    await user.click(screen.getByRole("button", { name: "保存年级" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("年级已被其他管理员修改，请刷新后重试");
    expect(refresh).not.toHaveBeenCalled();
  });
});
