import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import { knowledgePoints, levelRules, levels, questions } from "../lib/data/demo";
import { getDatabaseSchema } from "../lib/domain/database-url";
import { hashPassword } from "../lib/server/password";

const connectionString = process.env.DATABASE_URL ?? "postgresql://practice:practice@localhost:5432/practice?schema=public";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }, { schema: getDatabaseSchema(connectionString) }) });


async function main() {
  const seedPassword = process.env.APP_SEED_PASSWORD ?? "ChangeMe123!";
  const levelIds = new Map<string, string>();
  const knowledgePointIds = new Map<string, string>();
  await prisma.user.upsert({ where: { username: "teacher" }, update: {}, create: { username: "teacher", displayName: "陈老师", role: "TEACHER", passwordHash: hashPassword(seedPassword), mustChangePassword: false } });
  await prisma.user.upsert({ where: { username: "student" }, update: {}, create: { username: "student", displayName: "林小知", role: "STUDENT", passwordHash: hashPassword(seedPassword), mustChangePassword: false } });

  for (const level of levels) {
    const storedLevel = await prisma.level.upsert({ where: { code: level.code }, update: { name: level.name, sortOrder: level.sortOrder, enabled: level.enabled }, create: level });
    levelIds.set(level.id, storedLevel.id);
    const rule = levelRules[level.id];
    await prisma.levelPracticeRule.upsert({ where: { levelId: storedLevel.id }, update: rule, create: { levelId: storedLevel.id, ...rule } });
  }

  for (const point of knowledgePoints.toSorted((left, right) => left.depth - right.depth)) {
    const parentId = point.parentId ? knowledgePointIds.get(point.parentId) ?? point.parentId : null;
    const storedPoint = await prisma.knowledgePoint.upsert({ where: { code: point.code }, update: { name: point.name, parentId, path: point.path, depth: point.depth, sortOrder: point.sortOrder, enabled: point.enabled }, create: { ...point, parentId } });
    knowledgePointIds.set(point.id, storedPoint.id);
  }

  await prisma.question.createMany({
    data: questions.map((question) => ({
      id: question.id,
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
      correctOptionIds: question.correctOptionIds,
      status: question.status,
    })),
    skipDuplicates: true,
  });

  console.log(`Seed complete: ${levels.length} levels, ${knowledgePoints.length} knowledge points, ${questions.length} questions.`);
}

main().finally(() => prisma.$disconnect());
