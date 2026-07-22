export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 10) return "密码至少需要 10 位";
  if (password.length > 128) return "密码不能超过 128 位";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "密码必须同时包含字母和数字";
  return null;
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_FAILURE_LIMIT = 5;

export function isLoginBlocked(failureTimes: readonly Date[], now = new Date()) {
  const threshold = now.getTime() - LOGIN_WINDOW_MS;
  return failureTimes.filter((time) => time.getTime() >= threshold && time.getTime() <= now.getTime()).length >= LOGIN_FAILURE_LIMIT;
}
