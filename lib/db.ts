import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getDatabaseSchema } from "@/lib/domain/database-url";
import { getDatabaseUrl } from "@/lib/server/env";

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };
const connectionString = getDatabaseUrl();

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString }, { schema: getDatabaseSchema(connectionString) }),
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
