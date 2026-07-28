import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { validatePasswordPolicy } from "@/lib/domain/security";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { assertSameOrigin } from "@/lib/server/http";
import { createSessionToken, getCurrentUser, SESSION_COOKIE } from "@/lib/server/session";
import { apiErrorResponse } from "@/lib/server/api";

const messages = {
  same: "\u65b0\u5bc6\u7801\u4e0d\u80fd\u4e0e\u5f53\u524d\u5bc6\u7801\u76f8\u540c",
  login: "\u8bf7\u5148\u767b\u5f55",
  current: "\u5f53\u524d\u5bc6\u7801\u4e0d\u6b63\u786e",
  failed: "\u4fee\u6539\u5bc6\u7801\u5931\u8d25",
};

const schema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(6).max(128) }).superRefine((input, context) => {
  const policyMessage = validatePasswordPolicy(input.newPassword);
  if (policyMessage) context.addIssue({ code: "custom", message: policyMessage, path: ["newPassword"] });
  if (input.currentPassword === input.newPassword) context.addIssue({ code: "custom", message: messages.same, path: ["newPassword"] });
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ message: messages.login }, { status: 401 });
    const input = schema.parse(await readJsonBody(request));
    const user = await prisma.user.findUnique({ where: { id: currentUser.id } });
    if (!user || !verifyPassword(input.currentPassword, user.passwordHash)) return NextResponse.json({ message: messages.current }, { status: 400 });
    const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(input.newPassword), mustChangePassword: false, sessionVersion: { increment: 1 } } });
    const token = await createSessionToken({ userId: updated.id, username: updated.username, role: updated.role, sessionVersion: updated.sessionVersion });
    const response = NextResponse.json({ saved: true, role: updated.role });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    return apiErrorResponse(error, messages.failed);
  }
}
