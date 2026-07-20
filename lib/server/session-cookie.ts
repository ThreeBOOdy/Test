import "server-only";
import { NextResponse } from "next/server";
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/constants";

function requestHost(request: Request) {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
}

export function publicUrl(path: string, request: Request) {
  const host = requestHost(request);
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "https" ? "https" : "http";
  return host ? new URL(path, `${protocol}://${host}`) : new URL(path, request.url);
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    expires: new Date(Date.now() + SESSION_MAX_AGE * 1000),
    priority: "high",
  });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(LEGACY_SESSION_COOKIE, "", { httpOnly: true, sameSite: "none", secure: true, path: "/", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}