import type { AppRole } from "@/lib/domain/student-access";

export function getPasswordMinimumLength(role: AppRole) {
  return role === "STUDENT" ? 8 : 12;
}

export function validatePasswordPolicy(password: string, role: AppRole): string | null {
  const minimumLength = getPasswordMinimumLength(role);
  if (password.length < minimumLength) return `${role === "STUDENT" ? "学生" : "教师和管理员"}密码至少需要 ${minimumLength} 位`;
  if (password.length > 128) return "密码不能超过 128 位";
  return null;
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_FAILURE_LIMIT = 5;

export function isLoginBlocked(failureTimes: readonly Date[], now = new Date()) {
  const threshold = now.getTime() - LOGIN_WINDOW_MS;
  return failureTimes.filter((time) => time.getTime() >= threshold && time.getTime() <= now.getTime()).length >= LOGIN_FAILURE_LIMIT;
}
