import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";
import { commitImportBatch } from "../../lib/server/import-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

beforeAll(() => {
  assertDatabaseName(connectionString, "practice_ci_integration");
});

beforeEach(async () => {
  await prisma.aiMessage.deleteMany();
  await prisma.aiConversation.deleteMany();
  await prisma.reviewCard.deleteMany();
  await prisma.reviewPlan.deleteMany();
  await prisma.focusSession.deleteMany();
  await prisma.playerProfile.deleteMany();
  await prisma.playerLevel.deleteMany();
  await prisma.questLog.deleteMany();
  await prisma.xpLog.deleteMany();
  await prisma.aiUsageLog.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.studentActivation.deleteMany();
  await prisma.studentImportRow.deleteMany();
  await prisma.studentImportBatch.deleteMany();
  await prisma.studentReviewRecord.deleteMany();
  await prisma.sensitiveDataReauthenticationAttempt.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.examDraft.deleteMany();
  await prisma.practiceAnswer.deleteMany();
  await prisma.practiceSessionQuestion.deleteMany();
  await prisma.practiceSession.deleteMany();
  await prisma.studentLevelQuestionState.deleteMany();
  await prisma.studentLevelProgress.deleteMany();
  await prisma.examBlueprintItem.deleteMany();
  await prisma.examBlueprint.deleteMany();
  await prisma.wrongQuestion.deleteMany();
  await prisma.questionRevision.deleteMany();
  await prisma.questionImage.deleteMany();
  await prisma.question.deleteMany();
  await prisma.importBatchImage.deleteMany();
  await prisma.importBatchRow.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.knowledgePracticeRule.deleteMany();
  await prisma.examRule.deleteMany();
  await prisma.levelPracticeRule.deleteMany();
  await deleteKnowledgePoints();
  await prisma.knowledgePointType.deleteMany();
  // User.activeLevel has a RESTRICT FK to Level, so detach it before deleting levels.
  await prisma.user.updateMany({ data: { activeLevelId: null } });
  await prisma.level.deleteMany();
  await prisma.user.deleteMany();
});

async function deleteKnowledgePoints() {
  while (await prisma.knowledgePoint.count()) {
    const leaves = await prisma.knowledgePoint.findMany({ where: { children: { none: {} } }, select: { id: true } });
    if (!leaves.length) throw new Error("Unable to delete knowledge point tree");
    await prisma.knowledgePoint.deleteMany({ where: { id: { in: leaves.map((leaf) => leaf.id) } } });
  }
}

async function createTeacher(username: string) {
  return prisma.user.create({
    data: { username, displayName: username, passwordHash: "hash", role: "TEACHER" },
  });
}

async function createPreviewBatch(teacherId: string, rows: Array<Record<string, unknown>>) {
  const batch = await prisma.importBatch.create({
    data: {
      fileName: "flexibility.xlsx",
      status: "PREVIEW",
      totalRows: rows.length,
      validRows: rows.length,
      importedById: teacherId,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  await prisma.importBatchRow.createMany({
    data: rows.map((payload, index) => ({
      batchId: batch.id,
      rowNumber: index + 1,
      payload: payload as Prisma.InputJsonValue,
      issues: [],
      valid: true,
    })),
  });
  return batch;
}

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    rowNumber: 1,
    categoryCode: "4.1.1",
    knowledgePointName: "知识点",
    externalQuestionCode: "FLEX-1",
    stem: "题目",
    rawAnswer: "A",
    optionValues: { A: "选项A", B: "选项B" },
    ...overrides,
  };
}

describe("question import flexibility (S6)", () => {
  it("creates a knowledge point type per Excel sheet and leaves questions unclassified", async () => {
    const teacher = await createTeacher("multi-sheet-teacher");
    const batch = await createPreviewBatch(teacher.id, [
      row({ rowNumber: 1, sheetName: "电工基础", externalQuestionCode: "MS-1", stem: "电工题" }),
      row({ rowNumber: 2, sheetName: "通信原理", externalQuestionCode: "MS-2", stem: "通信题" }),
    ]);

    const result = await commitImportBatch(teacher.id, batch.id);

    expect(result).toMatchObject({ batchId: batch.id, inserted: 2, skipped: 0 });
    expect(result.questionIds).toHaveLength(2);

    const electricType = await prisma.knowledgePointType.findFirstOrThrow({ where: { name: "电工基础" } });
    const communicationType = await prisma.knowledgePointType.findFirstOrThrow({ where: { name: "通信原理" } });
    expect(electricType.enabled).toBe(true);
    expect(communicationType.enabled).toBe(true);
    expect(electricType.id).not.toBe(communicationType.id);

    const electricPoint = await prisma.knowledgePoint.findFirstOrThrow({ where: { typeId: electricType.id, code: "4.1.1" } });
    const communicationPoint = await prisma.knowledgePoint.findFirstOrThrow({ where: { typeId: communicationType.id, code: "4.1.1" } });
    expect(electricPoint.id).not.toBe(communicationPoint.id);

    const electricQuestion = await prisma.question.findFirstOrThrow({
      where: { externalQuestionCode: "MS-1" },
      include: { knowledgePoint: true, levels: true },
    });
    const communicationQuestion = await prisma.question.findFirstOrThrow({
      where: { externalQuestionCode: "MS-2" },
      include: { knowledgePoint: true, levels: true },
    });
    expect(electricQuestion.knowledgePointId).toBe(electricPoint.id);
    expect(electricQuestion.knowledgePoint.typeId).toBe(electricType.id);
    expect(communicationQuestion.knowledgePointId).toBe(communicationPoint.id);
    expect(communicationQuestion.knowledgePoint.typeId).toBe(communicationType.id);
    expect(electricQuestion.levels).toEqual([]);
    expect(communicationQuestion.levels).toEqual([]);
  });

  it("commits single-sheet/Word wizard type selections into the chosen type without letter classes", async () => {
    const teacher = await createTeacher("wizard-teacher");
    const type = await prisma.knowledgePointType.create({
      data: { code: "DG", name: "电工基础", sortOrder: 1, enabled: true },
    });
    const batch = await createPreviewBatch(teacher.id, [
      row({ rowNumber: 1, knowledgePointTypeId: type.id, externalQuestionCode: "WIZ-1", stem: "向导题" }),
    ]);

    const result = await commitImportBatch(teacher.id, batch.id);

    expect(result).toMatchObject({ batchId: batch.id, inserted: 1, skipped: 0 });
    expect(result.questionIds).toHaveLength(1);

    const question = await prisma.question.findFirstOrThrow({
      where: { externalQuestionCode: "WIZ-1" },
      include: { knowledgePoint: true, levels: true },
    });
    expect(question.knowledgePoint.typeId).toBe(type.id);
    expect(question.knowledgePoint.code).toBe("4.1.1");
    expect(question.levels).toEqual([]);
  });

  it("creates a new knowledge point type from single-sheet wizard name input", async () => {
    const teacher = await createTeacher("wizard-new-teacher");
    const batch = await createPreviewBatch(teacher.id, [
      row({ rowNumber: 1, knowledgePointTypeName: "自定义类型", externalQuestionCode: "WIZ-NEW-1", stem: "新建类型题" }),
    ]);

    const result = await commitImportBatch(teacher.id, batch.id);

    expect(result).toMatchObject({ inserted: 1, skipped: 0 });
    const type = await prisma.knowledgePointType.findFirstOrThrow({ where: { name: "自定义类型" } });
    const question = await prisma.question.findFirstOrThrow({
      where: { externalQuestionCode: "WIZ-NEW-1" },
      include: { knowledgePoint: true, levels: true },
    });
    expect(question.knowledgePoint.typeId).toBe(type.id);
    expect(question.levels).toEqual([]);
  });
});
