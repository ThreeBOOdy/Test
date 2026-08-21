import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for the review-plan-due helper");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

async function main() {
  const username = process.argv[2];
  if (!username) throw new Error("username is required");
  const user = await prisma.user.findUniqueOrThrow({ where: { username } });
  const now = new Date();
  await prisma.studentLevelQuestionState.updateMany({
    where: { userId: user.id, reps: { gt: 0 } },
    data: { dueAt: now },
  });
  console.log(`review plan dueAt forced to now for ${username}`);
}

main().finally(() => prisma.$disconnect());
