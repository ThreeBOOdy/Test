import { createHash, randomUUID } from "node:crypto";

import type { DocxImage } from "@/lib/domain/docx-content";
import { imageMarker, type BatchImageRecord } from "@/lib/domain/question-image-marker";
import type { ImportQuestionRow } from "@/lib/domain/types";

/**
 * Server-side helpers for question image IDs/hashes.
 *
 * These were split out of `lib/domain/question-image-marker.ts` because that
 * module is also imported by client components (question manager, rich text).
 * `node:crypto` cannot be bundled into the browser, so any crypto-dependent
 * logic must stay in a server-only module.
 */

export function createQuestionImageId(): string {
  return `qimg_${randomUUID().replaceAll("-", "")}`;
}

export function sha256Bytes(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export type PreparedQuestionImages = {
  stem: string;
  optionValues: Record<string, string | undefined>;
  records: BatchImageRecord[];
};

/**
 * 为一行题目分配稳定的 `qimg_*` ID、把图片标记嵌入题干/选项文本（行内顺序即
 * 文档顺序），并产出写入批次级表的图片记录。无图行文本与返回记录均原样。
 */
export function prepareQuestionRowImages(
  row: Pick<ImportQuestionRow, "stem" | "stemLines" | "optionValues" | "optionLines">,
  rowNumber: number,
  idFactory: () => string = createQuestionImageId,
): PreparedQuestionImages {
  const records: BatchImageRecord[] = [];
  const sortOrderByField = new Map<string, number>();

  const embed = (text: string, images: DocxImage[] | undefined, field: string): string => {
    let result = text;
    for (const image of images ?? []) {
      const sortOrder = sortOrderByField.get(field) ?? 0;
      sortOrderByField.set(field, sortOrder + 1);
      records.push({
        id: idFactory(),
        rowNumber,
        field,
        sortOrder,
        data: new Uint8Array(image.data),
        mimeType: image.contentType,
        sizeBytes: image.size,
        contentHash: sha256Bytes(image.data),
      });
      result += imageMarker(records[records.length - 1].id);
    }
    return result;
  };

  let stem = row.stem;
  if (row.stemLines?.length) {
    stem = row.stemLines.map((line) => embed(line.text, line.images, "STEM")).join("\n").trim();
  }
  const optionValues = { ...row.optionValues };
  if (row.optionLines) {
    for (const [optionId, lines] of Object.entries(row.optionLines)) {
      optionValues[optionId] = lines.map((line) => embed(line.text, line.images, optionId)).join("\n").trim();
    }
  }
  return { stem, optionValues, records };
}
