import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  assertSameOrigin: vi.fn(),
  listRegistrationReviews: vi.fn(),
  approveRegistrations: vi.fn(),
  getBusinessDate: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/server/student-account-service", () => ({
  listRegistrationReviews: mocks.listRegistrationReviews,
  approveRegistrations: mocks.approveRegistrations,
}));
vi.mock("@/lib/server/time", () => ({ getBusinessDate: mocks.getBusinessDate }));

import { GET as listRegistrations } from "@/app/api/v1/admin/registrations/route";
import { POST as bulkApprove } from "@/app/api/v1/admin/registrations/bulk-approve/route";

const administrator = { id: "admin-1", username: "admin", displayName: "管理员", role: "ADMIN" as const, capability: "FULL_ADMIN" as const, enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const teacher = { ...administrator, role: "TEACHER" as const, capability: "FULL_TEACHER" as const };
const headers = { "content-type": "application/json", origin: "http://localhost", host: "localhost" };

describe("administrator registration review routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.listRegistrationReviews.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    mocks.approveRegistrations.mockResolvedValue({ approved: 2 });
    mocks.getBusinessDate.mockReturnValue("2026-07-30");
  });

  it("uses server pagination, search, and status filtering", async () => {
    mocks.getCurrentUser.mockResolvedValue(administrator);
    const response = await listRegistrations(new Request("http://localhost/api/v1/admin/registrations?page=2&pageSize=50&status=REJECTED&search=%E5%BC%A0%E4%B8%89"));

    expect(response.status).toBe(200);
    expect(mocks.listRegistrationReviews).toHaveBeenCalledWith({ page: 2, pageSize: 50, status: "REJECTED", search: "张三" });
  });

  it("rejects page sizes above 100 and non-administrators", async () => {
    mocks.getCurrentUser.mockResolvedValue(administrator);
    expect((await listRegistrations(new Request("http://localhost/api/v1/admin/registrations?pageSize=101"))).status).toBe(400);

    mocks.getCurrentUser.mockResolvedValue(teacher);
    expect((await listRegistrations(new Request("http://localhost/api/v1/admin/registrations"))).status).toBe(403);
  });

  it("passes all bulk targets into one transactional service call", async () => {
    mocks.getCurrentUser.mockResolvedValue(administrator);
    const request = new Request("http://localhost/api/v1/admin/registrations/bulk-approve", { method: "POST", headers, body: JSON.stringify({ ids: ["student-1", "student-2"] }) });

    expect((await bulkApprove(request)).status).toBe(200);
    expect(mocks.approveRegistrations).toHaveBeenCalledWith("admin-1", ["student-1", "student-2"], "2026-07-30");
  });

  it("rejects duplicate bulk targets before calling the service", async () => {
    mocks.getCurrentUser.mockResolvedValue(administrator);
    const request = new Request("http://localhost/api/v1/admin/registrations/bulk-approve", { method: "POST", headers, body: JSON.stringify({ ids: ["student-1", "student-1"] }) });

    expect((await bulkApprove(request)).status).toBe(400);
    expect(mocks.approveRegistrations).not.toHaveBeenCalled();
  });
});
