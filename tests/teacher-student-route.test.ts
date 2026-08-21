import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  assertSameOrigin: vi.fn(),
  listTeacherStudents: vi.fn(),
  setStudentActiveLevel: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireTeacher: mocks.requireTeacher };
});
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/server/teacher-student-service", () => ({
  listTeacherStudents: mocks.listTeacherStudents,
  setStudentActiveLevel: mocks.setStudentActiveLevel,
}));

import { GET } from "@/app/api/v1/teacher/students/route";
import { PATCH } from "@/app/api/v1/teacher/students/[id]/active-level/route";
import { ApiError } from "@/lib/domain/api-error";

const baseUser = { id: "teacher-1", username: "teacher", displayName: "Teacher", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("teacher student active-level API", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireTeacher.mockResolvedValue(teacher);
    mocks.listTeacherStudents.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    mocks.setStudentActiveLevel.mockResolvedValue({ saved: true, activeLevelId: "level-a" });
  });

  it("lists students for teachers with validated paging and filters", async () => {
    const response = await GET(new Request("http://localhost/api/v1/teacher/students?page=2&pageSize=200&search=%E5%BC%A0%E4%B8%89&status=ACTIVE"));

    expect(response.status).toBe(200);
    expect(mocks.listTeacherStudents).toHaveBeenCalledWith({ page: 2, pageSize: 100, search: "张三", status: "ACTIVE" });
  });

  it("defaults malformed teacher student list queries", async () => {
    await GET(new Request("http://localhost/api/v1/teacher/students?page=0&pageSize=wat&status=DISABLED"));

    expect(mocks.listTeacherStudents).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: undefined, status: undefined });
  });

  it("sets an active level through PATCH and passes the teacher id", async () => {
    const response = await PATCH(jsonRequest("http://localhost/api/v1/teacher/students/student-1/active-level", "PATCH", { activeLevelId: "level-b" }), { params: Promise.resolve({ id: "student-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true, activeLevelId: "level-a" });
    expect(mocks.setStudentActiveLevel).toHaveBeenCalledWith("teacher-1", "student-1", "level-b");
  });

  it("accepts null to unassign a student", async () => {
    mocks.setStudentActiveLevel.mockResolvedValue({ saved: true, activeLevelId: null });
    const response = await PATCH(jsonRequest("http://localhost/api/v1/teacher/students/student-1/active-level", "PATCH", { activeLevelId: null }), { params: Promise.resolve({ id: "student-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true, activeLevelId: null });
    expect(mocks.setStudentActiveLevel).toHaveBeenCalledWith("teacher-1", "student-1", null);
  });

  it("rejects invalid active-level payloads", async () => {
    const response = await PATCH(jsonRequest("http://localhost/api/v1/teacher/students/student-1/active-level", "PATCH", { activeLevelId: "" }), { params: Promise.resolve({ id: "student-1" }) });

    expect(response.status).toBe(400);
    expect(mocks.setStudentActiveLevel).not.toHaveBeenCalled();
  });

  it("rejects non-teachers", async () => {
    mocks.requireTeacher.mockRejectedValue(new ApiError("权限不足", 403));
    const response = await PATCH(jsonRequest("http://localhost/api/v1/teacher/students/student-1/active-level", "PATCH", { activeLevelId: null }), { params: Promise.resolve({ id: "student-1" }) });

    expect(response.status).toBe(403);
    expect(mocks.setStudentActiveLevel).not.toHaveBeenCalled();
  });
});
