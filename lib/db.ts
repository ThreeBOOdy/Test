import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };
const connectionString = process.env.DATABASE_URL;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: new PrismaPg({ connectionString: connectionString ?? "postgresql://practice:practice@localhost:5432/practice?schema=public" }),
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
