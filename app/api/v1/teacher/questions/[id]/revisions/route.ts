import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { RADIO_COURSE_ID } from "@/lib/domain/course";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireTeacher();
    const { id } = await context.params;
    const question = await prisma.question.findFirst({ where: { id, courseId: RADIO_COURSE_ID }, select: { id: true } });
    if (!question) throw new ApiError("题目不存在", 404);
    const revisions = await prisma.questionRevision.findMany({ where: { questionId: id, courseId: RADIO_COURSE_ID }, include: { actor: { select: { displayName: true } } }, orderBy: { revision: "desc" } });
    return NextResponse.json({ revisions: revisions.map((revision) => ({ revision: revision.revision, snapshot: revision.snapshot, changeSource: revision.changeSource, createdAt: revision.createdAt.toISOString(), actorName: revision.actor?.displayName ?? "系统" })) });
  } catch (error) {
    return apiErrorResponse(error, "读取题目修订失败");
  }
}
