import ExcelJS from "exceljs";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeacher: vi.fn(),
  importBatchCreate: vi.fn(),
  importBatchRowCreateMany: vi.fn(),
  importBatchImageCreateMany: vi.fn(),
  questionFindMany: vi.fn(),
}));

vi.mock("@/lib/server/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api")>("@/lib/server/api");
  return { ...actual, requireTeacher: mocks.requireTeacher };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    question: { findMany: mocks.questionFindMany },
    $transaction: vi.fn((callback: (tx: object) => unknown) => callback({
      importBatch: { create: mocks.importBatchCreate },
      importBatchRow: { createMany: mocks.importBatchRowCreateMany },
      importBatchImage: { createMany: mocks.importBatchImageCreateMany },
    })),
  },
}));

import { POST as previewImport } from "@/app/api/v1/teacher/imports/preview/route";
import { PNG_BYTES, buildDocx as buildImageDocx, drawing, mediaRelationship } from "./fixtures/word-docx";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function documentXml(paragraphs: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}</w:body>
</w:document>`;
}

function paragraph(text: string): string {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

async function buildDocx(lines: string[]): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("word/document.xml", documentXml(lines.map(paragraph).join("")));
  return zip.generateAsync({ type: "arraybuffer" });
}

function uploadFile(buffer: ArrayBuffer, name: string): File {
  const file = new File([buffer], name);
  Object.defineProperty(file, "arrayBuffer", { value: async () => buffer });
  return file;
}

function previewRequest(file: File, fields: Record<string, string> = {}): Request {
  const request = new Request("http://localhost/api/v1/teacher/imports/preview", {
    method: "POST",
    headers: { origin: "http://localhost", host: "localhost" },
  });
  Object.defineProperty(request, "formData", {
    value: async () => ({ get: (key: string) => (key === "file" ? file : (fields[key] ?? null)) }),
  });
  return request;
}

describe("question import preview dispatch", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.requireTeacher.mockResolvedValue({ id: "teacher-1" });
    mocks.questionFindMany.mockResolvedValue([]);
    mocks.importBatchCreate.mockResolvedValue({ id: "batch-word", status: "PREVIEW" });
    mocks.importBatchRowCreateMany.mockResolvedValue({ count: 1 });
    mocks.importBatchImageCreateMany.mockResolvedValue({ count: 1 });
  });

  it("persists extracted word images to the batch table and previews thumbnails with stable ids", async () => {
    const buffer = await buildImageDocx(
      `<w:p><w:r><w:t>1. 含图题干</w:t></w:r>${drawing("rId1")}</w:p>` +
        `<w:p><w:r><w:t>A、选项A</w:t></w:r>${drawing("rId2")}</w:p>` +
        paragraph("B、选项B") +
        paragraph("答案：A"),
      {
        rels: [mediaRelationship("rId1", "media/image1.png"), mediaRelationship("rId2", "media/image2.png")],
        media: { "word/media/image1.png": PNG_BYTES, "word/media/image2.png": PNG_BYTES },
      },
    );

    const response = await previewImport(previewRequest(uploadFile(buffer, "images.docx"), { levelCode: "A", categoryCode: "4.1.1" }));
    const body = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(200);
    const row = body.rows[0];
    const stemMarker = row.row.stem.match(/\[图:(qimg_[a-f0-9]+)\]/);
    const optionMarker = row.row.optionValues.A.match(/\[图:(qimg_[a-f0-9]+)\]/);
    expect(stemMarker).not.toBeNull();
    expect(optionMarker).not.toBeNull();
    expect(row.images).toEqual([
      expect.objectContaining({ id: stemMarker![1], field: "STEM", mimeType: "image/png", sizeBytes: PNG_BYTES.length }),
      expect.objectContaining({ id: optionMarker![1], field: "A", mimeType: "image/png", sizeBytes: PNG_BYTES.length }),
    ]);
    expect(stemMarker![1]).not.toBe(optionMarker![1]);

    const persisted = mocks.importBatchImageCreateMany.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(persisted).toHaveLength(2);
    expect(persisted[0]).toMatchObject({ batchId: "batch-word", rowNumber: 1, field: "STEM", sortOrder: 0, mimeType: "image/png", sizeBytes: PNG_BYTES.length, contentHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(Buffer.from(persisted[0].data as Uint8Array)).toEqual(PNG_BYTES);
    expect(persisted[1]).toMatchObject({ batchId: "batch-word", rowNumber: 1, field: "A", sortOrder: 0, id: optionMarker![1] });
    expect(persisted.map((record) => record.id)).toEqual([stemMarker![1], optionMarker![1]]);

    const storedPayload = mocks.importBatchRowCreateMany.mock.calls[0][0].data[0].payload;
    expect(storedPayload.stem).toContain(`[图:${stemMarker![1]}]`);
    expect(storedPayload).not.toHaveProperty("stemImages");
    expect(storedPayload).not.toHaveProperty("stemLines");
    expect(storedPayload).not.toHaveProperty("optionImages");
    expect(storedPayload).not.toHaveProperty("optionLines");
  });

  it("rejects non-whitelisted image formats per question with a conversion hint", async () => {
    const emfBytes = new Uint8Array([1, 2, 3, 4]);
    const buffer = await buildImageDocx(
      `<w:p><w:r><w:t>1. 公式图题干</w:t></w:r>${drawing("rId1")}</w:p>` +
        paragraph("A、选项A") +
        paragraph("B、选项B") +
        paragraph("答案：A"),
      {
        rels: [mediaRelationship("rId1", "media/image1.emf")],
        media: { "word/media/image1.emf": emfBytes },
      },
    );

    const response = await previewImport(previewRequest(uploadFile(buffer, "formula.docx"), { levelCode: "A", categoryCode: "4.1.1" }));
    const body = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.stats).toMatchObject({ totalRows: 1, validRows: 0, errorRows: 1 });
    expect(body.rows[0].issues).toEqual([
      expect.objectContaining({ severity: "error", field: "图片", message: expect.stringContaining("另存为 PNG 或 JPG 后重新插入") }),
    ]);
    expect(mocks.importBatchImageCreateMany).toHaveBeenCalled();
  });

  it("rejects a single image over 5MB per question", async () => {
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    const buffer = await buildImageDocx(
      `<w:p><w:r><w:t>1. 大图题干</w:t></w:r>${drawing("rId1")}</w:p>` +
        paragraph("A、选项A") +
        paragraph("B、选项B") +
        paragraph("答案：A"),
      {
        rels: [mediaRelationship("rId1", "media/image1.png")],
        media: { "word/media/image1.png": oversized },
      },
    );

    const response = await previewImport(previewRequest(uploadFile(buffer, "large-image.docx"), { levelCode: "A", categoryCode: "4.1.1" }));
    const body = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.rows[0].issues).toEqual([
      expect.objectContaining({ severity: "error", field: "图片", message: expect.stringContaining("5MB") }),
    ]);
  });

  it("rejects more than 10 images in a single question", async () => {
    const rels = Array.from({ length: 11 }, (_, index) => mediaRelationship(`rId${index}`, `media/image${index + 1}.png`));
    const media = Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`word/media/image${index + 1}.png`, PNG_BYTES]));
    const buffer = await buildImageDocx(
      `<w:p><w:r><w:t>1. 多图题干</w:t></w:r>${rels.map((_, index) => drawing(`rId${index}`)).join("")}</w:p>` +
        paragraph("A、选项A") +
        paragraph("B、选项B") +
        paragraph("答案：A"),
      { rels, media },
    );

    const response = await previewImport(previewRequest(uploadFile(buffer, "many-images.docx"), { levelCode: "A", categoryCode: "4.1.1" }));
    const body = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.rows[0].issues).toEqual([
      expect.objectContaining({ severity: "error", field: "图片", message: expect.stringContaining("10 张") }),
    ]);
    expect(mocks.importBatchImageCreateMany).toHaveBeenCalled();
  });

  it("dispatches .docx to the word parser and applies the whole-form level and category", async () => {
    const buffer = await buildDocx([
      "1. 下列关于力的说法正确的是",
      "A、方向",
      "B、大小",
      "答案：A",
      "2、下列关于速度的说法正确的是",
      "A、位移",
      "B、时间",
      "答案：B",
    ]);

    const response = await previewImport(previewRequest(uploadFile(buffer, "题库.docx"), {
      levelCode: "A",
      categoryCode: "4.1.1",
      knowledgePointName: "力学基础",
    }));
    const body = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.source).toBe("WORD");
    expect(body.stats.totalRows).toBe(2);
    expect(body.stats.validRows).toBe(2);
    expect(body.rows.map((item: { row: { locationLabel: string } }) => item.row.locationLabel)).toEqual(["第 1 题", "第 2 题"]);
    expect(body.rows[0].row).toMatchObject({ levelCode: "A", categoryCode: "4.1.1", knowledgePointName: "力学基础" });
    expect(body.rows[0].row.sheetName).toBeUndefined();
    expect(body.rows[0].row.externalQuestionCode).toBeUndefined();
    expect(body.sheetNames).toEqual([]);
    expect(mocks.importBatchCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ fileName: "题库.docx", courseId: expect.any(String), totalRows: 2, validRows: 2 }) });
  });

  it("rejects word uploads when the level or category code is missing", async () => {
    const buffer = await buildDocx(["1. 题干", "A、选项A", "B、选项B", "答案：A"]);

    const withoutLevel = await previewImport(previewRequest(uploadFile(buffer, "q.docx"), { categoryCode: "4.1.1" }));
    expect(withoutLevel.status).toBe(400);
    expect((await withoutLevel.json()).message).toContain("等级");

    const withoutCategory = await previewImport(previewRequest(uploadFile(buffer, "q.docx"), { levelCode: "A" }));
    expect(withoutCategory.status).toBe(400);
    expect((await withoutCategory.json()).message).toContain("分类号");
  });

  it("rejects non-docx and non-xlsx files with a whole-file error", async () => {
    const response = await previewImport(previewRequest(uploadFile(new Uint8Array([1, 2, 3]).buffer as ArrayBuffer, "questions.doc"), { levelCode: "A", categoryCode: "1.1" }));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("仅支持");
    expect(mocks.importBatchCreate).not.toHaveBeenCalled();
  });

  it("rejects a corrupted docx with a whole-file error", async () => {
    const response = await previewImport(previewRequest(uploadFile(new TextEncoder().encode("not a docx").buffer as ArrayBuffer, "broken.docx"), { levelCode: "A", categoryCode: "1.1" }));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("不是有效的 .docx");
  });

  it("rejects a word file without any question numbers", async () => {
    const buffer = await buildDocx(["导入说明：请填写题号。", "每个题型必须写题号。"]);

    const response = await previewImport(previewRequest(uploadFile(buffer, "no-questions.docx"), { levelCode: "A", categoryCode: "1.1" }));

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("未找到题目");
  });

  it("surfaces per-question word parser errors with 第 N 题 locations", async () => {
    const buffer = await buildDocx([
      "1. 判断题",
      "答案：正确",
      "2. 选择题",
      "A、选项A",
      "B、选项B",
      "答案：B",
    ]);

    const response = await previewImport(previewRequest(uploadFile(buffer, "mixed.docx"), { levelCode: "A", categoryCode: "4.1.1" }));
    const body = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.source).toBe("WORD");
    expect(body.stats).toMatchObject({ totalRows: 2, validRows: 1, errorRows: 1 });
    expect(body.rows[0]).toMatchObject({
      row: { rowNumber: 1, locationLabel: "第 1 题" },
      issues: [{ severity: "error", field: "题型", message: "判断题暂不支持导入" }],
    });
    expect(body.rows[1].row.locationLabel).toBe("第 2 题");
    expect(body.rows[1].issues).toEqual([]);
  });

  it("keeps Excel parsing with EXCEL source and worksheet locations", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("题库");
    sheet.addRow(["等级", "分类号", "问题", "答案", "A", "B"]);
    sheet.addRow(["A", "1.1", "题目", "A", "正确", "错误"]);
    const buffer = await workbook.xlsx.writeBuffer();

    const response = await previewImport(previewRequest(uploadFile(buffer, "questions.xlsx")));
    const body = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.source).toBe("EXCEL");
    expect(body.rows[0].row).toMatchObject({ sheetName: "题库", rowNumber: 2 });
    expect(body.rows[0].row.locationLabel).toBeUndefined();
    expect(body.sheetNames).toEqual(["题库"]);
    expect(mocks.importBatchCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ fileName: "questions.xlsx" }) });
  });

  it("rejects xlsx workbooks containing images with a whole-file error and no batch", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("题库");
    sheet.addRow(["等级", "分类号", "问题", "答案"]);
    sheet.addRow(["A", "1.1", "题目", "A"]);
    const imageId = workbook.addImage({ base64: PNG_BASE64, extension: "png" });
    sheet.addImage(imageId, "A2:B4");
    const buffer = await workbook.xlsx.writeBuffer();

    const response = await previewImport(previewRequest(uploadFile(buffer, "questions-with-image.xlsx")));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Excel 不支持图片，请改用 Word 模板");
    expect(mocks.importBatchCreate).not.toHaveBeenCalled();
  });

  it("rejects word files over 20MB with a 413 error", async () => {
    const oversized = new Uint8Array(20 * 1024 * 1024 + 1024).buffer;
    const response = await previewImport(previewRequest(uploadFile(oversized, "large.docx"), { levelCode: "A", categoryCode: "1.1" }));

    expect(response.status).toBe(413);
    expect((await response.json()).message).toContain("20MB");
    expect(mocks.importBatchCreate).not.toHaveBeenCalled();
  });

  it("caps word rows at 5000 like Excel", async () => {
    const lines: string[] = [];
    for (let index = 1; index <= 5001; index += 1) {
      lines.push(`${index}. 第${index}题题干`);
      lines.push("A、选项A");
      lines.push("B、选项B");
      lines.push("答案：A");
    }
    const buffer = await buildDocx(lines);

    const response = await previewImport(previewRequest(uploadFile(buffer, "large.docx"), { levelCode: "A", categoryCode: "1.1" }));
    const body = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.source).toBe("WORD");
    expect(body.stats.totalRows).toBe(5000);
    expect(mocks.importBatchCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ totalRows: 5000 }) });
  });
});
