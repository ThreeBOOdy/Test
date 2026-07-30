import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { createTeacherAccount, listTeachers } from "@/lib/server/teacher-account-service";
import { assertSameOrigin } from "@/lib/server/http";

export async function GET() {
  try { await requireAdministrator(); return NextResponse.json({ items: await listTeachers() }); }
  catch (error) { return apiErrorResponse(error, "读取教师账号失败"); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const administrator = await requireAdministrator();
    return NextResponse.json(await createTeacherAccount(administrator.id, await readJsonBody(request)), { status: 201 });
  } catch (error) { return apiErrorResponse(error, "创建教师账号失败"); }
}
