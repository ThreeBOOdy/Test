import { describe, expect, it } from "vitest";

import type { DocxImage } from "../lib/domain/docx-content";
import {
  createQuestionImageId,
  imageMarker,
  normalizeImageMarkers,
  prepareQuestionRowImages,
  validateQuestionImageLimits,
} from "../lib/domain/question-image-marker";
import type { ImportQuestionRow } from "../lib/domain/types";

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function image(overrides: Partial<DocxImage> = {}): DocxImage {
  return {
    id: "image1.png",
    data: pngBytes,
    contentType: "image/png",
    extension: "png",
    size: pngBytes.length,
    paragraphIndex: 0,
    ...overrides,
  };
}

function wordRow(overrides: Partial<ImportQuestionRow> = {}): ImportQuestionRow {
  return {
    rowNumber: 1,
    levelCode: "A",
    categoryCode: "4.1.1",
    stem: "题干",
    rawAnswer: "A",
    optionValues: { A: "选项A", B: "选项B" },
    ...overrides,
  };
}

describe("question image markers", () => {
  it("creates unique qimg_ ids", () => {
    const first = createQuestionImageId();
    const second = createQuestionImageId();

    expect(first).toMatch(/^qimg_[a-f0-9]+$/);
    expect(first).not.toBe(second);
  });

  it("embeds and resolves image markers", () => {
    const marker = imageMarker("qimg_abc123");

    expect(marker).toBe("[图:qimg_abc123]");
    expect(normalizeImageMarkers(`题干 ${marker} 结束`, (id) => (id === "qimg_abc123" ? "hash-1" : undefined))).toBe("题干 [图:hash-1] 结束");
    expect(normalizeImageMarkers(`未知 ${marker}`, () => undefined)).toBe("未知 [图:qimg_abc123]");
  });
});

describe("question image whitelist and limits", () => {
  it("accepts whitelisted formats within limits", () => {
    const issues = validateQuestionImageLimits(Array.from({ length: 10 }, () => ({ mimeType: "image/png", sizeBytes: 1024 })));

    expect(issues).toEqual([]);
  });

  it("rejects non-whitelisted formats per question with a conversion hint", () => {
    const issues = validateQuestionImageLimits([
      { mimeType: "image/x-emf", sizeBytes: 100 },
      { mimeType: "image/tiff", sizeBytes: 100 },
    ]);

    expect(issues).toEqual([
      expect.objectContaining({ severity: "error", field: "图片", message: expect.stringContaining("另存为 PNG 或 JPG 后重新插入") }),
    ]);
  });

  it("rejects a single image over 5MB and more than 10 images per question", () => {
    const issues = validateQuestionImageLimits([
      { mimeType: "image/png", sizeBytes: 5 * 1024 * 1024 + 1 },
      ...Array.from({ length: 10 }, () => ({ mimeType: "image/jpeg", sizeBytes: 100 })),
    ]);

    expect(issues).toEqual([
      expect.objectContaining({ severity: "error", field: "图片", message: expect.stringContaining("5MB") }),
      expect.objectContaining({ severity: "error", field: "图片", message: expect.stringContaining("10 张") }),
    ]);
  });
});

describe("question row image preparation", () => {
  it("embeds markers in document order and builds batch image records", () => {
    const row = wordRow({
      stemLines: [
        { text: "题干", images: [image({ id: "a.png" }), image({ id: "b.png" })] },
        { text: "续行", images: [image({ id: "c.png", paragraphIndex: 1 })] },
      ],
      optionLines: {
        A: [{ text: "选项A", images: [image({ id: "d.png", paragraphIndex: 2 })] }],
        B: [{ text: "选项B", images: [] }],
      },
      stemImages: [image(), image(), image()],
      optionImages: { A: [image()] },
    });
    let idCounter = 0;

    const prepared = prepareQuestionRowImages(row, 7, () => `qimg_${++idCounter}`);

    expect(prepared.stem).toBe("题干[图:qimg_1][图:qimg_2]\n续行[图:qimg_3]");
    expect(prepared.optionValues.A).toBe("选项A[图:qimg_4]");
    expect(prepared.optionValues.B).toBe("选项B");
    expect(prepared.records).toEqual([
      expect.objectContaining({ id: "qimg_1", rowNumber: 7, field: "STEM", sortOrder: 0, mimeType: "image/png", sizeBytes: pngBytes.length }),
      expect.objectContaining({ id: "qimg_2", rowNumber: 7, field: "STEM", sortOrder: 1 }),
      expect.objectContaining({ id: "qimg_3", rowNumber: 7, field: "STEM", sortOrder: 2 }),
      expect.objectContaining({ id: "qimg_4", rowNumber: 7, field: "A", sortOrder: 0 }),
    ]);
    expect(prepared.records[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("leaves rows without images untouched and produces no records", () => {
    const row = wordRow();

    const prepared = prepareQuestionRowImages(row, 1);

    expect(prepared.stem).toBe("题干");
    expect(prepared.optionValues).toEqual({ A: "选项A", B: "选项B" });
    expect(prepared.records).toEqual([]);
  });
});
