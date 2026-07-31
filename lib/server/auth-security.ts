import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { LOGIN_FAILURE_LIMIT, LOGIN_WINDOW_MS } from "@/lib/domain/security";

export function hashSecurityIdentifier(value: string) {
  return createHash("sha256").update(`${process.env.AUTH_SECRET ?? "development"}:${value.trim().toLowerCase()}`).digest("hex");
}

export function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function checkLoginRateLimit(username: string, ip: string) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [usernameFailures, ipFailures] = await Promise.all([
    prisma.loginAttempt.count({ where: { usernameHash: hashSecurityIdentifier(username), success: false, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { ipHash: hashSecurityIdentifier(ip), success: false, createdAt: { gte: since } } }),
  ]);
  return usernameFailures >= LOGIN_FAILURE_LIMIT || ipFailures >= LOGIN_FAILURE_LIMIT;
}

export async function recordLoginAttempt(username: string, ip: string, success: boolean) {
  await prisma.loginAttempt.create({ data: { usernameHash: hashSecurityIdentifier(username), ipHash: hashSecurityIdentifier(ip), success } });
}

export async function checkSensitiveDataReauthenticationRateLimit(userId: string, ip: string) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [userFailures, ipFailures] = await Promise.all([
    prisma.sensitiveDataReauthenticationAttempt.count({ where: { userId, success: false, createdAt: { gte: since } } }),
    prisma.sensitiveDataReauthenticationAttempt.count({ where: { ipHash: hashSecurityIdentifier(ip), success: false, createdAt: { gte: since } } }),
  ]);
  return userFailures >= LOGIN_FAILURE_LIMIT || ipFailures >= LOGIN_FAILURE_LIMIT;
}

export async function recordSensitiveDataReauthenticationAttempt(userId: string, ip: string, success: boolean) {
  await prisma.sensitiveDataReauthenticationAttempt.create({ data: { userId, ipHash: hashSecurityIdentifier(ip), success } });
}
