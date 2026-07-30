import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import { RADIO_COURSE_CODE, RADIO_COURSE_ID } from "../lib/domain/course";
import { RADIO_PERSON_CATALOG } from "../lib/domain/radio-person-catalog";
import { knowledgePoints, levelRules, levels, questions } from "../lib/data/demo";
import { hashPassword } from "../lib/server/password";
import { DEFAULT_EXAM_RULES } from "../lib/domain/exam-rules";

const connectionString = process.env.DATABASE_URL ?? "mysql://practice:practice@127.0.0.1:3306/practice_dev";
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

const grades = [
  { id: "grade-primary-1", code: "PRIMARY_1", name: "一年级", sortOrder: 1 },
  { id: "grade-primary-2", code: "PRIMARY_2", name: "二年级", sortOrder: 2 },
  { id: "grade-primary-3", code: "PRIMARY_3", name: "三年级", sortOrder: 3 },
  { id: "grade-primary-4", code: "PRIMARY_4", name: "四年级", sortOrder: 4 },
  { id: "grade-primary-5", code: "PRIMARY_5", name: "五年级", sortOrder: 5 },
  { id: "grade-primary-6", code: "PRIMARY_6", name: "六年级", sortOrder: 6 },
  { id: "grade-junior-1", code: "JUNIOR_1", name: "七年级", sortOrder: 7 },
  { id: "grade-junior-2", code: "JUNIOR_2", name: "八年级", sortOrder: 8 },
  { id: "grade-junior-3", code: "JUNIOR_3", name: "九年级", sortOrder: 9 },
] as const;


async function main() {
  await prisma.course.upsert({
    where: { code: RADIO_COURSE_CODE },
    update: { name: "无线电课程", enabled: true, activeSlot: 1, sortOrder: 0 },
    create: { id: RADIO_COURSE_ID, code: RADIO_COURSE_CODE, name: "无线电课程", enabled: true, activeSlot: 1, sortOrder: 0 },
  });
  const seedPassword = process.env.APP_SEED_PASSWORD ?? "ChangeMe123!";
  const levelIds = new Map<string, string>();
  const knowledgePointIds = new Map<string, string>();
  const passwordHash = hashPassword(seedPassword);
  await prisma.user.upsert({ where: { username: "admin" }, update: { displayName: "系统管理员", role: "ADMIN", mustChangePassword: false }, create: { username: "admin", displayName: "系统管理员", role: "ADMIN", passwordHash, mustChangePassword: false } });
  await prisma.user.upsert({ where: { username: "teacher" }, update: { displayName: "陈老师", role: "TEACHER", mustChangePassword: false }, create: { username: "teacher", displayName: "陈老师", role: "TEACHER", passwordHash, mustChangePassword: false } });
  await prisma.user.updateMany({ where: { username: "instructor" }, data: { enabled: false, sessionVersion: { increment: 1 } } });
  await prisma.user.upsert({
    where: { username: "student" },
    update: { displayName: "林小知", realName: "林小知", role: "STUDENT", studentStatus: "ACTIVE", registrationSource: "LEGACY", isLongTerm: true, profileIncomplete: true, mustChangePassword: false },
    create: { username: "student", displayName: "林小知", realName: "林小知", role: "STUDENT", passwordHash, studentStatus: "ACTIVE", registrationSource: "LEGACY", isLongTerm: true, profileIncomplete: true, mustChangePassword: false },
  });

  await prisma.radioPerson.createMany({ data: RADIO_PERSON_CATALOG, skipDuplicates: true });

  for (const grade of grades) {
    await prisma.grade.upsert({ where: { code: grade.code }, update: { name: grade.name, sortOrder: grade.sortOrder, enabled: true }, create: grade });
  }

  for (const level of levels) {
    const storedLevel = await prisma.level.upsert({ where: { courseId_code: { courseId: RADIO_COURSE_ID, code: level.code } }, update: { name: level.name, sortOrder: level.sortOrder, enabled: level.enabled }, create: { ...level, courseId: RADIO_COURSE_ID } });
    levelIds.set(level.id, storedLevel.id);
    const rule = levelRules[level.id];
    await prisma.levelPracticeRule.upsert({ where: { courseId_levelId: { courseId: RADIO_COURSE_ID, levelId: storedLevel.id } }, update: rule, create: { courseId: RADIO_COURSE_ID, levelId: storedLevel.id, ...rule } });
    const examRule = DEFAULT_EXAM_RULES[level.code as keyof typeof DEFAULT_EXAM_RULES];
    if (examRule) await prisma.examRule.upsert({ where: { courseId_levelId: { courseId: RADIO_COURSE_ID, levelId: storedLevel.id } }, update: {}, create: { courseId: RADIO_COURSE_ID, levelId: storedLevel.id, ...examRule } });
  }

  for (const point of knowledgePoints.toSorted((left, right) => left.depth - right.depth)) {
    const parentId = point.parentId ? knowledgePointIds.get(point.parentId) ?? point.parentId : null;
    const storedPoint = await prisma.knowledgePoint.upsert({ where: { courseId_code: { courseId: RADIO_COURSE_ID, code: point.code } }, update: { name: point.name, parentId, path: point.path, depth: point.depth, sortOrder: point.sortOrder, enabled: point.enabled }, create: { ...point, courseId: RADIO_COURSE_ID, parentId } });
    knowledgePointIds.set(point.id, storedPoint.id);
  }

  await prisma.question.createMany({
    data: questions.map((question) => ({
      id: question.id,
      courseId: RADIO_COURSE_ID,
      levelId: levelIds.get(question.levelId) ?? question.levelId,
      knowledgePointId: knowledgePointIds.get(question.knowledgePointId) ?? question.knowledgePointId,
      sourceBankCode: question.sourceBankCode,
      externalQuestionCode: question.externalQuestionCode,
      stem: question.stem,
      type: question.type,
      optionCount: question.optionCount,
      correctOptionCount: question.correctOptionCount,
      selectionSpec: question.selectionSpec,
      options: question.options as Prisma.InputJsonValue,
      correctOptionIds: question.correctOptionIds as Prisma.InputJsonValue,
      status: question.status,
    })),
    skipDuplicates: true,
  });

  console.log(`Seed complete: ${levels.length} levels, ${knowledgePoints.length} knowledge points, ${questions.length} questions.`);
}

main().finally(() => prisma.$disconnect());
