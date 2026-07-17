import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "zhilian_session";
const encoder = new TextEncoder();

type SessionPayload = { userId: string; role: "STUDENT" | "TEACHER"; username: string };

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

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return prisma.user.findFirst({ where: { id: session.userId, enabled: true }, select: { id: true, username: true, displayName: true, role: true, mustChangePassword: true } });
}
