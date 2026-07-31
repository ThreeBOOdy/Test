import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RADIO_COURSE_ID } from "@/lib/domain/course";
import { createPageResult, normalizePagination } from "@/lib/server/pagination";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";

export async function GET(request: Request) {
  try {
    const user = await requireTeacher();
    const url = new URL(request.url);
    const { page, pageSize, skip } = normalizePagination({ page: url.searchParams.get("page") ?? undefined, pageSize: url.searchParams.get("pageSize") ?? undefined });
    const status = url.searchParams.get("status");
    const where = { courseId: RADIO_COURSE_ID, importedById: user.id, ...(status && ["PREVIEW", "COMMITTED", "REVERTED", "FAILED"].includes(status) ? { status: status as "PREVIEW" | "COMMITTED" | "REVERTED" | "FAILED" } : {}) };
    const [items, total] = await Promise.all([
      prisma.importBatch.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize, select: { id: true, fileName: true, status: true, totalRows: true, validRows: true, warningRows: true, errorRows: true, insertedRows: true, duplicateRows: true, createdAt: true, committedAt: true, revertedAt: true, expiresAt: true } }),
      prisma.importBatch.count({ where }),
    ]);
    return NextResponse.json(createPageResult(items, total, page, pageSize));
  } catch (error) {
    return apiErrorResponse(error, "读取导入批次失败");
  }
}
