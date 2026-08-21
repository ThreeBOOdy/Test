import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";
import { assertDatabaseName } from "../../lib/domain/database-url";
import { clearOwnWrongQuestions, clearStudentWrongQuestions } from "../../lib/server/wrong-question-clear-service";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for integration tests");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

beforeAll(() => {
  assertDatabaseName(connectionString, "practice_ci_integration");
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.studentLevelQuestionState.deleteMany();
  await prisma.practiceAnswer.deleteMany();
  await prisma.practiceSessionQuestion.deleteMany();
  await prisma.practiceSession.deleteMany();
  await prisma.wrongQuestion.deleteMany();
  await prisma.questionRevision.deleteMany();
  await prisma.question.deleteMany();
  // User.activeLevel has a RESTRICT FK to Level, so detach it before deleting levels.
  await prisma.user.updateMany({ data: { activeLevelId: null } });
  await prisma.level.deleteMany();
  await prisma.user.deleteMany();
  await prisma.knowledgePoint.deleteMany();
  await prisma.knowledgePointType.deleteMany();
  await prisma.grade.deleteMany();
});

async function createWrongState() {
  const grade = await prisma.grade.create({
    data: { code: "GRADE_WC", name: "错题清除测试班", studentSelfWrongClearEnabled: true },
  });
  const level = await prisma.level.create({ data: { code: "A", name: "A Level" } });
  const student = await prisma.user.create({
    data: {
      username: "wrong-clear-student",
      displayName: "Wrong Clear Student",
      passwordHash: "test",
      role: "STUDENT",
      gradeId: grade.id,
      activeLevelId: level.id,
    },
  });
  const teacher = await prisma.user.create({
    data: { username: "wrong-clear-teacher", displayName: "Wrong Clear Teacher", passwordHash: "test", role: "TEACHER" },
  });
  const defaultType = await prisma.knowledgePointType.upsert({
    where: { code: "DEFAULT" },
    update: {},
    create: { code: "DEFAULT", name: "默认" },
  });
  const point = await prisma.knowledgePoint.create({
    data: { typeId: defaultType.id, code: "1.1", name: "Point", path: "/1/1.1", depth: 1 },
  });
  const question = await prisma.question.create({
    data: {
      knowledgePointId: point.id,
      levels: { create: { levelId: level.id } },
      externalQuestionCode: "WRONG-CLEAR-1",
      stem: "Clear me",
      type: "SINGLE_CHOICE",
      optionCount: 2,
      correctOptionCount: 1,
      selectionSpec: "2选1",
      options: [{ id: "A", text: "A" }, { id: "B", text: "B" }],
      correctOptionIds: ["A"],
    },
  });
  const state = await prisma.studentLevelQuestionState.create({
    data: {
      userId: student.id,
      levelId: level.id,
      questionId: question.id,
      state: "RELEARNING",
      dueAt: new Date("2026-08-21T00:00:00.000Z"),
      stability: 3,
      difficulty: 7,
      reps: 5,
      lapses: 2,
      intervalDays: 0,
      lastReviewedAt: new Date("2026-08-20T00:00:00.000Z"),
      favorite: true,
      ignored: false,
      wrongCount: 4,
      correctCount: 1,
      lastResult: "INCORRECT",
    },
  });
  return { grade, level, student, teacher, question, state };
}

describe("wrong question clear integration", () => {
  it("resets wrong states, preserves marks, and writes an audit log", async () => {
    const { student, teacher, state } = await createWrongState();

    const result = await clearStudentWrongQuestions(teacher.id, student.id);

    expect(result).toEqual({ cleared: 1, levelId: student.activeLevelId, levelCode: "A" });

    const updated = await prisma.studentLevelQuestionState.findUniqueOrThrow({ where: { id: state.id } });
    expect(updated).toMatchObject({
      state: "NEW",
      dueAt: null,
      stability: 0,
      difficulty: 5,
      reps: 0,
      lapses: 0,
      intervalDays: 0,
      lastReviewedAt: null,
      wrongCount: 0,
      correctCount: 0,
      lastResult: null,
      favorite: true,
      ignored: false,
    });

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorUserId: teacher.id, action: "WRONG_QUESTION_CLEAR" },
    });
    expect(audit.targetId).toBe(student.id);
    expect(audit.metadata).toMatchObject({ cleared: 1, levelCode: "A" });
  });

  it("allows student self-clear only when the grade setting is enabled", async () => {
    const { grade, student } = await createWrongState();

    await expect(clearOwnWrongQuestions(student.id)).resolves.toMatchObject({ cleared: 1 });

    await prisma.grade.update({
      where: { id: grade.id },
      data: { studentSelfWrongClearEnabled: false },
    });
    // Re-create a wrong state after disabling so the permission check is exercised.
    await prisma.studentLevelQuestionState.updateMany({
      where: { userId: student.id, levelId: student.activeLevelId! },
      data: { wrongCount: 1 },
    });

    await expect(clearOwnWrongQuestions(student.id)).rejects.toMatchObject({
      status: 403,
      message: "当前未开放学生自助清除错题，请联系老师",
    });
  });
});
