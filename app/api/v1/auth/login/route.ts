import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/server/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/server/session";

const schema = z.object({ username: z.string().trim().min(1), password: z.string().min(8) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { username: input.username } });
    if (!user || !user.enabled || !verifyPassword(input.password, user.passwordHash)) {
      return NextResponse.json({ message: "用户名或密码错误" }, { status: 401 });
    }
    const token = await createSessionToken({ userId: user.id, username: user.username, role: user.role });
    const response = NextResponse.json({ user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, mustChangePassword: user.mustChangePassword } });
    response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "登录失败" }, { status: 400 });
  }
}
