import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdministrator: vi.fn(), assertSameOrigin: vi.fn(), listStudents: vi.fn() }));
vi.mock("@/lib/server/api", () => ({ requireAdministrator: mocks.requireAdministrator, apiErrorResponse: vi.fn((error: unknown) => new Response(JSON.stringify({ message: error instanceof Error ? error.message : "error" }), { status: 500 })) }));
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/server/student-account-service", () => ({ listStudents: mocks.listStudents }));

import { GET } from "@/app/api/v1/admin/students/route";

describe("administrator student account list route", () => {
  beforeEach(() => { mocks.requireAdministrator.mockReset(); mocks.listStudents.mockReset(); mocks.listStudents.mockResolvedValue({ items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } }); });

  it("passes validated server-side paging, search, and status filters to the service", async () => {
    expect((await GET(new Request("http://localhost/api/v1/admin/students?page=2&pageSize=200&search=%E5%BC%A0%E4%B8%89&status=ACTIVE"))).status).toBe(200);
    expect(mocks.listStudents).toHaveBeenCalledWith({ page: 2, pageSize: 100, search: "张三", status: "ACTIVE" });
  });

  it("defaults malformed query parameters without passing an unsupported status", async () => {
    await GET(new Request("http://localhost/api/v1/admin/students?page=0&pageSize=wat&status=DISABLED"));
    expect(mocks.listStudents).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: undefined, status: undefined });
  });
});
