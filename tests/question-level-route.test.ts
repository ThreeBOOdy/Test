import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  assignQuestionLevels: vi.fn(),
  removeQuestionLevels: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireTeacher: mocks.requireTeacher };
});
vi.mock("@/lib/server/question-level-service", () => ({
  assignQuestionLevels: mocks.assignQuestionLevels,
  removeQuestionLevels: mocks.removeQuestionLevels,
}));

import { POST as assignSingle } from "@/app/api/v1/teacher/questions/[id]/levels/route";
import { POST as removeSingle } from "@/app/api/v1/teacher/questions/[id]/levels/remove/route";
import { POST as assignBatch } from "@/app/api/v1/teacher/questions/levels/batch/route";
import { POST as removeBatch } from "@/app/api/v1/teacher/questions/levels/remove/route";
import { ApiError } from "@/lib/domain/api-error";

const baseUser = { id: "teacher-1", username: "teacher", displayName: "Teacher", enabled: true, mustChangePassword: false, sessionVersion: 0, studentStatus: null, isLongTerm: false, validFrom: null, validUntil: null, accessErrorCode: null };
const teacher = { ...baseUser, role: "TEACHER", capability: "FULL_TEACHER" };

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("question level classification API (S7)", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireTeacher.mockResolvedValue(teacher);
    mocks.assignQuestionLevels.mockResolvedValue({ assigned: 2, skippedDuplicates: 0 });
    mocks.removeQuestionLevels.mockResolvedValue({ removed: 2 });
  });

  it("assigns multiple letter classes through the single-question endpoint", async () => {
    const response = await assignSingle(jsonRequest("http://localhost/api/v1/teacher/questions/q1/levels", "POST", { levelIds: ["level-a", "level-k"] }), { params: Promise.resolve({ id: "q1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ assigned: 2, skippedDuplicates: 0 });
    expect(mocks.assignQuestionLevels).toHaveBeenCalledWith("teacher-1", ["q1"], ["level-a", "level-k"]);
  });

  it("removes letter classes through the single-question endpoint", async () => {
    const response = await removeSingle(jsonRequest("http://localhost/api/v1/teacher/questions/q1/levels/remove", "POST", { levelIds: ["level-a"] }), { params: Promise.resolve({ id: "q1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ removed: 2 });
    expect(mocks.removeQuestionLevels).toHaveBeenCalledWith("teacher-1", ["q1"], ["level-a"]);
  });

  it("batch assigns multiple questions to multiple letter classes", async () => {
    const response = await assignBatch(jsonRequest("http://localhost/api/v1/teacher/questions/levels/batch", "POST", { questionIds: ["q1", "q2"], levelIds: ["level-a", "level-k"] }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ assigned: 2, skippedDuplicates: 0 });
    expect(mocks.assignQuestionLevels).toHaveBeenCalledWith("teacher-1", ["q1", "q2"], ["level-a", "level-k"]);
  });

  it("batch removes a letter class from multiple questions", async () => {
    const response = await removeBatch(jsonRequest("http://localhost/api/v1/teacher/questions/levels/remove", "POST", { questionIds: ["q1", "q2"], levelIds: ["level-a"] }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ removed: 2 });
    expect(mocks.removeQuestionLevels).toHaveBeenCalledWith("teacher-1", ["q1", "q2"], ["level-a"]);
  });

  it("rejects empty levelIds", async () => {
    const response = await assignSingle(jsonRequest("http://localhost/api/v1/teacher/questions/q1/levels", "POST", { levelIds: [] }), { params: Promise.resolve({ id: "q1" }) });

    expect(response.status).toBe(400);
    expect(mocks.assignQuestionLevels).not.toHaveBeenCalled();
  });

  it("rejects empty questionIds in batch assignment", async () => {
    const response = await assignBatch(jsonRequest("http://localhost/api/v1/teacher/questions/levels/batch", "POST", { questionIds: [], levelIds: ["level-a"] }));

    expect(response.status).toBe(400);
    expect(mocks.assignQuestionLevels).not.toHaveBeenCalled();
  });

  it("returns 403 for non-teachers", async () => {
    mocks.requireTeacher.mockRejectedValue(new ApiError("权限不足", 403));
    const response = await assignBatch(jsonRequest("http://localhost/api/v1/teacher/questions/levels/batch", "POST", { questionIds: ["q1"], levelIds: ["level-a"] }));

    expect(response.status).toBe(403);
    expect(mocks.assignQuestionLevels).not.toHaveBeenCalled();
  });
});
