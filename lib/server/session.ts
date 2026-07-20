import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/auth/constants";
import { prisma } from "@/lib/db";

const encoder = new TextEncoder();

type SessionPayload = { userId: string; role: "STUDENT" | "TEACHER"; username: string };
type ActionTokenPayload = { userId: string; action: string };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET 必须至少为 32 个字符");
  return encoder.encode(value);
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
    if (!payload.userId || !payload.username || (payload.role !== "STUDENT" && payload.role !== "TEACHER")) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function createActionToken(userId: string, action: string) {
  return new SignJWT({ userId, action })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("zhilian-practice")
    .setAudience("zhilian-actions")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret());
}

export async function verifyActionToken(token: string, expectedAction: string): Promise<ActionTokenPayload | null> {
  try {
    const result = await jwtVerify(token, secret(), { issuer: "zhilian-practice", audience: "zhilian-actions" });
    const payload = result.payload as Partial<ActionTokenPayload>;
    if (!payload.userId || payload.action !== expectedAction) return null;
    return payload as ActionTokenPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const store = await cookies();
  const tokens = [store.get(SESSION_COOKIE)?.value, store.get(LEGACY_SESSION_COOKIE)?.value]
    .filter((token): token is string => Boolean(token));

  for (const token of tokens) {
    const session = await verifySessionToken(token);
    if (!session) continue;
    const user = await prisma.user.findFirst({
      where: { id: session.userId, enabled: true },
      select: { id: true, username: true, displayName: true, role: true, mustChangePassword: true },
    });
    if (user) return user;
  }

  return null;
}