import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkLoginRateLimit: vi.fn(),
  createSessionToken: vi.fn(),
  findUnique: vi.fn(),
  recordLoginAttempt: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/server/password", () => ({ verifyPassword: mocks.verifyPassword }));
vi.mock("@/lib/server/session", () => ({ createSessionToken: mocks.createSessionToken, SESSION_COOKIE: "zhilian_session" }));
vi.mock("@/lib/server/auth-security", () => ({
  checkLoginRateLimit: mocks.checkLoginRateLimit,
  getClientIp: () => "127.0.0.1",
  recordLoginAttempt: mocks.recordLoginAttempt,
}));
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/lib/server/time", () => ({ getBusinessDate: () => "2026-07-26" }));

import { POST } from "@/app/api/v1/auth/login/route";

const baseUser = {
  id: "user-1",
  username: "student",
  displayName: "Student",
  passwordHash: "hash",
  role: "STUDENT",
  enabled: true,
  sessionVersion: 0,
  mustChangePassword: false,
  studentStatus: "ACTIVE",
  isLongTerm: false,
  validFrom: new Date("2026-07-01T00:00:00.000Z"),
  validUntil: new Date("2027-07-01T00:00:00.000Z"),
};

function request() {
  return new Request("http://localhost/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "student", password: "Password123!" }),
  });
}

describe("login account access", () => {
  beforeEach(() => {
    mocks.checkLoginRateLimit.mockResolvedValue(false);
    mocks.createSessionToken.mockResolvedValue("signed-token");
    mocks.findUnique.mockResolvedValue(baseUser);
    mocks.recordLoginAttempt.mockResolvedValue(undefined);
    mocks.verifyPassword.mockReturnValue(true);
  });

  it("creates a restricted session for pending students", async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, studentStatus: "PENDING", validFrom: null, validUntil: null });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({ role: "STUDENT", capability: "REGISTRATION_ONLY" });
    expect(response.headers.get("set-cookie")).toContain("zhilian_session=signed-token");
  });

  it.each([
    [{ enabled: false }, "账号已停用，请联系管理员"],
    [{ validUntil: new Date("2026-07-25T00:00:00.000Z") }, "账号已到期，请联系管理员"],
    [{ validFrom: new Date("2026-07-27T00:00:00.000Z") }, "账号将于 2026-07-27 启用"],
  ])("rejects unusable accounts without issuing a cookie", async (changes, message) => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, ...changes });

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("keeps a password-change-only session for imported accounts", async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, mustChangePassword: true });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({ mustChangePassword: true, capability: null });
    expect(response.headers.get("set-cookie")).toContain("zhilian_session=signed-token");
  });

  it("does not reveal disabled state before password verification succeeds", async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, enabled: false });
    mocks.verifyPassword.mockReturnValue(false);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "用户名或密码错误" });
  });
});
