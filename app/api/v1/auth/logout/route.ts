import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/session";
import { assertSameOrigin } from "@/lib/server/http";

export async function POST(request: Request) {
  assertSameOrigin(request);
  const response = NextResponse.json({ loggedOut: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "true", path: "/", maxAge: 0 });
  return response;
}
