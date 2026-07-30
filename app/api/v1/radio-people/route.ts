import { NextResponse } from "next/server";
import { listAvailableRadioPeople } from "@/lib/server/student-account-service";

export async function GET() {
  return NextResponse.json(await listAvailableRadioPeople(), { headers: { "Cache-Control": "no-store" } });
}