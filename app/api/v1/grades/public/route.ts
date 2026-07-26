import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const grades = await prisma.grade.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, code: true, name: true } });
  return NextResponse.json({ grades }, { headers: { "Cache-Control": "no-store" } });
}
