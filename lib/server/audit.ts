import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type AuditInput = { actorUserId?: string; action: string; targetType: string; targetId?: string; metadata?: Prisma.InputJsonValue };

export async function writeAuditLog(input: AuditInput) {
  await prisma.auditLog.create({ data: input });
}

export async function writeAuditLogInTransaction(tx: Prisma.TransactionClient, input: AuditInput) {
  await tx.auditLog.create({ data: input });
}
