import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, mapPublicError } from "@/lib/domain/api-error";
import { ServerConfigurationError } from "@/lib/server/env";
import { getCurrentUser } from "@/lib/server/session";

export { ApiError } from "@/lib/domain/api-error";

async function requireExactAccess(role: "ADMIN" | "TEACHER" | "STUDENT", capability: "FULL_ADMIN" | "FULL_TEACHER" | "FULL_STUDENT") {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("请先登录", 401);
  if (user.role !== role || user.capability !== capability) throw new ApiError("权限不足", 403);
  return user;
}

export function requireAdministrator() {
  return requireExactAccess("ADMIN", "FULL_ADMIN");
}

export function requireTeacher() {
  return requireExactAccess("TEACHER", "FULL_TEACHER");
}

export function requireActiveStudent() {
  return requireExactAccess("STUDENT", "FULL_STUDENT");
}

export async function requireLoggedInUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("请先登录", 401);
  return user;
}

async function requireStudentCapability(capability: "REGISTRATION_ONLY" | "ACTIVATION_ONLY") {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("请先登录", 401);
  if (user.role !== "STUDENT" || user.capability !== capability) throw new ApiError("权限不足", 403);
  return user;
}

export function requireRegistrationStudent() {
  return requireStudentCapability("REGISTRATION_ONLY");
}

export function requireActivationStudent() {
  return requireStudentCapability("ACTIVATION_ONLY");
}

export function apiError(error: unknown, fallback: string) {
  if (error instanceof ApiError) return mapPublicError(error, fallback, process.env.NODE_ENV === "production");
  if (error instanceof ServerConfigurationError) return { message: fallback, status: 500 };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { message: "记录已存在，请勿重复提交", status: 409 };
  if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientUnknownRequestError || error instanceof Prisma.PrismaClientValidationError || error instanceof Prisma.PrismaClientInitializationError) return { message: fallback, status: 500 };
  if (error instanceof ZodError) return { message: error.issues[0]?.message ?? fallback, status: 400 };
  return mapPublicError(error, fallback, process.env.NODE_ENV === "production");
}

export function apiErrorResponse(error: unknown, fallback: string) {
  const result = apiError(error, fallback);
  return NextResponse.json({ message: result.message }, { status: result.status });
}
