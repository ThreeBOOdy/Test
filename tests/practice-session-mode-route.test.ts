import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  assertSameOrigin: vi.fn(),
  updatePracticeSessionLearningMode: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireActiveStudent: mocks.requireActiveStudent };
});
vi.mock("@/lib/server/http", () => ({ assertSameOrigin: mocks.assertSameOrigin }));
vi.mock("@/lib/server/practice-service", () => ({ updatePracticeSessionLearningMode: mocks.updatePracticeSessionLearningMode }));

import { PATCH } from "@/app/api/v1/practice-sessions/[id]/mode/route";
import { ApiError } from "@/lib/domain/api-error";

const student = { id: "student-1", role: "STUDENT", capability: "FULL_STUDENT" };

function modeRequest(body: unknown) {
  return new Request("http://localhost/api/v1/practice-sessions/session-1/mode", {
    method: "PATCH",
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: JSON.stringify(body),
  });
}

describe("practice session mode API", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireActiveStudent.mockResolvedValue(student);
    mocks.assertSameOrigin.mockReturnValue(undefined);
  });

  it("switches an order session to learning mode", async () => {
    mocks.updatePracticeSessionLearningMode.mockResolvedValue({ learningMode: true });

    const response = await PATCH(modeRequest({ learningMode: true }), { params: Promise.resolve({ id: "session-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ learningMode: true });
    expect(mocks.updatePracticeSessionLearningMode).toHaveBeenCalledWith("student-1", "session-1", true);
  });

  it("switches an order session back to practice mode", async () => {
    mocks.updatePracticeSessionLearningMode.mockResolvedValue({ learningMode: false });

    const response = await PATCH(modeRequest({ learningMode: false }), { params: Promise.resolve({ id: "session-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ learningMode: false });
    expect(mocks.updatePracticeSessionLearningMode).toHaveBeenCalledWith("student-1", "session-1", false);
  });

  it("rejects non-order sessions with a clear 409", async () => {
    mocks.updatePracticeSessionLearningMode.mockRejectedValue(new ApiError("当前会话不支持切换学习模式", 409));

    const response = await PATCH(modeRequest({ learningMode: true }), { params: Promise.resolve({ id: "session-1" }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: "当前会话不支持切换学习模式" });
  });

  it("requires a boolean learningMode field", async () => {
    const response = await PATCH(modeRequest({ learningMode: "yes" }), { params: Promise.resolve({ id: "session-1" }) });

    expect(response.status).toBe(400);
    expect(mocks.updatePracticeSessionLearningMode).not.toHaveBeenCalled();
  });
});
