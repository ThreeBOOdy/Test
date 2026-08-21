import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  assertSameOrigin: vi.fn(),
  setStudentQuestionState: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireActiveStudent: mocks.requireActiveStudent };
});
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/server/student-question-state-service", () => ({ setStudentQuestionState: mocks.setStudentQuestionState }));

import { PATCH } from "@/app/api/v1/student/question-states/[questionId]/route";
import { ApiError } from "@/lib/domain/api-error";

const student = { id: "student-1", role: "STUDENT", capability: "FULL_STUDENT" };

function stateRequest(body: unknown) {
  return new Request("http://localhost/api/v1/student/question-states/q1", {
    method: "PATCH",
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: JSON.stringify(body),
  });
}

describe("student question state API", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireActiveStudent.mockResolvedValue(student);
    mocks.assertSameOrigin.mockReturnValue(undefined);
    mocks.setStudentQuestionState.mockResolvedValue({
      questionId: "q1",
      levelId: "level-a",
      levelCode: "A",
      favorite: true,
      ignored: false,
    });
  });

  it("sets favorite for the current student active level and question", async () => {
    const response = await PATCH(stateRequest({ favorite: true }), { params: Promise.resolve({ questionId: "q1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      questionId: "q1",
      levelId: "level-a",
      levelCode: "A",
      favorite: true,
      ignored: false,
    });
    expect(mocks.setStudentQuestionState).toHaveBeenCalledWith("student-1", "q1", { favorite: true });
  });

  it("cancels ignored for the current student active level and question", async () => {
    mocks.setStudentQuestionState.mockResolvedValue({
      questionId: "q1",
      levelId: "level-a",
      levelCode: "A",
      favorite: false,
      ignored: false,
    });

    const response = await PATCH(stateRequest({ ignored: false }), { params: Promise.resolve({ questionId: "q1" }) });

    expect(response.status).toBe(200);
    expect(mocks.setStudentQuestionState).toHaveBeenCalledWith("student-1", "q1", { ignored: false });
  });

  it("updates favorite and ignored together for the current active level", async () => {
    mocks.setStudentQuestionState.mockResolvedValue({
      questionId: "q1",
      levelId: "level-a",
      levelCode: "A",
      favorite: true,
      ignored: true,
    });

    const response = await PATCH(stateRequest({ favorite: true, ignored: true }), { params: Promise.resolve({ questionId: "q1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      questionId: "q1",
      levelId: "level-a",
      levelCode: "A",
      favorite: true,
      ignored: true,
    });
    expect(mocks.setStudentQuestionState).toHaveBeenCalledWith("student-1", "q1", { favorite: true, ignored: true });
  });

  it("rejects a body with neither favorite nor ignored", async () => {
    const response = await PATCH(stateRequest({}), { params: Promise.resolve({ questionId: "q1" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "至少提供 favorite 或 ignored 字段" });
    expect(mocks.setStudentQuestionState).not.toHaveBeenCalled();
  });

  it("rejects unknown fields", async () => {
    const response = await PATCH(stateRequest({ favorite: true, other: 1 }), { params: Promise.resolve({ questionId: "q1" }) });

    expect(response.status).toBe(400);
    expect(mocks.setStudentQuestionState).not.toHaveBeenCalled();
  });

  it("propagates service errors such as unassigned active level", async () => {
    mocks.setStudentQuestionState.mockRejectedValue(new ApiError("未分配题库，请联系老师", 403));

    const response = await PATCH(stateRequest({ favorite: true }), { params: Promise.resolve({ questionId: "q1" }) });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "未分配题库，请联系老师" });
  });
});
