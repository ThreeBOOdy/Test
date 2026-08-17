import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connectionString) });

async function main() {
  const fk = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT CONSTRAINT_NAME, TABLE_NAME
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND CONSTRAINT_NAME = 'WrongQuestion_userId_fkey'
  `;
  const idx = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT INDEX_NAME, TABLE_NAME
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND INDEX_NAME = 'WrongQuestion_userId_mastered_correctSessionCount_idx'
  `;
  const updatedAt = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_DEFAULT
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'RadioPerson' AND COLUMN_NAME = 'updatedAt'
  `;
  const migrations = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT migration_name, finished_at, rolled_back_at, started_at
    FROM _prisma_migrations
    ORDER BY started_at DESC
    LIMIT 5
  `;
  console.log(JSON.stringify({ fk, idx, updatedAt, migrations }, null, 2));
}

main().finally(() => prisma.$disconnect());
