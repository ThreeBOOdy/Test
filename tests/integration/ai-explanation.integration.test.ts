import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";
import { MockProvider } from "../../lib/server/ai/provider";
import { generateQuestionExplanation } from "../../lib/server/ai/explanation";

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

describe("AI explanation generation", () => {
  it("generates a DRAFT explanation and records an AiUsageLog with MockProvider", async () => {
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "1.1", name: "中继台频率", path: "/1/1.1", depth: 1 } });
    const question = await prisma.question.create({
      data: {
        knowledgePointId: point.id,
        levels: { create: { levelId: level.id } },
        externalQuestionCode: "AI-EXPLAIN-1",
        stem: "中继台下行频率应避开哪些业务频率？",
        type: "SINGLE_CHOICE",
        optionCount: 3,
        correctOptionCount: 1,
        selectionSpec: "3选1",
        options: [
          { id: "A", text: "广播电视业务" },
          { id: "B", text: "航空移动业务" },
          { id: "C", text: "水上移动业务" },
        ],
        correctOptionIds: ["B"],
      },
    });

    const stored = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
    const provider = new MockProvider({
      content: JSON.stringify({
        summary: "中继台下行不能干扰航空业务",
        knowledge: "中继台应避开航空移动业务频率",
        memory: "航空优先，中继让路",
      }),
      model: "mock-model",
      usage: { promptTokens: 12, completionTokens: 34, totalTokens: 46 },
    });

    const result = await generateQuestionExplanation(
      {
        id: stored.id,
        stem: stored.stem,
        options: stored.options,
        correctOptionIds: stored.correctOptionIds,
        levelName: level.name,
        knowledgePointName: point.name,
        type: stored.type,
        explanationVersion: stored.explanationVersion,
      },
      { provider },
    );

    expect(result).toMatchObject({
      questionId: question.id,
      applied: true,
      content: {
        summary: "中继台下行不能干扰航空业务",
        knowledge: "中继台应避开航空移动业务频率",
        memory: "航空优先，中继让路",
      },
    });

    const updated = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
    expect(updated.explanationStatus).toBe("DRAFT");
    expect(updated.explanationVersion).toBe(1);
    expect(JSON.parse(updated.explanation ?? "{}")).toEqual({
      summary: "中继台下行不能干扰航空业务",
      knowledge: "中继台应避开航空移动业务频率",
      memory: "航空优先，中继让路",
    });

    const logs = await prisma.aiUsageLog.findMany({ where: { action: "EXPLANATION_GENERATE" } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      provider: "mock",
      model: "mock-model",
      promptTokens: 12,
      completionTokens: 34,
      totalTokens: 46,
    });
  });
});
