import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, mapPublicError } from "@/lib/domain/api-error";
import { getCurrentUser } from "@/lib/server/session";

export { ApiError } from "@/lib/domain/api-error";

export async function requireRole(role: "STUDENT" | "TEACHER") {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("请先登录", 401);
  if (user.role !== role) throw new ApiError("权限不足", 403);
  return user;
}

export function apiError(error: unknown, fallback: string) {
  if (error instanceof ApiError) return mapPublicError(error, fallback, process.env.NODE_ENV === "production");
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { message: "记录已存在，请勿重复提交", status: 409 };
  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError || error instanceof Prisma.PrismaClientValidationError || error instanceof Prisma.PrismaClientInitializationError) return { message: fallback, status: 500 };
  if (error instanceof ZodError) return { message: error.issues[0]?.message ?? fallback, status: 400 };
  return mapPublicError(error, fallback, process.env.NODE_ENV === "production");
}

export function apiErrorResponse(error: unknown, fallback: string) {
  const result = apiError(error, fallback);
  return NextResponse.json({ message: result.message }, { status: result.status });
}
