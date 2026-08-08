import { describe, expect, it } from "vitest";

import type { DocxImage } from "../lib/domain/docx-content";
import {
  createQuestionImageId,
  extractImageMarkers,
  imageMarker,
  normalizeImageMarkers,
  prepareQuestionRowImages,
  revalidateCommitRowImages,
  splitImageMarkerText,
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

  it("splits pure text into a single text segment", () => {
    expect(splitImageMarkerText("纯文本题目")).toEqual([{ type: "text", text: "纯文本题目" }]);
  });

  it("splits a single image marker with surrounding text", () => {
    expect(splitImageMarkerText("请看图[图:qimg_1]后作答")).toEqual([
      { type: "text", text: "请看图" },
      { type: "image", imageId: "qimg_1" },
      { type: "text", text: "后作答" },
    ]);
  });

  it("splits multiple adjacent and separated image markers in document order", () => {
    expect(splitImageMarkerText("前[图:qimg_1][图:qimg_2]中[图:qimg_3]后")).toEqual([
      { type: "text", text: "前" },
      { type: "image", imageId: "qimg_1" },
      { type: "image", imageId: "qimg_2" },
      { type: "text", text: "中" },
      { type: "image", imageId: "qimg_3" },
      { type: "text", text: "后" },
    ]);
  });

  it("keeps bracket text that is not a question image marker unchanged", () => {
    expect(splitImageMarkerText("[图:not-qimg] [普通括号]")).toEqual([
      { type: "text", text: "[图:not-qimg] [普通括号]" },
    ]);
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

describe("commit-time image recheck", () => {
  function batchImage(overrides: Record<string, unknown> = {}) {
    return {
      id: "qimg_1",
      rowNumber: 7,
      field: "STEM",
      sortOrder: 0,
      mimeType: "image/png",
      sizeBytes: 1024,
      ...overrides,
    };
  }

  it("extracts image markers in document order", () => {
    expect(extractImageMarkers("题干[图:qimg_1][图:qimg_2] 结束")).toEqual(["qimg_1", "qimg_2"]);
    expect(extractImageMarkers("纯文本")).toEqual([]);
  });

  it("accepts a row whose markers match the batch records for row, field and order", () => {
    const row = wordRow({
      rowNumber: 7,
      stem: "题干[图:qimg_1][图:qimg_2]",
      optionValues: { A: "选项A[图:qimg_3]", B: "选项B" },
    });
    const images = [
      batchImage({ id: "qimg_1", sortOrder: 0 }),
      batchImage({ id: "qimg_2", sortOrder: 1 }),
      batchImage({ id: "qimg_3", field: "A", sortOrder: 0 }),
    ];

    expect(revalidateCommitRowImages(row, images)).toEqual([]);
  });

  it("rejects markers that do not belong to the batch", () => {
    const row = wordRow({ rowNumber: 7, stem: "题干[图:qimg_unknown]" });

    const issues = revalidateCommitRowImages(row, [batchImage()]);

    expect(issues).toEqual([
      expect.objectContaining({ severity: "error", field: "图片", message: expect.stringContaining("不属于当前批次") }),
    ]);
  });

  it.each([
    ["another row", { rowNumber: 8 }],
    ["wrong field", { field: "A" }],
    ["wrong order", { sortOrder: 1 }],
  ] as const)("rejects an image attributed to %s", (_label, overrides) => {
    const row = wordRow({ rowNumber: 7, stem: "题干[图:qimg_1]" });

    const issues = revalidateCommitRowImages(row, [batchImage(overrides)]);

    expect(issues).toEqual([
      expect.objectContaining({ severity: "error", field: "图片", message: expect.stringContaining("归属与预检结果不一致") }),
    ]);
  });

  it("rejects a row where a batch image is not referenced by any marker", () => {
    const row = wordRow({ rowNumber: 7, stem: "题干[图:qimg_1]" });

    const issues = revalidateCommitRowImages(row, [
      batchImage({ id: "qimg_1" }),
      batchImage({ id: "qimg_2", sortOrder: 1 }),
    ]);

    expect(issues).toEqual([
      expect.objectContaining({ severity: "error", field: "图片", message: expect.stringContaining("图片标记与批次记录不一致") }),
    ]);
  });

  it("rejects a row with a repeated marker reference", () => {
    const row = wordRow({ rowNumber: 7, stem: "题干[图:qimg_1][图:qimg_1]" });

    const issues = revalidateCommitRowImages(row, [batchImage()]);

    expect(issues).toEqual([
      expect.objectContaining({ severity: "error", field: "图片", message: expect.stringContaining("重复引用") }),
    ]);
  });

  it("reapplies the whitelist and per-question limits at commit time", () => {
    const row = wordRow({ rowNumber: 7, stem: "题干[图:qimg_1]" });
    const oversized = batchImage({ id: "qimg_2", sortOrder: 1, sizeBytes: 5 * 1024 * 1024 + 1 });
    const unsupported = batchImage({ id: "qimg_3", sortOrder: 2, mimeType: "image/tiff" });

    const issues = revalidateCommitRowImages(
      { ...row, stem: "题干[图:qimg_1][图:qimg_2][图:qimg_3]" },
      [batchImage(), oversized, unsupported],
    );

    expect(issues).toEqual([
      expect.objectContaining({ severity: "error", field: "图片", message: expect.stringContaining("另存为 PNG 或 JPG 后重新插入") }),
      expect.objectContaining({ severity: "error", field: "图片", message: expect.stringContaining("5MB") }),
    ]);
  });
});
