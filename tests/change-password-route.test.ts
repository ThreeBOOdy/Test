import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  getCurrentUser: vi.fn(),
  revokeUserSessions: vi.fn(),
  setSessionCookie: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    $transaction: vi.fn((callback) => callback({ user: { update: mocks.userUpdate } })),
  },
}));
vi.mock("@/lib/server/password", () => ({ hashPassword: vi.fn(() => "new-hash"), verifyPassword: mocks.verifyPassword }));
vi.mock("@/lib/server/session", () => ({
  createSession: mocks.createSession,
  getCurrentUser: mocks.getCurrentUser,
  revokeUserSessions: mocks.revokeUserSessions,
  setSessionCookie: mocks.setSessionCookie,
}));
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: vi.fn() }));

import { POST } from "@/app/api/v1/auth/change-password/route";

const teacher = { id: "teacher-1", username: "teacher", role: "TEACHER", passwordHash: "old-hash" };

function request(newPassword: string) {
  return new Request("http://localhost/api/v1/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: "OldPassword123!", newPassword }),
  });
}

describe("change password route", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getCurrentUser.mockResolvedValue({ id: teacher.id });
    mocks.userFindUnique.mockResolvedValue(teacher);
    mocks.verifyPassword.mockReturnValue(true);
    mocks.userUpdate.mockResolvedValue({ ...teacher, mustChangePassword: false, sessionVersion: 1 });
    mocks.createSession.mockResolvedValue("replacement-token");
    mocks.setSessionCookie.mockImplementation((response, token) => response.cookies.set("zhilian_session", token, { httpOnly: true }));
  });

  it("rejects a staff password shorter than twelve characters", async () => {
    const response = await POST(request("Student8"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "教师和管理员密码至少需要 12 位" });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("revokes concurrent sessions before issuing a replacement session", async () => {
    const response = await POST(request("StaffPassword12!"));

    expect(response.status).toBe(200);
    expect(mocks.revokeUserSessions).toHaveBeenCalledWith(teacher.id, expect.anything());
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ id: teacher.id }));
    expect(response.headers.get("set-cookie")).toContain("zhilian_session=replacement-token");
  });
});
