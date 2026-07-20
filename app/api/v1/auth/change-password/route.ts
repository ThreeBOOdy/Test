import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { getCurrentUser } from "@/lib/server/session";

const schema = z.object({ currentPassword: z.string().min(8).max(128), newPassword: z.string().min(8).max(128) }).refine((input) => input.currentPassword !== input.newPassword, { message: "新密码不能与当前密码相同", path: ["newPassword"] });

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ message: "请先登录" }, { status: 401 });
    const input = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: currentUser.id } });
    if (!user || !verifyPassword(input.currentPassword, user.passwordHash)) {
      return NextResponse.json({ message: "当前密码不正确" }, { status: 400 });
    }
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(input.newPassword), mustChangePassword: false } });
    return NextResponse.json({ saved: true, role: user.role });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "修改密码失败" }, { status: 400 });
  }
}