import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { writeAuditLog } from "@/lib/server/audit";
import { assertSameOrigin } from "@/lib/server/http";
import { hashPassword } from "@/lib/server/password";
import { ApiError, apiErrorResponse, requireRole } from "@/lib/server/api";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), displayName: z.string().trim().min(1).max(100), enabled: z.boolean() }),
  z.object({ action: z.literal("resetPassword") }),
]);

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("TEACHER");
    const { id } = await context.params;
    const input = schema.parse(await readJsonBody(request));
    const student = await prisma.user.findFirst({ where: { id, role: "STUDENT" } });
    if (!student) throw new ApiError("\u5b66\u751f\u8d26\u53f7\u4e0d\u5b58\u5728", 404);
    if (input.action === "resetPassword") {
      const temporaryPassword = `${randomBytes(8).toString("hex")}A1`;
      await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(temporaryPassword), mustChangePassword: true, sessionVersion: { increment: 1 } } });
      await writeAuditLog({ actorUserId: user.id, action: "STUDENT_PASSWORD_RESET", targetType: "User", targetId: id });
      return NextResponse.json({ temporaryPassword });
    }
    await prisma.user.update({ where: { id }, data: { displayName: input.displayName, enabled: input.enabled, ...(!input.enabled && student.enabled ? { sessionVersion: { increment: 1 } } : {}) } });
    await writeAuditLog({ actorUserId: user.id, action: input.enabled ? "STUDENT_UPDATE" : "STUDENT_DISABLE", targetType: "User", targetId: id });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return apiErrorResponse(error, "\u66f4\u65b0\u5b66\u751f\u5931\u8d25");
  }
}
