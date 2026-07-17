import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import { knowledgePoints, levelRules, levels, questions } from "../lib/data/demo";

const connectionString = process.env.DATABASE_URL ?? "postgresql://practice:practice@localhost:5432/practice?schema=public";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

async function main() {
  const seedPassword = process.env.APP_SEED_PASSWORD ?? "ChangeMe123!";
  await prisma.user.upsert({ where: { username: "teacher" }, update: {}, create: { username: "teacher", displayName: "陈老师", role: "TEACHER", passwordHash: hashPassword(seedPassword), mustChangePassword: true } });
  await prisma.user.upsert({ where: { username: "student" }, update: {}, create: { username: "student", displayName: "林小知", role: "STUDENT", passwordHash: hashPassword(seedPassword), mustChangePassword: true } });

  for (const level of levels) {
    await prisma.level.upsert({ where: { id: level.id }, update: { code: level.code, name: level.name, sortOrder: level.sortOrder, enabled: level.enabled }, create: level });
    const rule = levelRules[level.id];
    await prisma.levelPracticeRule.upsert({ where: { levelId: level.id }, update: rule, create: { levelId: level.id, ...rule } });
  }

  for (const point of knowledgePoints.toSorted((left, right) => left.depth - right.depth)) {
    await prisma.knowledgePoint.upsert({ where: { id: point.id }, update: { code: point.code, name: point.name, parentId: point.parentId, path: point.path, depth: point.depth, sortOrder: point.sortOrder, enabled: point.enabled }, create: point });
  }

  await prisma.question.createMany({
    data: questions.map((question) => ({
      id: question.id,
      levelId: question.levelId,
      knowledgePointId: question.knowledgePointId,
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
