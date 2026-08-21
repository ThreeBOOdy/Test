import { NextResponse } from "next/server";

import { apiErrorResponse, requireActiveStudent } from "@/lib/server/api";
import { getStudentMasteryOverview } from "@/lib/server/student-mastery-overview-service";

export async function GET() {
  try {
    const user = await requireActiveStudent();
    return NextResponse.json(await getStudentMasteryOverview(user.id));
  } catch (error) {
    return apiErrorResponse(error, "读取掌握概览失败");
  }
}
