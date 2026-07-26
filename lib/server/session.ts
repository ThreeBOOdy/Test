import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { evaluateAccountAccess, type AccessCapability, type AccessErrorCode, type AppRole, type StudentStatus } from "@/lib/domain/student-access";
import { assertProductionAuthEnvironment } from "@/lib/server/env";
import { getBusinessDate } from "@/lib/server/time";

export const SESSION_COOKIE = "zhilian_session";
const encoder = new TextEncoder();

export type SessionPayload = { userId: string; role: AppRole; username: string; sessionVersion: number };

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

function secret() {
  return encoder.encode(assertProductionAuthEnvironment());
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("zhilian-practice")
    .setAudience("zhilian-web")
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const result = await jwtVerify(token, secret(), { issuer: "zhilian-practice", audience: "zhilian-web" });
    const payload = result.payload as Partial<SessionPayload>;
    if (!payload.userId || !payload.username || typeof payload.sessionVersion !== "number" || !isAppRole(payload.role)) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

function isAppRole(role: unknown): role is AppRole {
  return role === "ADMIN" || role === "TEACHER" || role === "STUDENT";
}

function toIsoDate(value: Date | null) {
  if (!value) return null;
  return `${value.getUTCFullYear().toString().padStart(4, "0")}-${(value.getUTCMonth() + 1).toString().padStart(2, "0")}-${value.getUTCDate().toString().padStart(2, "0")}`;
}

export async function findSessionUser(session: SessionPayload): Promise<SessionUser | null> {
  const user = await prisma.user.findFirst({
    where: { id: session.userId, sessionVersion: session.sessionVersion },
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
  });
  if (!user) return null;

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

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return findSessionUser(session);
}
