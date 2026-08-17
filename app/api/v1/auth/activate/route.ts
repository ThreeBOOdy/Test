import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireActivationStudent } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/http";
import { createSession, setSessionCookie } from "@/lib/server/session";
import { activateImportedStudent } from "@/lib/server/student-activation-service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const student = await requireActivationStudent();
    const activated = await activateImportedStudent(student.id, await readJsonBody(request));
    const token = await createSession(activated);
    const response = NextResponse.json({ activated: true, user: { id: activated.id, username: activated.username, role: activated.role, capability: "FULL_STUDENT" } });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return apiErrorResponse(error, "学生激活失败");
  }
}
