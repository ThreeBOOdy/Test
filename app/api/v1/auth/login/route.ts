import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/server/password";
import { createSessionToken } from "@/lib/server/session";
import { publicUrl, setSessionCookie } from "@/lib/server/session-cookie";

const schema = z.object({ username: z.string().trim().min(1), password: z.string().min(8), next: z.string().optional() });

function safeNext(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isForm = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  try {
    const raw = isForm ? Object.fromEntries(await request.formData()) : await request.json();
    const input = schema.parse(raw);
    const user = await prisma.user.findUnique({ where: { username: input.username } });

    if (!user || !user.enabled || !verifyPassword(input.password, user.passwordHash)) {
      if (isForm) {
        const url = publicUrl("/login", request);
        url.searchParams.set("error", "用户名或密码错误");
        if (safeNext(input.next)) url.searchParams.set("next", input.next!);
        return NextResponse.redirect(url, 303);
      }
      return NextResponse.json({ message: "用户名或密码错误" }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    const token = await createSessionToken({ userId: user.id, username: user.username, role: user.role });
    if (isForm) {
      const fallback = user.role === "TEACHER" ? "/teacher" : "/student";
      const destination = user.mustChangePassword ? "/change-password" : safeNext(input.next) ?? fallback;
      return setSessionCookie(NextResponse.redirect(publicUrl(destination, request), 303), token);
    }

    return setSessionCookie(NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    }), token);
  } catch (error) {
    if (isForm) {
      const url = publicUrl("/login", request);
      url.searchParams.set("error", error instanceof Error ? error.message : "登录失败");
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "登录失败" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}