import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { assertExcelHasNoImages } from "../lib/domain/workbook-images";

const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function buildWorkbook(withImage: boolean) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("题库");
  sheet.addRow(["等级", "分类号", "问题", "答案"]);
  sheet.addRow(["A", "1.1", "题干", "A"]);
  if (withImage) {
    const imageId = workbook.addImage({ base64: PNG_BASE64, extension: "png" });
    sheet.addImage(imageId, "A2:B4");
  }
  return workbook.xlsx.writeBuffer();
}

describe("excel image detection", () => {
  it("rejects an xlsx workbook that embeds any image", async () => {
    await expect(assertExcelHasNoImages(await buildWorkbook(true))).rejects.toThrow("Excel 不支持图片，请改用 Word 模板");
  });

  it("accepts an xlsx workbook without images", async () => {
    await expect(assertExcelHasNoImages(await buildWorkbook(false))).resolves.toBeUndefined();
  });
});
