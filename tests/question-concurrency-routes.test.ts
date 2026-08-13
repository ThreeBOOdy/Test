import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  questionFindFirst: vi.fn(),
  questionUpdateMany: vi.fn(),
  questionRevisionFindFirst: vi.fn(),
  questionRevisionCreate: vi.fn(),
  levelFindFirst: vi.fn(),
  knowledgePointFindFirst: vi.fn(),
  knowledgePointUpdateMany: vi.fn(),
  levelRuleUpdateMany: vi.fn(),
  questionCount: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/audit", () => ({ writeAuditLogInTransaction: mocks.audit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    question: { findFirst: mocks.questionFindFirst, count: mocks.questionCount },
    level: { findFirst: mocks.levelFindFirst },
    knowledgePoint: { findFirst: mocks.knowledgePointFindFirst },
    $transaction: vi.fn((callback: (transaction: object) => unknown) => callback({
      question: { findFirst: mocks.questionFindFirst, findFirstOrThrow: mocks.questionFindFirst, updateMany: mocks.questionUpdateMany },
      questionRevision: { findFirst: mocks.questionRevisionFindFirst, create: mocks.questionRevisionCreate },
      knowledgePoint: { findFirst: mocks.knowledgePointFindFirst, updateMany: mocks.knowledgePointUpdateMany, findFirstOrThrow: mocks.knowledgePointFindFirst },
      levelPracticeRule: { updateMany: mocks.levelRuleUpdateMany, findUnique: vi.fn(), create: vi.fn() },
      knowledgePracticeRule: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
      examRule: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    })),
  },
}));

import { PUT as updateQuestion } from "@/app/api/v1/teacher/questions/[id]/route";
import { POST as restoreQuestion } from "@/app/api/v1/teacher/questions/[id]/revisions/[revision]/restore/route";
import { PUT as updateKnowledgePoint } from "@/app/api/v1/teacher/knowledge-points/[id]/route";
import { PUT as savePracticeRules } from "@/app/api/v1/teacher/practice-rules/route";

const headers = { "content-type": "application/json", origin: "http://localhost", host: "localhost" };
const teacher = { id: "teacher-1", role: "TEACHER" as const, capability: "FULL_TEACHER" as const };
const question = { id: "question-1", version: 1, levelId: "level-1", knowledgePointId: "point-1", sourceBankCode: null, externalQuestionCode: null, stem: "原题", type: "SINGLE_CHOICE" as const, optionCount: 2, correctOptionCount: 1, selectionSpec: "2选1", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"], status: "ACTIVE" as const };

function questionRequest(version: number) {
  return new Request("http://localhost/api/v1/teacher/questions/question-1", { method: "PUT", headers, body: JSON.stringify({ levelId: "level-1", knowledgePointId: "point-1", stem: "新题", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"], status: "ACTIVE", version }) });
}

describe("teacher optimistic concurrency routes", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getCurrentUser.mockResolvedValue(teacher);
    mocks.levelFindFirst.mockResolvedValue({ id: "level-1", enabled: true });
    mocks.knowledgePointFindFirst.mockResolvedValue({ id: "point-1", path: "/1.1", enabled: true, version: 1, _count: { children: 0 } });
    mocks.questionFindFirst.mockImplementation((args) => args?.where?.id && typeof args.where.id === "object" ? null : { ...question, version: 2 });
    mocks.questionRevisionCreate.mockResolvedValue({});
    mocks.audit.mockResolvedValue(undefined);
    mocks.questionCount.mockResolvedValue(1);
  });

  it("accepts the first question edit and rejects a concurrent stale edit without another revision", async () => {
    mocks.questionUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    expect((await updateQuestion(questionRequest(1), { params: Promise.resolve({ id: "question-1" }) })).status).toBe(200);
    const stale = await updateQuestion(questionRequest(1), { params: Promise.resolve({ id: "question-1" }) });

    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ message: "数据已被其他教师更新，请刷新后重试" });
    expect(mocks.questionRevisionCreate).toHaveBeenCalledTimes(1);
  });

  it("rejects a stale history restore without creating a new current revision", async () => {
    mocks.questionRevisionFindFirst.mockResolvedValue({ snapshot: { levelId: "level-1", knowledgePointId: "point-1", sourceBankCode: null, externalQuestionCode: null, stem: "历史题", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctOptionIds: ["A"], status: "ACTIVE" } });
    mocks.questionUpdateMany.mockResolvedValue({ count: 0 });

    const response = await restoreQuestion(new Request("http://localhost/api/v1/teacher/questions/question-1/revisions/1/restore", { method: "POST", headers, body: JSON.stringify({ version: 1 }) }), { params: Promise.resolve({ id: "question-1", revision: "1" }) });

    expect(response.status).toBe(409);
    expect(mocks.questionRevisionCreate).not.toHaveBeenCalled();
  });

  it("requires archived questions to be restored through revision history", async () => {
    mocks.questionFindFirst.mockResolvedValue({ ...question, status: "ARCHIVED" });

    const response = await updateQuestion(questionRequest(1), { params: Promise.resolve({ id: "question-1" }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ message: "归档题目必须通过修订历史恢复" });
    expect(mocks.questionUpdateMany).not.toHaveBeenCalled();
  });

  it("accepts the first knowledge point edit and rejects a concurrent stale edit", async () => {
    mocks.knowledgePointUpdateMany.mockImplementation((args) => args.where.id ? Promise.resolve({ count: mocks.knowledgePointUpdateMany.mock.calls.filter(([call]) => call.where.id).length === 1 ? 1 : 0 }) : Promise.resolve({ count: 0 }));
    const request = () => new Request("http://localhost/api/v1/teacher/knowledge-points/point-1", { method: "PUT", headers, body: JSON.stringify({ name: "知识点", sortOrder: 0, enabled: true, version: 1 }) });

    expect((await updateKnowledgePoint(request(), { params: Promise.resolve({ id: "point-1" }) })).status).toBe(200);
    expect((await updateKnowledgePoint(request(), { params: Promise.resolve({ id: "point-1" }) })).status).toBe(409);
  });

  it("accepts the first rule write and rejects a stale rule write", async () => {
    mocks.levelRuleUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const request = () => new Request("http://localhost/api/v1/teacher/practice-rules", { method: "PUT", headers, body: JSON.stringify({ levelRules: [{ levelId: "level-1", singleCount: 1, multipleCount: 0, version: 1 }], knowledgeRules: [], examRules: [] }) });

    expect((await savePracticeRules(request())).status).toBe(200);
    const stale = await savePracticeRules(request());
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ message: "数据已被其他教师更新，请刷新后重试" });
  });
});
