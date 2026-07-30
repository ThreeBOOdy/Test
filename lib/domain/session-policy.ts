import type { AppRole } from "@/lib/domain/student-access";

export type SessionPolicy = {
  idleTimeoutMs: number;
  absoluteTimeoutMs: number;
};

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const policies: Record<AppRole, SessionPolicy> = {
  STUDENT: { idleTimeoutMs: HOUR, absoluteTimeoutMs: HOUR },
  TEACHER: { idleTimeoutMs: 2 * HOUR, absoluteTimeoutMs: 8 * HOUR },
  ADMIN: { idleTimeoutMs: 30 * MINUTE, absoluteTimeoutMs: 4 * HOUR },
};

export function getSessionPolicy(role: AppRole): SessionPolicy {
  return policies[role];
}

export function getSessionExpiry(role: AppRole, now = new Date()) {
  const policy = getSessionPolicy(role);
  const absoluteExpiresAt = new Date(now.getTime() + policy.absoluteTimeoutMs);
  return {
    absoluteExpiresAt,
    idleExpiresAt: new Date(Math.min(now.getTime() + policy.idleTimeoutMs, absoluteExpiresAt.getTime())),
  };
}

export function getNextIdleExpiry(role: AppRole, absoluteExpiresAt: Date, now = new Date()) {
  return new Date(Math.min(now.getTime() + getSessionPolicy(role).idleTimeoutMs, absoluteExpiresAt.getTime()));
}

export function isSessionExpired(session: { idleExpiresAt: Date; absoluteExpiresAt: Date; revokedAt: Date | null }, now = new Date()) {
  return session.revokedAt !== null || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now;
}
