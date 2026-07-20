import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/server/password";
import { getCurrentUser } from "@/lib/server/session";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), displayName: z.string().trim().min(1).max(100), enabled: z.boolean() }),
  z.object({ action: z.literal("resetPassword") }),
]);

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "登录状态已失效，请重新登录" }, { status: 401 });
    if (user.role !== "TEACHER") return NextResponse.json({ message: "当前账号没有教师权限" }, { status: 403 });
    const { id } = await context.params;
    const input = schema.parse(await request.json());
    const student = await prisma.user.findFirst({ where: { id, role: "STUDENT" } });
    if (!student) throw new Error("学生账号不存在");
    if (input.action === "resetPassword") {
      const temporaryPassword = randomBytes(9).toString("base64url");
      await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(temporaryPassword), mustChangePassword: true } });
      return NextResponse.json({ temporaryPassword });
    }
    await prisma.user.update({ where: { id }, data: { displayName: input.displayName, enabled: input.enabled } });
    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "更新学生失败" }, { status: 400 });
  }
}