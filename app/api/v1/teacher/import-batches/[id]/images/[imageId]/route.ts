import { NextResponse } from "next/server";
import { apiErrorResponse, requireTeacher } from "@/lib/server/api";
import { getImportBatchImage } from "@/lib/server/import-service";

const IMMUTABLE_CACHE_ONE_YEAR = "private, max-age=31536000, immutable";

export async function GET(_request: Request, context: { params: Promise<{ id: string; imageId: string }> }) {
  try {
    const user = await requireTeacher();
    const { id, imageId } = await context.params;
    const image = await getImportBatchImage(user.id, id, imageId);
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
