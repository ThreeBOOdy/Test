import { createHash, randomUUID } from "node:crypto";

import type { DocxImage } from "./docx-content";
import type { ImportQuestionRow, ValidationIssue } from "./types";

/** 图片标记 `[图:qimg_xxx]`，其中 `qimg_xxx` 是图片记录 ID。 */
export const IMAGE_MARKER_PATTERN = /\[图:(qimg_[A-Za-z0-9_-]+)\]/g;

export const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_QUESTION = 10;

export type ImageHashResolver = (imageId: string) => string | undefined;

/** 预检批次级图片记录；提交时以同一 ID 迁入题目级表（ADR 0002）。 */
export type BatchImageRecord = {
  id: string;
  rowNumber: number;
  field: string;
  sortOrder: number;
  data: Uint8Array<ArrayBuffer>;
  mimeType: string;
  sizeBytes: number;
  contentHash: string;
};

export type PreviewRowImage = Pick<BatchImageRecord, "id" | "field" | "mimeType" | "sizeBytes">;

export function createQuestionImageId(): string {
  return `qimg_${randomUUID().replaceAll("-", "")}`;
}

export function imageMarker(imageId: string): string {
  return `[图:${imageId}]`;
}

export function sha256Bytes(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * 把图片标记按图片内容哈希归一化：同一字节内容无论 ID 如何都视为相同，
 * 字节不同才视为内容不同。未知 ID 保留原标记（不产生误判）。
 */
export function normalizeImageMarkers(content: string, hashById: ImageHashResolver): string {
  return content.replace(IMAGE_MARKER_PATTERN, (marker, imageId: string) => {
    const hash = hashById(imageId);
    return hash ? imageMarker(hash) : marker;
  });
}

export function validateQuestionImageLimits(
  images: ReadonlyArray<{ mimeType: string; sizeBytes: number }>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const unsupported = images.filter((image) => !ALLOWED_IMAGE_MIME_TYPES.has(image.mimeType));
  if (unsupported.length) {
    issues.push({
      severity: "error",
      field: "图片",
      message: `含 ${unsupported.length} 张不支持的图片/公式，请将该图片/公式另存为 PNG 或 JPG 后重新插入`,
    });
  }
  const oversized = images.filter((image) => image.sizeBytes > MAX_IMAGE_SIZE_BYTES);
  if (oversized.length) {
    issues.push({
      severity: "error",
      field: "图片",
      message: `含 ${oversized.length} 张超过 5MB 的图片，单张图片不能超过 5MB`,
    });
  }
  if (images.length > MAX_IMAGES_PER_QUESTION) {
    issues.push({
      severity: "error",
      field: "图片",
      message: `每题最多 ${MAX_IMAGES_PER_QUESTION} 张图片，当前共 ${images.length} 张`,
    });
  }
  return issues;
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
