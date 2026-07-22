import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { verifyPassword } from "@/lib/server/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/server/session";
import { checkLoginRateLimit, getClientIp, recordLoginAttempt } from "@/lib/server/auth-security";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse } from "@/lib/server/api";

const schema = z.object({ username: z.string().trim().max(50), password: z.string().max(128) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await readJsonBody(request));
    const ip = getClientIp(request);
    if (await checkLoginRateLimit(input.username, ip)) return NextResponse.json({ message: "登录尝试过多，请 15 分钟后重试" }, { status: 429 });
    const user = input.username && input.password ? await prisma.user.findUnique({ where: { username: input.username } }) : null;
    if (!user || !user.enabled || !verifyPassword(input.password, user.passwordHash)) {
      await recordLoginAttempt(input.username, ip, false);
      return NextResponse.json({ message: "用户名或密码错误" }, { status: 401 });
    }
    await recordLoginAttempt(input.username, ip, true);
    const token = await createSessionToken({ userId: user.id, username: user.username, role: user.role, sessionVersion: user.sessionVersion });
    const response = NextResponse.json({ user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, mustChangePassword: user.mustChangePassword } });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    return apiErrorResponse(error, "登录失败");
  }
}
