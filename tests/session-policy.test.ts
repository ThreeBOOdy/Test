import { describe, expect, it } from "vitest";
import { getNextIdleExpiry, getSessionExpiry, getSessionPolicy, isSessionExpired } from "@/lib/domain/session-policy";
import { getPasswordMinimumLength, validatePasswordPolicy } from "@/lib/domain/security";

describe("stateful session policy", () => {
  it("applies the role-specific idle and absolute lifetimes", () => {
    expect(getSessionPolicy("STUDENT")).toEqual({ idleTimeoutMs: 60 * 60 * 1000, absoluteTimeoutMs: 60 * 60 * 1000 });
    expect(getSessionPolicy("TEACHER")).toEqual({ idleTimeoutMs: 2 * 60 * 60 * 1000, absoluteTimeoutMs: 8 * 60 * 60 * 1000 });
    expect(getSessionPolicy("ADMIN")).toEqual({ idleTimeoutMs: 30 * 60 * 1000, absoluteTimeoutMs: 4 * 60 * 60 * 1000 });
  });

  it("does not extend an idle deadline beyond absolute expiry", () => {
    const now = new Date("2026-07-30T00:00:00.000Z");
    const expiry = getSessionExpiry("TEACHER", now);
    expect(getNextIdleExpiry("TEACHER", expiry.absoluteExpiresAt, new Date("2026-07-30T07:30:00.000Z"))).toEqual(expiry.absoluteExpiresAt);
  });

  it("rejects revoked, idle-expired, and absolutely expired sessions", () => {
    const now = new Date("2026-07-30T00:00:00.000Z");
    expect(isSessionExpired({ revokedAt: null, idleExpiresAt: new Date(now.getTime() - 1), absoluteExpiresAt: new Date(now.getTime() + 1) }, now)).toBe(true);
    expect(isSessionExpired({ revokedAt: null, idleExpiresAt: new Date(now.getTime() + 1), absoluteExpiresAt: new Date(now.getTime() - 1) }, now)).toBe(true);
    expect(isSessionExpired({ revokedAt: now, idleExpiresAt: new Date(now.getTime() + 1), absoluteExpiresAt: new Date(now.getTime() + 1) }, now)).toBe(true);
  });

  it("enforces separate student and staff password policies", () => {
    expect(getPasswordMinimumLength("STUDENT")).toBe(8);
    expect(getPasswordMinimumLength("TEACHER")).toBe(12);
    expect(validatePasswordPolicy("12345678", "STUDENT")).toBeNull();
    expect(validatePasswordPolicy("12345678", "ADMIN")).toBe("教师和管理员密码至少需要 12 位");
  });
});
