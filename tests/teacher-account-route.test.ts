import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  assertSameOrigin: vi.fn(),
  listTeachers: vi.fn(),
  createTeacherAccount: vi.fn(),
  deactivateTeacherAccount: vi.fn(),
  resetTeacherPassword: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/server/teacher-account-service", () => ({
  listTeachers: mocks.listTeachers,
  createTeacherAccount: mocks.createTeacherAccount,
  deactivateTeacherAccount: mocks.deactivateTeacherAccount,
  resetTeacherPassword: mocks.resetTeacherPassword,
}));

import { GET as listTeachers, POST as createTeacher } from "@/app/api/v1/admin/teachers/route";
import { POST as disableTeacher } from "@/app/api/v1/admin/teachers/[id]/disable/route";
import { POST as resetTeacherPassword } from "@/app/api/v1/admin/teachers/[id]/reset-password/route";

const baseUser = {
  id: "user-1",
  username: "account",
  displayName: "Account",
  enabled: true,
  mustChangePassword: false,
  sessionVersion: 0,
  studentStatus: null,
  isLongTerm: false,
  validFrom: null,
  validUntil: null,
  accessErrorCode: null,
};
const administrator = { ...baseUser, role: "ADMIN" as const, capability: "FULL_ADMIN" as const };
const teacher = { ...baseUser, role: "TEACHER" as const, capability: "FULL_TEACHER" as const };
const student = { ...baseUser, role: "STUDENT" as const, capability: "FULL_STUDENT" as const, studentStatus: "ACTIVE" as const };
const mutationHeaders = { "content-type": "application/json", origin: "http://localhost", host: "localhost" };

function createRequest() {
  return new Request("http://localhost/api/v1/admin/teachers", { method: "POST", headers: mutationHeaders, body: JSON.stringify({ username: "teacher.radio", displayName: "王老师" }) });
}

function routeContext() { return { params: Promise.resolve({ id: "teacher-1" }) }; }

describe("administrator teacher account routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.listTeachers.mockResolvedValue([]);
    mocks.createTeacherAccount.mockResolvedValue({ teacher: { id: "teacher-1", username: "teacher.radio", displayName: "王老师", enabled: true }, temporaryPassword: "TemporaryPassword123!" });
    mocks.deactivateTeacherAccount.mockResolvedValue({ disabled: true });
    mocks.resetTeacherPassword.mockResolvedValue({ temporaryPassword: "TemporaryPassword123!" });
  });

  it("allows administrators to list, create, disable, and reset teacher accounts", async () => {
    mocks.getCurrentUser.mockResolvedValue(administrator);

    expect((await listTeachers()).status).toBe(200);
    expect((await createTeacher(createRequest())).status).toBe(201);
    expect((await disableTeacher(new Request("http://localhost/api/v1/admin/teachers/teacher-1/disable", { method: "POST", headers: mutationHeaders }), routeContext())).status).toBe(200);
    expect((await resetTeacherPassword(new Request("http://localhost/api/v1/admin/teachers/teacher-1/reset-password", { method: "POST", headers: mutationHeaders }), routeContext())).status).toBe(200);

    expect(mocks.createTeacherAccount).toHaveBeenCalledWith(administrator.id, { username: "teacher.radio", displayName: "王老师" });
    expect(mocks.deactivateTeacherAccount).toHaveBeenCalledWith(administrator.id, "teacher-1");
    expect(mocks.resetTeacherPassword).toHaveBeenCalledWith(administrator.id, "teacher-1");
  });

  it("rejects teachers and students at every teacher-account administration endpoint", async () => {
    for (const user of [teacher, student]) {
      mocks.getCurrentUser.mockResolvedValue(user);
      expect((await listTeachers()).status).toBe(403);
      expect((await createTeacher(createRequest())).status).toBe(403);
      expect((await disableTeacher(new Request("http://localhost/api/v1/admin/teachers/teacher-1/disable", { method: "POST", headers: mutationHeaders }), routeContext())).status).toBe(403);
      expect((await resetTeacherPassword(new Request("http://localhost/api/v1/admin/teachers/teacher-1/reset-password", { method: "POST", headers: mutationHeaders }), routeContext())).status).toBe(403);
    }
  });
});
