import { NextResponse } from "next/server";
import { ApiError } from "@/lib/domain/api-error";
import { apiErrorResponse, requireLoggedInUser } from "@/lib/server/api";
import { getQuestionImage } from "@/lib/server/question-image";

const IMMUTABLE_CACHE_ONE_YEAR = "public, max-age=31536000, immutable";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireLoggedInUser();
    const { id } = await context.params;
    const image = await getQuestionImage(id);
    if (!image) throw new ApiError("图片不存在", 404);
    return new NextResponse(image.data, {
      headers: {
        "Content-Type": image.mimeType,
        "Content-Length": String(image.sizeBytes),
        "Cache-Control": IMMUTABLE_CACHE_ONE_YEAR,
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "获取图片失败");
  }
}
