import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  assertSameOrigin: vi.fn(),
  createPracticeSession: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireActiveStudent: mocks.requireActiveStudent };
});
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/server/practice-service", () => ({ createPracticeSession: mocks.createPracticeSession }));

import { POST } from "@/app/api/v1/practice-sessions/route";
import { ApiError } from "@/lib/domain/api-error";

const student = { id: "student-1", role: "STUDENT", capability: "FULL_STUDENT" };

function practiceRequest(levelCode = "A") {
  return new Request("http://localhost/api/v1/practice-sessions", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: JSON.stringify({ mode: "level", levelCode }),
  });
}

describe("practice-sessions API activeLevel guard", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireActiveStudent.mockResolvedValue(student);
    mocks.assertSameOrigin.mockReturnValue(undefined);
  });

  it("returns a clear 403 when the student has no assigned activeLevel", async () => {
    mocks.createPracticeSession.mockRejectedValue(new ApiError("未分配题库，请联系老师", 403));

    const response = await POST(practiceRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "未分配题库，请联系老师" });
    expect(mocks.createPracticeSession).toHaveBeenCalledWith("student-1", { mode: "level", levelCode: "A" });
  });

  it("returns a clear 403 when the requested level differs from the activeLevel", async () => {
    mocks.createPracticeSession.mockRejectedValue(new ApiError("只能练习当前分配的字母类", 403));

    const response = await POST(practiceRequest("B"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "只能练习当前分配的字母类" });
    expect(mocks.createPracticeSession).toHaveBeenCalledWith("student-1", { mode: "level", levelCode: "B" });
  });

  it("creates a session when the activeLevel matches", async () => {
    mocks.createPracticeSession.mockResolvedValue({ id: "session-1" });

    const response = await POST(practiceRequest());

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "session-1" });
  });

  it("creates a mock exam session with an optional blueprint id", async () => {
    mocks.createPracticeSession.mockResolvedValue({ id: "session-1" });
    const request = new Request("http://localhost/api/v1/practice-sessions", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ mode: "exam", levelCode: "A", blueprintId: "blueprint-1" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mocks.createPracticeSession).toHaveBeenCalledWith("student-1", { mode: "exam", levelCode: "A", blueprintId: "blueprint-1" });
  });

  it("creates a mock exam session with the default blueprint when blueprint id is omitted", async () => {
    mocks.createPracticeSession.mockResolvedValue({ id: "session-1" });
    const request = new Request("http://localhost/api/v1/practice-sessions", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ mode: "exam", levelCode: "A" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mocks.createPracticeSession).toHaveBeenCalledWith("student-1", { mode: "exam", levelCode: "A" });
  });
});
