import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  questionRevisionCreate: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    question: {
      findMany: mocks.findMany,
      count: mocks.count,
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/server/audit", () => ({
  writeAuditLogInTransaction: mocks.audit,
}));

import {
  getExplanationReviewDetail,
  listExplanationReviews,
  submitExplanationReview,
} from "@/lib/server/ai/explanation-review";

const baseQuestion = {
  id: "q-1",
  levels: [{ level: { id: "level-1", code: "A", name: "A Level" } }],
  knowledgePointId: "point-1",
  sourceBankCode: null,
  externalQuestionCode: "EX-1",
  stem: "中继台下行频率应避开哪些业务频率？",
  type: "SINGLE_CHOICE",
  optionCount: 3,
  correctOptionCount: 1,
  selectionSpec: "3选1",
  preserveOptionOrder: false,
  options: [
    { id: "A", text: "广播电视业务" },
    { id: "B", text: "航空移动业务" },
    { id: "C", text: "水上移动业务" },
  ],
  correctOptionIds: ["B"],
  status: "ACTIVE",
  version: 2,
  explanation: JSON.stringify({ summary: "一句话", knowledge: "讲解", memory: "口诀" }),
  explanationStatus: "DRAFT",
  explanationVersion: 1,
  explanationRejectReason: null,
  explanationReviewedById: null,
  explanationReviewedAt: null,
  createdAt: new Date("2026-08-17T00:00:00.000Z"),
  updatedAt: new Date("2026-08-17T00:00:00.000Z"),
  knowledgePoint: { id: "point-1", code: "1.1", name: "中继台频率" },
  explanationReviewedBy: null,
};

describe("listExplanationReviews", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.count.mockReset();
    mocks.findMany.mockResolvedValue([{ ...baseQuestion, explanationReviewedBy: { displayName: "张老师" } }]);
    mocks.count.mockResolvedValue(1);
  });

  it("returns a paginated list with parsed explanation and reviewer name", async () => {
    const result = await listExplanationReviews({ page: 1, pageSize: 20, status: "DRAFT" });

    expect(result).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      items: [
        {
          id: "q-1",
          explanationStatus: "DRAFT",
          reviewedByName: "张老师",
          explanation: { summary: "一句话", knowledge: "讲解", memory: "口诀" },
          level: { code: "A" },
          knowledgePoint: { code: "1.1" },
        },
      ],
    });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { explanationStatus: "DRAFT" } }));
  });

  it("defaults to DRAFT and supports ALL", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    await listExplanationReviews({ page: 1, pageSize: 20, status: "ALL" });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});

describe("getExplanationReviewDetail", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.findUnique.mockResolvedValue({ ...baseQuestion, explanationReviewedBy: { id: "teacher-1", displayName: "张老师" } });
  });

  it("returns detail with options and reviewer", async () => {
    const result = await getExplanationReviewDetail("q-1");

    expect(result).toMatchObject({
      id: "q-1",
      version: 2,
      options: [
        { id: "A", text: "广播电视业务" },
        { id: "B", text: "航空移动业务" },
        { id: "C", text: "水上移动业务" },
      ],
      correctOptionIds: ["B"],
      reviewedById: "teacher-1",
      reviewedByName: "张老师",
    });
    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: "q-1" }, include: expect.any(Object) });
  });

  it("throws 404 when the question is missing", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(getExplanationReviewDetail("missing")).rejects.toMatchObject({ status: 404 });
  });
});

describe("submitExplanationReview", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.transaction.mockImplementation(async (callback: (tx: object) => unknown) => callback({
      question: {
        findUnique: mocks.findUnique,
        updateMany: mocks.updateMany,
        findUniqueOrThrow: mocks.findUniqueOrThrow,
      },
      questionRevision: { create: mocks.questionRevisionCreate },
    }));
    mocks.findUnique.mockResolvedValue(baseQuestion);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({ ...baseQuestion, version: 3, explanationStatus: "APPROVED", explanationVersion: 2, explanationReviewedById: "teacher-1", explanationReviewedAt: new Date("2026-08-17T01:00:00.000Z"), explanationRejectReason: null });
    mocks.questionRevisionCreate.mockResolvedValue({ id: "rev-1" });
    mocks.audit.mockResolvedValue(undefined);
  });

  it("approves the draft and writes a revision and audit log", async () => {
    const result = await submitExplanationReview({
      questionId: "q-1",
      actorUserId: "teacher-1",
      action: "APPROVE",
      version: 2,
    });

    expect(result).toEqual({ saved: true, status: "APPROVED", version: 3, explanationVersion: 2 });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "q-1", version: 2 },
      data: expect.objectContaining({
        explanationStatus: "APPROVED",
        explanationRejectReason: null,
        explanationReviewedById: "teacher-1",
        explanationVersion: { increment: 1 },
        version: { increment: 1 },
      }),
    });
    expect(mocks.questionRevisionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        questionId: "q-1",
        revision: 3,
        changeSource: "EXPLANATION_APPROVE",
        actorUserId: "teacher-1",
      }),
    });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "EXPLANATION_APPROVE",
      targetType: "Question",
      targetId: "q-1",
    }));
  });

  it("approves with edits and stores the edited content", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({ ...baseQuestion, version: 3, explanationStatus: "APPROVED", explanationVersion: 2, explanation: JSON.stringify({ summary: "新一句话", knowledge: "新讲解", memory: "新口诀" }), explanationReviewedById: "teacher-1", explanationReviewedAt: new Date("2026-08-17T01:00:00.000Z") });

    await submitExplanationReview({
      questionId: "q-1",
      actorUserId: "teacher-1",
      action: "APPROVE_WITH_EDITS",
      content: { summary: "新一句话", knowledge: "新讲解", memory: "新口诀" },
      version: 2,
    });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "q-1", version: 2 },
      data: expect.objectContaining({
        explanation: JSON.stringify({ summary: "新一句话", knowledge: "新讲解", memory: "新口诀" }),
        explanationStatus: "APPROVED",
      }),
    });
    expect(mocks.questionRevisionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ changeSource: "EXPLANATION_APPROVE_WITH_EDITS" }),
    });
  });

  it("rejects with a reason and records audit metadata", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({ ...baseQuestion, version: 3, explanationStatus: "REJECTED", explanationVersion: 2, explanationRejectReason: "解析不够准确", explanationReviewedById: "teacher-1", explanationReviewedAt: new Date("2026-08-17T01:00:00.000Z") });

    const result = await submitExplanationReview({
      questionId: "q-1",
      actorUserId: "teacher-1",
      action: "REJECT",
      rejectReason: " 解析不够准确 ",
      version: 2,
    });

    expect(result).toMatchObject({ status: "REJECTED" });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "q-1", version: 2 },
      data: expect.objectContaining({
        explanationStatus: "REJECTED",
        explanationRejectReason: "解析不够准确",
      }),
    });
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "EXPLANATION_REJECT",
      metadata: expect.objectContaining({ rejectReason: "解析不够准确", edited: false }),
    }));
  });

  it("rejects a stale review with 409 and does not write revision", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(submitExplanationReview({
      questionId: "q-1",
      actorUserId: "teacher-1",
      action: "APPROVE",
      version: 1,
    })).rejects.toMatchObject({ status: 409, message: "数据已被其他教师更新，请刷新后重试" });

    expect(mocks.questionRevisionCreate).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
