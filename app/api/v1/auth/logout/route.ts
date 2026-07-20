import { NextResponse } from "next/server";
import { clearSessionCookie, publicUrl } from "@/lib/server/session-cookie";

export async function POST(request: Request) {
  return clearSessionCookie(NextResponse.redirect(publicUrl("/", request)));
}
