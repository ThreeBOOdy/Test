import JSZip from "jszip";

import { ApiError } from "./api-error";

const EXCEL_MEDIA_PREFIX = "xl/media/";

/**
 * 预检 .xlsx 工作簿是否含图：嵌入图片统一存放在 xl/media/ 目录，
 * 检测到任何媒体即整份拒绝，提示改用 Word 模板。
 */
export async function assertExcelHasNoImages(buffer: ArrayBuffer | Uint8Array): Promise<void> {
  const archive = await JSZip.loadAsync(buffer);
  const containsImages = Object.keys(archive.files).some((name) => name.toLowerCase().startsWith(EXCEL_MEDIA_PREFIX));
  if (containsImages) throw new ApiError("Excel 不支持图片，请改用 Word 模板", 400);
}
