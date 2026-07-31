import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/domain/request-body";
import { apiErrorResponse, requireAdministrator } from "@/lib/server/api";
import { checkSensitiveDataReauthenticationRateLimit, getClientIp, recordSensitiveDataReauthenticationAttempt } from "@/lib/server/auth-security";
import { assertSameOrigin } from "@/lib/server/http";
import { writeAuditLog } from "@/lib/server/audit";
import { hasRecentCurrentAdministratorReauthentication, reauthenticateCurrentAdministrator } from "@/lib/server/session";
import { revealStudentSensitiveField } from "@/lib/server/student-account-service";

const reauthenticationSchema = z.object({ password: z.string().min(1).max(128) }).strict();
const fieldSchema = z.object({ field: z.enum(["nationalId", "phone"]) }).strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const administrator = await requireAdministrator();
    const source = getClientIp(request);
    const { password } = reauthenticationSchema.parse(await readJsonBody(request));
    if (await checkSensitiveDataReauthenticationRateLimit(administrator.id, source)) {
      await writeAuditLog({ actorUserId: administrator.id, action: "STUDENT_SENSITIVE_DATA_REAUTH", targetType: "User", targetId: administrator.id, metadata: { source, result: "RATE_LIMITED" } });
      return NextResponse.json({ message: "重新验证尝试过多，请 15 分钟后重试" }, { status: 429 });
    }
    const reverified = await reauthenticateCurrentAdministrator(password);
    await recordSensitiveDataReauthenticationAttempt(administrator.id, source, reverified);
    await writeAuditLog({ actorUserId: administrator.id, action: "STUDENT_SENSITIVE_DATA_REAUTH", targetType: "User", targetId: administrator.id, metadata: { source, result: reverified ? "SUCCESS" : "FAILED" } });
    if (!reverified) return NextResponse.json({ message: "密码验证失败" }, { status: 401 });
    return NextResponse.json({ reverified: true, expiresInSeconds: 300 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, "重新验证失败");
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let administratorId: string | undefined;
  let studentId: string | undefined;
  let field: "nationalId" | "phone" | undefined;
  const source = getClientIp(request);
  try {
    const administrator = await requireAdministrator();
    administratorId = administrator.id;
    ({ id: studentId } = await context.params);
    field = fieldSchema.parse(Object.fromEntries(new URL(request.url).searchParams)).field;
    if (!await hasRecentCurrentAdministratorReauthentication()) {
      await writeAuditLog({ actorUserId: administratorId, action: "STUDENT_SENSITIVE_DATA_VIEW", targetType: "User", targetId: studentId, metadata: { field, source, result: "REAUTH_REQUIRED" } });
      return NextResponse.json({ message: "请先重新验证管理员密码" }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json(await revealStudentSensitiveField({ administratorId, studentId, field, source }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error, "读取敏感资料失败");
  }
}
