import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readJsonBody } from "@/lib/domain/request-body";
import { ApiError, apiErrorResponse } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { createSessionToken, SESSION_COOKIE } from "@/lib/server/session";
import { registerStudent } from "@/lib/server/student-account-service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const created = await registerStudent(await readJsonBody(request, 64 * 1024));
    const user = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    const token = await createSessionToken({ userId: user.id, username: user.username, role: user.role, sessionVersion: user.sessionVersion });
    const response = NextResponse.json({ registered: true, user: { id: user.id, role: user.role, capability: "REGISTRATION_ONLY" } }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    if (error instanceof ApiError && error.message === "REGISTRATION_CONFLICT") return NextResponse.json({ message: "注册信息已存在，请核对后重试" }, { status: 409 });
    return apiErrorResponse(error, "注册失败");
  }
}
