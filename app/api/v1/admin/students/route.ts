import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { validatePasswordPolicy } from "@/lib/domain/security";
import { writeAuditLog } from "@/lib/server/audit";
import { assertSameOrigin } from "@/lib/server/http";
import { hashPassword } from "@/lib/server/password";
import { ApiError, apiErrorResponse, requireRole } from "@/lib/server/api";

const schema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9_.-]+$/),
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(10).max(128).refine((value) => validatePasswordPolicy(value) === null),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireRole("TEACHER");
    const input = schema.parse(await readJsonBody(request));
    const duplicate = await prisma.user.findUnique({ where: { username: input.username } });
    if (duplicate) throw new ApiError("\u7528\u6237\u540d\u5df2\u5b58\u5728", 409);
    const student = await prisma.user.create({ data: { username: input.username, displayName: input.displayName, passwordHash: hashPassword(input.password), role: "STUDENT", enabled: true, mustChangePassword: true } });
    await writeAuditLog({ actorUserId: user.id, action: "STUDENT_CREATE", targetType: "User", targetId: student.id });
    return NextResponse.json({ id: student.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "\u521b\u5efa\u5b66\u751f\u5931\u8d25");
  }
}
