import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

async function main() {
  const users = await prisma.user.count();
  const questions = await prisma.question.count();
  const accounts = await prisma.user.findMany({ where: { role: { in: ["TEACHER", "STUDENT"] } }, select: { username: true, role: true } });
  console.log(JSON.stringify({ users, questions, accounts }));
}

main().finally(() => prisma.$disconnect());
