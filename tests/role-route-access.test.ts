import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listStudents: vi.fn(),
  listRegistrationReviews: vi.fn(),
  importBatchFindMany: vi.fn(),
  importBatchCount: vi.fn(),
  createPracticeSession: vi.fn(),
  commitImportBatch: vi.fn(),
  getImportBatchReport: vi.fn(),
  revertImportBatch: vi.fn(),
  approveRegistration: vi.fn(),
  writeAuditLog: vi.fn(),
  writeAuditLogInTransaction: vi.fn(),
  ensureKnowledgePoint: vi.fn(),
  getOrCreateDefaultKnowledgePointType: vi.fn(),
  levelFindMany: vi.fn(),
  knowledgePointFindFirst: vi.fn(),
  knowledgePointFindUnique: vi.fn(),
  questionFindFirst: vi.fn(),
  questionCreate: vi.fn(),
  questionRevisionCreate: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("@/lib/server/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/server/student-account-service", () => ({
  listStudents: mocks.listStudents,
  listRegistrationReviews: mocks.listRegistrationReviews,
  approveRegistration: mocks.approveRegistration,
}));
vi.mock("@/lib/server/practice-service", () => ({ createPracticeSession: mocks.createPracticeSession }));
vi.mock("@/lib/server/import-service", () => ({
  commitImportBatch: mocks.commitImportBatch,
  getImportBatchReport: mocks.getImportBatchReport,
  revertImportBatch: mocks.revertImportBatch,
}));
vi.mock("@/lib/server/audit", () => ({ writeAuditLog: mocks.writeAuditLog, writeAuditLogInTransaction: mocks.writeAuditLogInTransaction }));
vi.mock("@/lib/server/knowledge-service", () => ({ ensureKnowledgePoint: mocks.ensureKnowledgePoint, getOrCreateDefaultKnowledgePointType: mocks.getOrCreateDefaultKnowledgePointType }));
vi.mock("@/lib/db", () => ({
  prisma: {
    importBatch: { findMany: mocks.importBatchFindMany, count: mocks.importBatchCount },
    level: { findMany: mocks.levelFindMany },
    knowledgePoint: { findFirst: mocks.knowledgePointFindFirst, findUnique: mocks.knowledgePointFindUnique },
    question: { findFirst: mocks.questionFindFirst, create: mocks.questionCreate, count: vi.fn() },
    $transaction: vi.fn((input: ((transaction: object) => unknown) | Promise<unknown>[]) => Array.isArray(input) ? Promise.all(input) : input({
      question: { findFirst: mocks.questionFindFirst, create: mocks.questionCreate },
      questionRevision: { create: mocks.questionRevisionCreate },
      knowledgePoint: { findFirst: mocks.knowledgePointFindFirst, findUnique: mocks.knowledgePointFindUnique },
      auditLog: { create: mocks.auditLogCreate },
    })),
  },
}));

import { GET as listRegistrations } from "@/app/api/v1/admin/registrations/route";
import { POST as approveRegistration } from "@/app/api/v1/admin/registrations/[id]/approve/route";
import { GET as listStudents } from "@/app/api/v1/admin/students/route";
import { GET as listImportBatches } from "@/app/api/v1/teacher/import-batches/route";
import { GET as getImportBatch } from "@/app/api/v1/teacher/import-batches/[id]/route";
import { POST as revertImportBatch } from "@/app/api/v1/teacher/import-batches/[id]/revert/route";
import { POST as commitImportBatch } from "@/app/api/v1/teacher/imports/commit/route";
import { POST as previewImportBatch } from "@/app/api/v1/teacher/imports/preview/route";
import { POST as createQuestion } from "@/app/api/v1/teacher/questions/route";
import { PUT as updateQuestion } from "@/app/api/v1/teacher/questions/[id]/route";
import { POST as assignQuestionLevel } from "@/app/api/v1/teacher/questions/[id]/levels/route";
import { POST as removeQuestionLevel } from "@/app/api/v1/teacher/questions/[id]/levels/remove/route";
import { POST as batchAssignQuestionLevels } from "@/app/api/v1/teacher/questions/levels/batch/route";
import { POST as batchRemoveQuestionLevels } from "@/app/api/v1/teacher/questions/levels/remove/route";
import { POST as createKnowledgePoint } from "@/app/api/v1/teacher/knowledge-points/route";
import { PUT as updateKnowledgePoint } from "@/app/api/v1/teacher/knowledge-points/[id]/route";
import { PUT as savePracticeRules } from "@/app/api/v1/teacher/practice-rules/route";
import { POST as createPracticeSession } from "@/app/api/v1/practice-sessions/route";

const baseUser = {
  id: "user-1",
  username: "account",
  displayName: "Account",
  enabled: true,
  mustChangePassword: false,
  sessionVersion: 0,
  studentStatus: null,
  isLongTerm: false,
  validFrom: null,
  validUntil: null,
  accessErrorCode: null,
};

const administrator = { ...baseUser, role: "ADMIN" as const, capability: "FULL_ADMIN" as const };
const teacher = { ...baseUser, role: "TEACHER" as const, capability: "FULL_TEACHER" as const };
const student = { ...baseUser, role: "STUDENT" as const, capability: "FULL_STUDENT" as const, studentStatus: "ACTIVE" as const };

describe("single-role API access", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.listStudents.mockResolvedValue([]);
    mocks.listRegistrationReviews.mockResolvedValue([]);
    mocks.importBatchFindMany.mockResolvedValue([]);
    mocks.importBatchCount.mockResolvedValue(0);
    mocks.createPracticeSession.mockResolvedValue({ id: "session-1" });
    mocks.commitImportBatch.mockResolvedValue({ inserted: 1, skipped: 0 });
    mocks.approveRegistration.mockResolvedValue({ id: "student-1", studentStatus: "ACTIVE" });
    mocks.levelFindMany.mockResolvedValue([{ id: "level-1", enabled: true }]);
    mocks.knowledgePointFindFirst.mockImplementation((args) => (args?.where?.id ? { id: "point-1", enabled: true, _count: { children: 0 } } : null));
    mocks.knowledgePointFindUnique.mockResolvedValue(null);
    mocks.getOrCreateDefaultKnowledgePointType.mockResolvedValue({ id: "type-1" });
    mocks.questionFindFirst.mockResolvedValue(null);
    mocks.questionCreate.mockResolvedValue({ id: "question-1", version: 1, levelId: "level-1", knowledgePointId: "point-1", sourceBankCode: null, externalQuestionCode: null, stem: "题目", options: [], correctOptionIds: [], status: "ACTIVE" });
    mocks.ensureKnowledgePoint.mockResolvedValue({ id: "point-1", typeId: "type-1", version: 1 });
  });

  it("allows only administrators to review registrations", async () => {
    mocks.getCurrentUser.mockResolvedValue(administrator);
    expect((await listRegistrations(new Request("http://localhost/api/v1/admin/registrations"))).status).toBe(200);

    for (const user of [teacher, student]) {
      mocks.getCurrentUser.mockResolvedValue(user);
      expect((await listRegistrations(new Request("http://localhost/api/v1/admin/registrations"))).status).toBe(403);
    }
  });

  it("allows only administrators to read student accounts and approve registrations", async () => {
    const approvalRequest = () => new Request("http://localhost/api/v1/admin/registrations/student-1/approve", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({}),
    });

    mocks.getCurrentUser.mockResolvedValue(administrator);
    expect((await listStudents(new Request("http://localhost/api/v1/admin/students"))).status).toBe(200);
    expect((await approveRegistration(approvalRequest(), { params: Promise.resolve({ id: "student-1" }) })).status).toBe(200);

    for (const user of [teacher, student]) {
      mocks.getCurrentUser.mockResolvedValue(user);
      expect((await listStudents(new Request("http://localhost/api/v1/admin/students"))).status).toBe(403);
      expect((await approveRegistration(approvalRequest(), { params: Promise.resolve({ id: "student-1" }) })).status).toBe(403);
    }
  });

  it("allows only teachers to access teaching import batches", async () => {
    mocks.getCurrentUser.mockResolvedValue(teacher);
    expect((await listImportBatches(new Request("http://localhost/api/v1/teacher/import-batches"))).status).toBe(200);

    for (const user of [administrator, student]) {
      mocks.getCurrentUser.mockResolvedValue(user);
      expect((await listImportBatches(new Request("http://localhost/api/v1/teacher/import-batches"))).status).toBe(403);
    }
  });

  it("allows only teachers to commit question imports", async () => {
    const request = () => new Request("http://localhost/api/v1/teacher/imports/commit", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ batchId: "batch-1" }),
    });

    mocks.getCurrentUser.mockResolvedValue(teacher);
    expect((await commitImportBatch(request())).status).toBe(201);

    for (const user of [administrator, student]) {
      mocks.getCurrentUser.mockResolvedValue(user);
      expect((await commitImportBatch(request())).status).toBe(403);
    }
  });

  it("allows only teachers to create questions, knowledge points, and practice rules", async () => {
    const questionRequest = () => new Request("http://localhost/api/v1/teacher/questions", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ levelIds: ["level-1"], knowledgePointId: "point-1", stem: "题目", options: [{ id: "A", text: "正确" }, { id: "B", text: "错误" }], correctOptionIds: ["A"] }),
    });
    const knowledgeRequest = () => new Request("http://localhost/api/v1/teacher/knowledge-points", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ code: "9.1", name: "测试知识点", sortOrder: 0 }),
    });
    const rulesRequest = () => new Request("http://localhost/api/v1/teacher/practice-rules", {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ levelRules: [], knowledgeRules: [], examRules: [] }),
    });

    mocks.getCurrentUser.mockResolvedValue(teacher);
    expect((await createQuestion(questionRequest())).status).toBe(201);
    expect((await createKnowledgePoint(knowledgeRequest())).status).toBe(201);
    expect((await savePracticeRules(rulesRequest())).status).toBe(200);

    for (const user of [administrator, student]) {
      mocks.getCurrentUser.mockResolvedValue(user);
      expect((await createQuestion(questionRequest())).status).toBe(403);
      expect((await createKnowledgePoint(knowledgeRequest())).status).toBe(403);
      expect((await savePracticeRules(rulesRequest())).status).toBe(403);
    }
  });

  it("rejects administrators and students at every teacher API endpoint", async () => {
    const mutationHeaders = { "content-type": "application/json", origin: "http://localhost", host: "localhost" };
    const teacherEndpoints = [
      () => listImportBatches(new Request("http://localhost/api/v1/teacher/import-batches")),
      () => getImportBatch(new Request("http://localhost/api/v1/teacher/import-batches/batch-1"), { params: Promise.resolve({ id: "batch-1" }) }),
      () => revertImportBatch(new Request("http://localhost/api/v1/teacher/import-batches/batch-1/revert", { method: "POST", headers: { origin: "http://localhost", host: "localhost" } }), { params: Promise.resolve({ id: "batch-1" }) }),
      () => previewImportBatch(new Request("http://localhost/api/v1/teacher/imports/preview", { method: "POST", headers: { origin: "http://localhost", host: "localhost" } })),
      () => commitImportBatch(new Request("http://localhost/api/v1/teacher/imports/commit", { method: "POST", headers: mutationHeaders, body: JSON.stringify({ batchId: "batch-1" }) })),
      () => createKnowledgePoint(new Request("http://localhost/api/v1/teacher/knowledge-points", { method: "POST", headers: mutationHeaders, body: JSON.stringify({ code: "9.1", name: "测试知识点" }) })),
      () => updateKnowledgePoint(new Request("http://localhost/api/v1/teacher/knowledge-points/point-1", { method: "PUT", headers: mutationHeaders, body: JSON.stringify({ name: "测试知识点", sortOrder: 0, enabled: true }) }), { params: Promise.resolve({ id: "point-1" }) }),
      () => savePracticeRules(new Request("http://localhost/api/v1/teacher/practice-rules", { method: "PUT", headers: mutationHeaders, body: JSON.stringify({ levelRules: [], knowledgeRules: [], examRules: [] }) })),
      () => createQuestion(new Request("http://localhost/api/v1/teacher/questions", { method: "POST", headers: mutationHeaders, body: JSON.stringify({ levelIds: ["level-1"], knowledgePointId: "point-1", stem: "题目", options: [{ id: "A", text: "正确" }, { id: "B", text: "错误" }], correctOptionIds: ["A"] }) })),
      () => updateQuestion(new Request("http://localhost/api/v1/teacher/questions/question-1", { method: "PUT", headers: mutationHeaders, body: JSON.stringify({ levelIds: ["level-1"], knowledgePointId: "point-1", stem: "题目", options: [{ id: "A", text: "正确" }, { id: "B", text: "错误" }], correctOptionIds: ["A"], status: "ACTIVE" }) }), { params: Promise.resolve({ id: "question-1" }) }),
      () => assignQuestionLevel(new Request("http://localhost/api/v1/teacher/questions/question-1/levels", { method: "POST", headers: mutationHeaders, body: JSON.stringify({ levelIds: ["level-1"] }) }), { params: Promise.resolve({ id: "question-1" }) }),
      () => removeQuestionLevel(new Request("http://localhost/api/v1/teacher/questions/question-1/levels/remove", { method: "POST", headers: mutationHeaders, body: JSON.stringify({ levelIds: ["level-1"] }) }), { params: Promise.resolve({ id: "question-1" }) }),
      () => batchAssignQuestionLevels(new Request("http://localhost/api/v1/teacher/questions/levels/batch", { method: "POST", headers: mutationHeaders, body: JSON.stringify({ questionIds: ["question-1"], levelIds: ["level-1"] }) })),
      () => batchRemoveQuestionLevels(new Request("http://localhost/api/v1/teacher/questions/levels/remove", { method: "POST", headers: mutationHeaders, body: JSON.stringify({ questionIds: ["question-1"], levelIds: ["level-1"] }) })),
    ];

    for (const user of [administrator, student]) {
      mocks.getCurrentUser.mockResolvedValue(user);
      for (const invoke of teacherEndpoints) expect((await invoke()).status).toBe(403);
    }
  });

  it("allows only active students to create practice sessions", async () => {
    const request = () => new Request("http://localhost/api/v1/practice-sessions", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ mode: "level", levelCode: "A" }),
    });

    mocks.getCurrentUser.mockResolvedValue(student);
    expect((await createPracticeSession(request())).status).toBe(201);

    for (const user of [administrator, teacher]) {
      mocks.getCurrentUser.mockResolvedValue(user);
      expect((await createPracticeSession(request())).status).toBe(403);
    }
  });
});
