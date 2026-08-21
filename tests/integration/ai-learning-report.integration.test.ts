import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";
import { MockProvider } from "../../lib/server/ai/provider";
import {
  STUDENT_WEEKLY_REPORT_ACTION,
  TEACHER_CLASS_REPORT_ACTION,
  generateStudentWeeklyReport,
  generateTeacherClassReport,
} from "../../lib/server/ai/report";

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
  // User.activeLevel has a RESTRICT FK to Level, so detach it before deleting levels.
  await prisma.user.updateMany({ data: { activeLevelId: null } });
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

describe("AI learning report generation", () => {
  it("generates student and teacher reports from real statistics and records AiUsageLog", async () => {
    const teacher = await prisma.user.create({ data: { username: "report-teacher", displayName: "Report Teacher", passwordHash: "test", role: "TEACHER" } });
    const student = await prisma.user.create({ data: { username: "report-student", displayName: "Report Student", passwordHash: "test", role: "STUDENT" } });
    const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
    const defaultType = await prisma.knowledgePointType.upsert({ where: { code: "DEFAULT" }, update: {}, create: { code: "DEFAULT", name: "默认" } });
  const point = await prisma.knowledgePoint.create({ data: { typeId: defaultType.id, code: "1.1", name: "中继台频率", path: "/1/1.1", depth: 1 } });
    const question = await prisma.question.create({
      data: {
        knowledgePointId: point.id,
        levels: { create: { levelId: level.id } },
        externalQuestionCode: "AI-REPORT-1",
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
    const session = await prisma.practiceSession.create({
      data: {
        userId: student.id,
        mode: "QUESTION_ORDER",
        levelId: level.id,
        singleCountSnapshot: 1,
        multipleCountSnapshot: 0,
        currentIndex: 1,
        correctCount: 1,
        status: "COMPLETED",
        startedAt: new Date("2026-08-12T00:00:00.000Z"),
        completedAt: new Date("2026-08-12T01:00:00.000Z"),
      },
    });
    await prisma.practiceAnswer.create({
      data: {
        sessionId: session.id,
        questionId: question.id,
        selectedOptionIds: ["B"],
        isCorrect: true,
        submittedAt: new Date("2026-08-12T01:00:00.000Z"),
      },
    });

    const since = new Date("2026-08-10T00:00:00.000Z");
    const studentProvider = new MockProvider({
      content: JSON.stringify({
        summary: "本周完成一次练习，正确率良好",
        weakPoints: [],
        nextSteps: ["保持练习节奏"],
        encouragement: "继续加油！",
      }),
      model: "mock-model",
      usage: { promptTokens: 12, completionTokens: 18, totalTokens: 30 },
    });
    const teacherProvider = new MockProvider({
      content: JSON.stringify({
        overview: "班级整体正确率良好",
        weakPoints: [],
        classFocus: ["保持当前讲题节奏"],
        suggestions: "增加模拟考试训练",
      }),
      model: "mock-model",
      usage: { promptTokens: 14, completionTokens: 20, totalTokens: 34 },
    });

    const studentReport = await generateStudentWeeklyReport(student.id, { provider: studentProvider, since });
    const teacherReport = await generateTeacherClassReport(teacher.id, { provider: teacherProvider, since });

    expect(studentReport.content).toMatchObject({
      summary: "本周完成一次练习，正确率良好",
      nextSteps: ["保持练习节奏"],
    });
    expect(teacherReport.content).toMatchObject({
      overview: "班级整体正确率良好",
      classFocus: ["保持当前讲题节奏"],
    });

    const logs = await prisma.aiUsageLog.findMany({ orderBy: { createdAt: "asc" } });
    expect(logs.map((log) => log.action)).toEqual([
      STUDENT_WEEKLY_REPORT_ACTION,
      TEACHER_CLASS_REPORT_ACTION,
    ]);
    expect(logs[0]).toMatchObject({ userId: student.id, provider: "mock", model: "mock-model", promptTokens: 12, completionTokens: 18, totalTokens: 30 });
    expect(logs[1]).toMatchObject({ userId: teacher.id, provider: "mock", model: "mock-model", promptTokens: 14, completionTokens: 20, totalTokens: 34 });
  });
});
