import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });

async function main() {
  const questions = await prisma.question.findMany({
    where: { stem: { contains: "含图题干 E2E" } },
    select: {
      id: true,
      courseId: true,
      status: true,
      stem: true,
      createdAt: true,
      _count: { select: { revisions: true, images: true, wrongQuestions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(JSON.stringify(questions, null, 2));
  const teacher = await prisma.user.findUnique({ where: { username: "teacher" }, select: { id: true } });
  const student = await prisma.user.findUnique({ where: { username: "student" }, select: { id: true } });
  console.log("teacher/student:", teacher?.id, student?.id);
}

main().finally(() => prisma.$disconnect());
