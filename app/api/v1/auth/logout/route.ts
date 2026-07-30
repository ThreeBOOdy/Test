import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookie, revokeSession, SESSION_COOKIE } from "@/lib/server/session";
import { assertSameOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  assertSameOrigin(request);
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await revokeSession(token);
  const response = NextResponse.json({ loggedOut: true });
  clearSessionCookie(response);
  return response;
}
