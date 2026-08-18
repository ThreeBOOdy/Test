import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

beforeAll(() => assertDatabaseName(connectionString, "practice_ci_integration"));

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
  await prisma.level.deleteMany();
  await prisma.user.deleteMany();
  await prisma.radioPerson.deleteMany();
  await prisma.grade.deleteMany();
});

async function deleteKnowledgePoints() {
  while (await prisma.knowledgePoint.count()) {
    const leaves = await prisma.knowledgePoint.findMany({ where: { children: { none: {} } }, select: { id: true } });
    if (!leaves.length) throw new Error("Unable to delete knowledge point tree");
    await prisma.knowledgePoint.deleteMany({ where: { id: { in: leaves.map((leaf) => leaf.id) } } });
  }
}

describe("AI data model", () => {
  it("defaults new questions to NONE and round-trips explanation fields", async () => {
    const reviewer = await prisma.user.create({ data: { username: "ai-reviewer", displayName: "AI Reviewer", passwordHash: "test", role: "TEACHER" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "1.1", name: "Point", path: "/1/1.1", depth: 1 } });
    const question = await prisma.question.create({
      data: {
        knowledgePointId: point.id,
        levels: { create: { levelId: level.id } },
        externalQuestionCode: "AI-1",
        stem: "Question with AI explanation",
        type: "SINGLE_CHOICE",
        optionCount: 2,
        correctOptionCount: 1,
        selectionSpec: "2选1",
        options: [{ id: "A", text: "A" }, { id: "B", text: "B" }],
        correctOptionIds: ["A"],
      },
    });

    const created = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
    expect(created.explanationStatus).toBe("NONE");
    expect(created.explanationVersion).toBe(0);
    expect(created.explanation).toBeNull();

    const updated = await prisma.question.update({
      where: { id: question.id },
      data: {
        explanation: "AI 解析内容",
        explanationStatus: "DRAFT",
        explanationVersion: 1,
        explanationReviewedById: reviewer.id,
        explanationReviewedAt: new Date("2026-08-17T00:00:00.000Z"),
      },
    });

    expect(updated).toMatchObject({
      explanation: "AI 解析内容",
      explanationStatus: "DRAFT",
      explanationVersion: 1,
      explanationReviewedById: reviewer.id,
      explanationReviewedAt: new Date("2026-08-17T00:00:00.000Z"),
    });
  });

  it("records and reads an AI usage log row", async () => {
    const user = await prisma.user.create({ data: { username: "ai-student", displayName: "AI Student", passwordHash: "test", role: "STUDENT" } });
    const log = await prisma.aiUsageLog.create({
      data: {
        userId: user.id,
        action: "EXPLANATION_GENERATE",
        provider: "cloud",
        model: "deepseek-chat",
        promptTokens: 120,
        completionTokens: 80,
        totalTokens: 200,
        latencyMs: 345,
        requestHash: "hash-1",
      },
    });

    const stored = await prisma.aiUsageLog.findUniqueOrThrow({ where: { id: log.id }, include: { user: true } });
    expect(stored).toMatchObject({
      action: "EXPLANATION_GENERATE",
      provider: "cloud",
      model: "deepseek-chat",
      promptTokens: 120,
      completionTokens: 80,
      totalTokens: 200,
      latencyMs: 345,
      requestHash: "hash-1",
      user: { id: user.id },
    });
    expect(stored.createdAt).toBeInstanceOf(Date);
  });
});
