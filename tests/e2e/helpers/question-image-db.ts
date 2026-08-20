import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for the e2e question-image helper");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

async function main() {
  const [command, keyword] = process.argv.slice(2);
  if (!keyword) throw new Error("stem keyword is required");
  const student = await prisma.user.findUniqueOrThrow({ where: { username: "student" } });

  if (command === "seed-wrong") {
    const question = await prisma.question.findFirstOrThrow({ where: { stem: { contains: keyword } }, select: { id: true } });
    await prisma.wrongQuestion.deleteMany({ where: { userId: student.id } });
    await prisma.wrongQuestion.create({ data: { userId: student.id, questionId: question.id, wrongCount: 1, lastWrongReason: "ANSWERED_WRONG" } });
    console.log(question.id);
    return;
  }

  if (command === "cleanup") {
    const question = await prisma.question.findFirst({ where: { stem: { contains: keyword } }, select: { id: true } });
    if (question) await prisma.wrongQuestion.deleteMany({ where: { userId: student.id, questionId: question.id } });
    await prisma.practiceSession.deleteMany({ where: { userId: student.id, mode: "WRONG_QUESTION" } });
    console.log("cleaned");
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().finally(() => prisma.$disconnect());
