import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  levelFindMany: vi.fn(),
  knowledgePointFindFirst: vi.fn(),
  questionFindFirst: vi.fn(),
  questionCreate: vi.fn(),
  questionUpdateMany: vi.fn(),
  questionLevelDeleteMany: vi.fn(),
  questionLevelCreateMany: vi.fn(),
  questionFindFirstOrThrow: vi.fn(),
  questionRevisionCreate: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireTeacher: mocks.requireTeacher };
});
vi.mock("@/lib/server/audit", () => ({ writeAuditLogInTransaction: mocks.audit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    level: { findMany: mocks.levelFindMany },
    knowledgePoint: { findFirst: mocks.knowledgePointFindFirst },
    question: { findFirst: mocks.questionFindFirst, create: mocks.questionCreate, updateMany: mocks.questionUpdateMany, findFirstOrThrow: mocks.questionFindFirstOrThrow },
    $transaction: vi.fn((callback: (transaction: object) => unknown) => callback({
      question: { findFirst: mocks.questionFindFirst, create: mocks.questionCreate, updateMany: mocks.questionUpdateMany, findFirstOrThrow: mocks.questionFindFirstOrThrow },
      questionLevel: { deleteMany: mocks.questionLevelDeleteMany, createMany: mocks.questionLevelCreateMany },
      questionRevision: { create: mocks.questionRevisionCreate },
    })),
  },
}));

import { POST as createQuestion } from "@/app/api/v1/teacher/questions/route";
import { PUT as updateQuestion } from "@/app/api/v1/teacher/questions/[id]/route";

const teacher = { id: "teacher-1", role: "TEACHER", capability: "FULL_TEACHER" };

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    levelIds: ["level-a"],
    knowledgePointId: "point-1",
    stem: "题干",
    options: [{ id: "A", text: "正确" }, { id: "B", text: "错误" }],
    correctOptionIds: ["A"],
    status: "ACTIVE",
    ...overrides,
  };
}

describe("question editor API (S8)", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireTeacher.mockResolvedValue(teacher);
    mocks.audit.mockResolvedValue(undefined);
    mocks.questionRevisionCreate.mockResolvedValue({});
    mocks.questionFindFirst.mockResolvedValue({ id: "question-1", status: "ACTIVE", levels: [{ levelId: "level-a" }] });
    mocks.knowledgePointFindFirst.mockResolvedValue({ id: "point-1", enabled: true, _count: { children: 0 } });
    mocks.questionCreate.mockResolvedValue({ id: "question-1", version: 1 });
    mocks.questionFindFirstOrThrow.mockResolvedValue({ id: "question-1", version: 2 });
  });

  it("creates a question with multiple letter classes", async () => {
    mocks.levelFindMany.mockResolvedValue([{ id: "level-a", enabled: true }, { id: "level-k", enabled: true }]);

    const response = await createQuestion(jsonRequest("http://localhost/api/v1/teacher/questions", "POST", validBody({ levelIds: ["level-a", "level-k"] })));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "question-1", version: 1 });
    expect(mocks.questionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        levels: { create: [{ levelId: "level-a" }, { levelId: "level-k" }] },
      }),
    }));
  });

  it("creates an unclassified public-pool question when levelIds is empty", async () => {
    mocks.levelFindMany.mockResolvedValue([]);

    const response = await createQuestion(jsonRequest("http://localhost/api/v1/teacher/questions", "POST", validBody({ levelIds: [] })));

    expect(response.status).toBe(201);
    const call = mocks.questionCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.levels).toBeUndefined();
  });

  it("rejects a non-leaf knowledge point on create", async () => {
    mocks.levelFindMany.mockResolvedValue([{ id: "level-a", enabled: true }]);
    mocks.knowledgePointFindFirst.mockResolvedValue({ id: "point-1", enabled: true, _count: { children: 1 } });

    const response = await createQuestion(jsonRequest("http://localhost/api/v1/teacher/questions", "POST", validBody()));

    expect(response.status).toBe(400);
    expect(mocks.questionCreate).not.toHaveBeenCalled();
  });

  it("replaces letter classes with the selected multi-select set on update", async () => {
    mocks.levelFindMany.mockResolvedValue([{ id: "level-a", enabled: true }, { id: "level-k", enabled: true }]);
    mocks.questionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.questionLevelDeleteMany.mockResolvedValue({ count: 1 });
    mocks.questionLevelCreateMany.mockResolvedValue({ count: 2 });

    const response = await updateQuestion(
      jsonRequest("http://localhost/api/v1/teacher/questions/question-1", "PUT", validBody({ levelIds: ["level-a", "level-k"], version: 1 })),
      { params: Promise.resolve({ id: "question-1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true, version: 2 });
    expect(mocks.questionLevelDeleteMany).toHaveBeenCalledWith({ where: { questionId: "question-1" } });
    expect(mocks.questionLevelCreateMany).toHaveBeenCalledWith({
      data: [
        { questionId: "question-1", levelId: "level-a" },
        { questionId: "question-1", levelId: "level-k" },
      ],
      skipDuplicates: true,
    });
  });

  it("clears all letter classes when the edit form leaves the selection empty", async () => {
    mocks.levelFindMany.mockResolvedValue([]);
    mocks.questionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.questionLevelDeleteMany.mockResolvedValue({ count: 1 });

    const response = await updateQuestion(
      jsonRequest("http://localhost/api/v1/teacher/questions/question-1", "PUT", validBody({ levelIds: [], version: 1 })),
      { params: Promise.resolve({ id: "question-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.questionLevelDeleteMany).toHaveBeenCalledWith({ where: { questionId: "question-1" } });
    expect(mocks.questionLevelCreateMany).not.toHaveBeenCalled();
  });

  it("keeps a disabled letter class that is already assigned on update", async () => {
    mocks.questionFindFirst.mockResolvedValue({ id: "question-1", status: "ACTIVE", levels: [{ levelId: "level-a" }] });
    mocks.levelFindMany.mockResolvedValue([{ id: "level-a", enabled: false }]);
    mocks.questionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.questionLevelDeleteMany.mockResolvedValue({ count: 1 });
    mocks.questionLevelCreateMany.mockResolvedValue({ count: 1 });

    const response = await updateQuestion(
      jsonRequest("http://localhost/api/v1/teacher/questions/question-1", "PUT", validBody({ levelIds: ["level-a"], version: 1 })),
      { params: Promise.resolve({ id: "question-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.questionUpdateMany).toHaveBeenCalled();
  });

  it("rejects a disabled letter class that was not already assigned", async () => {
    mocks.questionFindFirst.mockResolvedValue({ id: "question-1", status: "ACTIVE", levels: [{ levelId: "level-a" }] });
    mocks.levelFindMany.mockResolvedValue([{ id: "level-k", enabled: false }]);
    mocks.questionUpdateMany.mockResolvedValue({ count: 1 });

    const response = await updateQuestion(
      jsonRequest("http://localhost/api/v1/teacher/questions/question-1", "PUT", validBody({ levelIds: ["level-k"], version: 1 })),
      { params: Promise.resolve({ id: "question-1" }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.questionUpdateMany).not.toHaveBeenCalled();
  });
});
