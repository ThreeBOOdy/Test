import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getStudentImport: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/student-import-service", () => ({ getStudentImport: mocks.getStudentImport }));

import { GET } from "@/app/api/v1/admin/student-imports/[id]/route";

const administrator = { id: "admin-1", username: "admin", displayName: "管理员", role: "ADMIN" as const, capability: "FULL_ADMIN" as const, enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };

function context() {
  return { params: Promise.resolve({ id: "batch-1" }) };
}

describe("student import preflight route", () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset();
    mocks.getStudentImport.mockReset();
    mocks.getCurrentUser.mockResolvedValue(administrator);
    mocks.getStudentImport.mockResolvedValue({ id: "batch-1", page: 2, pageSize: 50, totalPages: 3, rows: [] });
  });

  it("forwards pagination query parameters to the server-side preflight service", async () => {
    const response = await GET(new Request("http://localhost/api/v1/admin/student-imports/batch-1?page=2&pageSize=50"), context());

    expect(response.status).toBe(200);
    expect(mocks.getStudentImport).toHaveBeenCalledWith("admin-1", "batch-1", { page: 2, pageSize: 50 });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("leaves pagination defaults to the service and rejects non-administrators", async () => {
    expect((await GET(new Request("http://localhost/api/v1/admin/student-imports/batch-1"), context())).status).toBe(200);
    expect(mocks.getStudentImport).toHaveBeenCalledWith("admin-1", "batch-1", {});

    mocks.getCurrentUser.mockResolvedValue({ ...administrator, role: "TEACHER", capability: "FULL_TEACHER" });
    expect((await GET(new Request("http://localhost/api/v1/admin/student-imports/batch-1"), context())).status).toBe(403);
  });
});
