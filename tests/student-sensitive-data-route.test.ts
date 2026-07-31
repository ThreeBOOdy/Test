import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  apiErrorResponse: vi.fn((error: unknown) => new Response(JSON.stringify({ message: error instanceof Error ? error.message : "error" }), { status: 500 })),
  assertSameOrigin: vi.fn(),
  getClientIp: vi.fn(() => "192.0.2.10"),
  reauthenticateCurrentAdministrator: vi.fn(),
  hasRecentCurrentAdministratorReauthentication: vi.fn(),
  revealStudentSensitiveField: vi.fn(),
  writeAuditLog: vi.fn(),
  checkSensitiveDataReauthenticationRateLimit: vi.fn(),
  recordSensitiveDataReauthenticationAttempt: vi.fn(),
}));

vi.mock("@/lib/server/api", () => ({ requireAdministrator: mocks.requireAdministrator, apiErrorResponse: mocks.apiErrorResponse }));
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/server/auth-security", () => ({ getClientIp: mocks.getClientIp, checkSensitiveDataReauthenticationRateLimit: mocks.checkSensitiveDataReauthenticationRateLimit, recordSensitiveDataReauthenticationAttempt: mocks.recordSensitiveDataReauthenticationAttempt }));
vi.mock("@/lib/server/session", () => ({ reauthenticateCurrentAdministrator: mocks.reauthenticateCurrentAdministrator, hasRecentCurrentAdministratorReauthentication: mocks.hasRecentCurrentAdministratorReauthentication }));
vi.mock("@/lib/server/student-account-service", () => ({ revealStudentSensitiveField: mocks.revealStudentSensitiveField }));
vi.mock("@/lib/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { GET, POST } from "@/app/api/v1/admin/students/[id]/sensitive-data/route";

const administrator = { id: "admin-1", role: "ADMIN", capability: "FULL_ADMIN" };
const context = { params: Promise.resolve({ id: "student-1" }) };

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.requireAdministrator.mockResolvedValue(administrator);
  mocks.getClientIp.mockReturnValue("192.0.2.10");
  mocks.reauthenticateCurrentAdministrator.mockResolvedValue(true);
  mocks.checkSensitiveDataReauthenticationRateLimit.mockResolvedValue(false);
  mocks.recordSensitiveDataReauthenticationAttempt.mockResolvedValue(undefined);
  mocks.hasRecentCurrentAdministratorReauthentication.mockResolvedValue(true);
  mocks.revealStudentSensitiveField.mockResolvedValue({ field: "nationalId", value: "11010519491231002X" });
  mocks.writeAuditLog.mockResolvedValue(undefined);
});

describe("administrator sensitive student data route", () => {
  it("requires password reauthentication before a sensitive value can be read", async () => {
    mocks.hasRecentCurrentAdministratorReauthentication.mockResolvedValue(false);

    const response = await GET(new Request("http://localhost/api/v1/admin/students/student-1/sensitive-data?field=nationalId"), context);

    expect(response.status).toBe(403);
    expect(mocks.revealStudentSensitiveField).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: "admin-1", targetId: "student-1", action: "STUDENT_SENSITIVE_DATA_VIEW", metadata: expect.objectContaining({ field: "nationalId", source: "192.0.2.10", result: "REAUTH_REQUIRED" }) }));
  });

  it("revalidates the password and exposes only the requested sensitive field", async () => {
    const post = await POST(new Request("http://localhost/api/v1/admin/students/student-1/sensitive-data", { method: "POST", headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" }, body: JSON.stringify({ password: "correct-password" }) }));
    const get = await GET(new Request("http://localhost/api/v1/admin/students/student-1/sensitive-data?field=nationalId"), context);

    expect(post.status).toBe(200);
    expect(get.status).toBe(200);
    expect(mocks.reauthenticateCurrentAdministrator).toHaveBeenCalledWith("correct-password");
    expect(mocks.recordSensitiveDataReauthenticationAttempt).toHaveBeenCalledWith("admin-1", "192.0.2.10", true);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "STUDENT_SENSITIVE_DATA_REAUTH", metadata: expect.objectContaining({ result: "SUCCESS" }) }));
    expect(mocks.revealStudentSensitiveField).toHaveBeenCalledWith({ administratorId: "admin-1", studentId: "student-1", field: "nationalId", source: "192.0.2.10" });
  });

  it("rate limits reauthentication attempts before checking a password", async () => {
    mocks.checkSensitiveDataReauthenticationRateLimit.mockResolvedValue(true);

    const response = await POST(new Request("http://localhost/api/v1/admin/students/student-1/sensitive-data", { method: "POST", headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" }, body: JSON.stringify({ password: "password" }) }));

    expect(response.status).toBe(429);
    expect(mocks.reauthenticateCurrentAdministrator).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "STUDENT_SENSITIVE_DATA_REAUTH", metadata: expect.objectContaining({ result: "RATE_LIMITED" }) }));
  });
  it("does not permit teachers to reauthenticate or read the original value", async () => {
    mocks.requireAdministrator.mockRejectedValue(new Error("权限不足"));

    expect((await POST(new Request("http://localhost/api/v1/admin/students/student-1/sensitive-data", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "password" }) }))).status).toBe(500);
    expect((await GET(new Request("http://localhost/api/v1/admin/students/student-1/sensitive-data?field=phone"), context)).status).toBe(500);
    expect(mocks.reauthenticateCurrentAdministrator).not.toHaveBeenCalled();
    expect(mocks.revealStudentSensitiveField).not.toHaveBeenCalled();
  });
});
