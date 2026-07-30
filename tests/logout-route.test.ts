import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), clearSessionCookie: vi.fn(), revokeSession: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/server/session", () => ({ SESSION_COOKIE: "zhilian_session", clearSessionCookie: mocks.clearSessionCookie, revokeSession: mocks.revokeSession }));
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: vi.fn() }));

import { POST } from "@/app/api/v1/auth/logout/route";

describe("logout route", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.cookies.mockResolvedValue({ get: vi.fn(() => ({ value: "opaque-token" })) });
    mocks.clearSessionCookie.mockImplementation((response) => response.cookies.set("zhilian_session", "", { maxAge: 0 }));
  });

  it("revokes the server-side token before clearing the browser cookie", async () => {
    const response = await POST(new Request("http://localhost/api/v1/auth/logout", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(mocks.revokeSession).toHaveBeenCalledWith("opaque-token");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
