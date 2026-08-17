import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { evaluateAccountAccess } from "@/lib/domain/student-access";
import { verifyPassword } from "@/lib/server/password";
import { createSession, setSessionCookie } from "@/lib/server/session";
import { checkLoginRateLimit, getClientIp, recordLoginAttempt } from "@/lib/server/auth-security";
import { assertSameOrigin } from "@/lib/server/http";
import { apiErrorResponse } from "@/lib/server/api";
import { getBusinessDate } from "@/lib/server/time";

const schema = z.object({ username: z.string().trim().max(50), password: z.string().max(128) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await readJsonBody(request));
    const ip = getClientIp(request);
    if (await checkLoginRateLimit(input.username, ip)) return NextResponse.json({ message: "登录尝试过多，请 15 分钟后重试" }, { status: 429 });
    const user = input.username && input.password ? await prisma.user.findUnique({ where: { username: input.username } }) : null;
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      await recordLoginAttempt(input.username, ip, false);
      return NextResponse.json({ message: "用户名或密码错误" }, { status: 401 });
    }
    await recordLoginAttempt(input.username, ip, true);
    const dateOnly = (value: Date | null) => value ? value.toISOString().slice(0, 10) : null;
    const access = evaluateAccountAccess({
      role: user.role,
      enabled: user.enabled,
      studentStatus: user.studentStatus,
      isLongTerm: user.isLongTerm,
      validFrom: dateOnly(user.validFrom),
      validUntil: dateOnly(user.validUntil),
      mustChangePassword: user.mustChangePassword,
      activationRequired: user.activationRequired,
    }, getBusinessDate());
    if (!access.capability && access.errorCode !== "PASSWORD_CHANGE_REQUIRED") {
      const messages = {
        ACCOUNT_DISABLED: "账号已停用，请联系管理员",
        ACCOUNT_EXPIRED: "账号已到期，请联系管理员",
        ACCOUNT_NOT_YET_VALID: user.validFrom ? `账号将于 ${dateOnly(user.validFrom)} 启用` : "账号尚未生效，请联系管理员",
      } as const;
      return NextResponse.json({ message: messages[access.errorCode] }, { status: 403 });
    }
    const token = await createSession(user);
    const response = NextResponse.json({ user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, mustChangePassword: user.mustChangePassword, activationRequired: user.activationRequired, capability: access.capability } });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return apiErrorResponse(error, "登录失败");
  }
}
