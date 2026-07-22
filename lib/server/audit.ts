import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export async function writeAuditLog(input: { actorUserId?: string; action: string; targetType: string; targetId?: string; metadata?: Prisma.InputJsonValue }) {
  await prisma.auditLog.create({ data: { actorUserId: input.actorUserId, action: input.action, targetType: input.targetType, targetId: input.targetId, metadata: input.metadata } });
}
