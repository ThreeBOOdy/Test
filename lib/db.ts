import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseUrl } from "@/lib/server/env";

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };
const connectionString = getDatabaseUrl();

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: new PrismaMariaDb(connectionString),
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
