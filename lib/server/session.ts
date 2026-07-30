import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getNextIdleExpiry, getSessionExpiry, isSessionExpired } from "@/lib/domain/session-policy";
import { evaluateAccountAccess, type AccessCapability, type AccessErrorCode, type AppRole, type StudentStatus } from "@/lib/domain/student-access";
import { getBusinessDate } from "@/lib/server/time";

export const SESSION_COOKIE = "zhilian_session";

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: AppRole;
  enabled: boolean;
  mustChangePassword: boolean;
  sessionVersion: number;
  studentStatus: StudentStatus | null;
  isLongTerm: boolean;
  validFrom: Date | null;
  validUntil: Date | null;
  capability: AccessCapability | null;
  accessErrorCode: AccessErrorCode | null;
};

type SessionClient = Pick<typeof prisma, "authSession">;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(user: Pick<SessionUser, "id" | "role">, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const { idleExpiresAt, absoluteExpiresAt } = getSessionExpiry(user.role, now);
  await prisma.authSession.create({ data: { tokenHash: hashSessionToken(token), userId: user.id, lastSeenAt: now, idleExpiresAt, absoluteExpiresAt } });
  return token;
}

export async function revokeSession(token: string | undefined) {
  if (!token) return;
  await prisma.authSession.updateMany({ where: { tokenHash: hashSessionToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeUserSessions(userId: string, client: SessionClient = prisma) {
  await client.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

function toIsoDate(value: Date | null) {
  if (!value) return null;
  return `${value.getUTCFullYear().toString().padStart(4, "0")}-${(value.getUTCMonth() + 1).toString().padStart(2, "0")}-${value.getUTCDate().toString().padStart(2, "0")}`;
}

function toSessionUser(user: Omit<SessionUser, "capability" | "accessErrorCode">): SessionUser | null {
  const decision = evaluateAccountAccess({
    role: user.role,
    enabled: user.enabled,
    mustChangePassword: user.mustChangePassword,
    studentStatus: user.studentStatus,
    isLongTerm: user.isLongTerm,
    validFrom: toIsoDate(user.validFrom),
    validUntil: toIsoDate(user.validUntil),
  }, getBusinessDate());
  if (!decision.capability && decision.errorCode !== "PASSWORD_CHANGE_REQUIRED") return null;
  return { ...user, capability: decision.capability, accessErrorCode: decision.errorCode };
}

export async function findSessionUser(token: string, now = new Date()): Promise<SessionUser | null> {
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          enabled: true,
          mustChangePassword: true,
          sessionVersion: true,
          studentStatus: true,
          isLongTerm: true,
          validFrom: true,
          validUntil: true,
        },
      },
    },
  });
  if (!session || isSessionExpired(session, now)) return null;

  const updated = await prisma.authSession.updateMany({
    where: { id: session.id, revokedAt: null, idleExpiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
    data: { lastSeenAt: now, idleExpiresAt: getNextIdleExpiry(session.user.role, session.absoluteExpiresAt, now) },
  });
  if (updated.count !== 1) return null;

  return toSessionUser(session.user);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findSessionUser(token);
}

export function setSessionCookie(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
  });
}

export function clearSessionCookie(response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 0,
  });
}
