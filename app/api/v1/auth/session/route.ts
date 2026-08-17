import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, message: "登录状态未保存" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ authenticated: true, user }, { headers: { "Cache-Control": "no-store" } });
}