import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  assertSameOrigin: vi.fn(),
  apiErrorResponse: vi.fn((error: unknown) => new Response(JSON.stringify({ message: error instanceof Error ? error.message : "error" }), { status: 500 })),
  getPracticeSession: vi.fn(),
  saveExamDraft: vi.fn(),
}));

vi.mock("@/lib/server/api", () => ({ requireActiveStudent: mocks.requireActiveStudent, apiErrorResponse: mocks.apiErrorResponse }));
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/server/practice-service", () => ({ getPracticeSession: mocks.getPracticeSession, saveExamDraft: mocks.saveExamDraft }));

import { GET, PUT } from "@/app/api/v1/practice-sessions/[id]/draft/route";

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.requireActiveStudent.mockResolvedValue({ id: "student-1" });
  mocks.getPracticeSession.mockResolvedValue({ mode: "MOCK_EXAM", draft: { answers: { "question-1": ["A"] }, currentIndex: 1, version: 4, updatedAt: "2026-07-31T00:00:00.000Z" } });
  mocks.saveExamDraft.mockResolvedValue({ answers: {}, currentIndex: 0, version: 5, updatedAt: "2026-07-31T00:00:00.000Z" });
});

describe("exam draft route", () => {
  it("returns the latest draft without grading data", async () => {
    const response = await GET(new Request("http://localhost/api/v1/practice-sessions/session-1/draft"), { params: Promise.resolve({ id: "session-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ version: 4, currentIndex: 1 });
    expect(mocks.getPracticeSession).toHaveBeenCalledWith("student-1", "session-1");
  });

  it("passes the client version to the save service", async () => {
    const response = await PUT(new Request("http://localhost/api/v1/practice-sessions/session-1/draft", { method: "PUT", headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" }, body: JSON.stringify({ answers: { "question-1": ["A"] }, currentIndex: 0, version: 4 }) }), { params: Promise.resolve({ id: "session-1" }) });
    expect(response.status).toBe(200);
    expect(mocks.saveExamDraft).toHaveBeenCalledWith("student-1", "session-1", { answers: { "question-1": ["A"] }, currentIndex: 0, version: 4 });
  });
});
