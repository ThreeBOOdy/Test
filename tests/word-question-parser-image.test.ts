import { describe, expect, it } from "vitest";

import { extractDocxContent } from "../lib/domain/docx-content";
import { extractDocxText } from "../lib/domain/docx-text";
import { parseWordContent, parseWordQuestions } from "../lib/domain/word-question-parser";
import { PNG_BYTES, buildDocx, drawing, mediaRelationship, paragraph } from "./fixtures/word-docx";

async function parseDocx(paragraphs: string, rels: string[], media: Record<string, Uint8Array> = { "word/media/image1.png": PNG_BYTES }) {
  const buffer = await buildDocx(paragraphs, { rels, media });
  return { rows: (await parseWordContent(await extractDocxContent(buffer))).rows, buffer };
}

describe("word content parser image field assignment", () => {
  it("assigns an image in a stem paragraph to the stem with its paragraph index", async () => {
    const { rows } = await parseDocx(
      `<w:p><w:r><w:t>1. 题干</w:t></w:r>${drawing("rId5")}</w:p>` +
        paragraph("A、选项A") +
        paragraph("B、选项B") +
        paragraph("答案：A"),
      [mediaRelationship("rId5", "media/image1.png")],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].stem).toBe("题干");
    expect(rows[0].optionValues).toEqual({ A: "选项A", B: "选项B" });
    expect(rows[0].stemImages).toEqual([
      expect.objectContaining({ id: "image1.png", contentType: "image/png", paragraphIndex: 0 }),
    ]);
    expect(rows[0].optionImages).toBeUndefined();
  });

  it("keeps multiple stem images in document order", async () => {
    const { rows } = await parseDocx(
      `<w:p><w:r><w:t>1. </w:t></w:r>${drawing("rId5")}<w:r><w:t>题干</w:t></w:r>${drawing("rId6")}</w:p>` +
        paragraph("A、选项A") +
        paragraph("答案：A"),
      [mediaRelationship("rId5", "media/image1.png"), mediaRelationship("rId6", "media/image2.png")],
      { "word/media/image1.png": PNG_BYTES, "word/media/image2.png": PNG_BYTES },
    );

    expect(rows[0].stemImages?.map((image) => image.id)).toEqual(["image1.png", "image2.png"]);
  });

  it("assigns an image in an option paragraph to that specific option", async () => {
    const { rows } = await parseDocx(
      paragraph("1. 题干") +
        `<w:p><w:r><w:t>A、选项A</w:t></w:r>${drawing("rId5")}</w:p>` +
        paragraph("B、选项B") +
        paragraph("答案：A"),
      [mediaRelationship("rId5", "media/image1.png")],
    );

    expect(rows[0].stemImages).toBeUndefined();
    expect(rows[0].optionImages).toEqual({
      A: [expect.objectContaining({ id: "image1.png", paragraphIndex: 1 })],
    });
    expect(rows[0].optionValues.A).toBe("选项A");
  });

  it("ignores images on answer lines without errors", async () => {
    const { rows } = await parseDocx(
      paragraph("1. 题干") +
        paragraph("A、选项A") +
        paragraph("B、选项B") +
        `<w:p><w:r><w:t>答案：A</w:t></w:r>${drawing("rId5")}</w:p>`,
      [mediaRelationship("rId5", "media/image1.png")],
    );

    expect(rows[0].rawAnswer).toBe("A");
    expect(rows[0].stemImages).toBeUndefined();
    expect(rows[0].optionImages).toBeUndefined();
  });

  it("ignores images on explanation lines and in image-only paragraphs inside the explanation", async () => {
    const { rows } = await parseDocx(
      paragraph("1. 题干") +
        paragraph("A、选项A") +
        paragraph("B、选项B") +
        paragraph("答案：A") +
        `<w:p><w:r><w:t>解析：讲解文字</w:t></w:r>${drawing("rId5")}</w:p>` +
        `<w:p>${drawing("rId6")}</w:p>`,
      [mediaRelationship("rId5", "media/image1.png"), mediaRelationship("rId6", "media/image2.png")],
      { "word/media/image1.png": PNG_BYTES, "word/media/image2.png": PNG_BYTES },
    );

    expect(rows[0].explanation).toBe("讲解文字");
    expect(rows[0].stemImages).toBeUndefined();
    expect(rows[0].optionImages).toBeUndefined();
  });

  it("merges an orphan image-only paragraph into the stem without changing stem text", async () => {
    const { rows } = await parseDocx(
      paragraph("1. 题干") +
        paragraph("A、选项A") +
        paragraph("B、选项B") +
        paragraph("答案：A") +
        `<w:p>${drawing("rId5")}</w:p>` +
        paragraph("2. 下一题") +
        paragraph("A、选项A") +
        paragraph("B、选项B") +
        paragraph("答案：B"),
      [mediaRelationship("rId5", "media/image1.png")],
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].stem).toBe("题干");
    expect(rows[0].stemImages).toEqual([
      expect.objectContaining({ id: "image1.png", paragraphIndex: 4 }),
    ]);
    expect(rows[1].stemImages).toBeUndefined();
  });

  it("keeps pure-text word parsing results identical to the pre-upgrade text pipeline", async () => {
    const buffer = await buildDocx(
      paragraph("导入说明：本模板用于批量导入选择题。") +
        paragraph("1. 第一行题干") +
        paragraph("  缩进的第二行题干") +
        paragraph("A、选项A") +
        paragraph("B、选项B") +
        paragraph("答案：A") +
        paragraph("解析：第一步。") +
        paragraph("第二步。") +
        paragraph("2.") +
        paragraph("[不定项选择题]题干二") +
        paragraph("A、选项A") +
        paragraph("B、选项B") +
        paragraph("C、选项C") +
        paragraph("答案：ABC") +
        `<w:p/>`,
      { rels: [], media: {} },
    );

    const legacy = parseWordQuestions(await extractDocxText(buffer));
    const upgraded = parseWordContent(await extractDocxContent(buffer));

    expect(upgraded).toEqual(legacy);
    expect(upgraded.rows).toHaveLength(2);
    expect(upgraded.rows[0]).toMatchObject({
      locationLabel: "第 1 题",
      stem: "第一行题干\n  缩进的第二行题干",
      rawAnswer: "A",
      explanation: "第一步。\n第二步。",
    });
    expect(upgraded.rows[1]).toMatchObject({ locationLabel: "第 2 题", stem: "题干二", rawAnswer: "ABC" });
  });

  it("exposes per-line image placement for stem and options", async () => {
    const { rows } = await parseDocx(
      `<w:p><w:r><w:t>1. 题干</w:t></w:r>${drawing("rId5")}</w:p>` +
        paragraph("续行") +
        `<w:p>${drawing("rId6")}</w:p>` +
        `<w:p><w:r><w:t>A、选项A</w:t></w:r>${drawing("rId7")}</w:p>` +
        paragraph("B、选项B") +
        paragraph("答案：A"),
      [mediaRelationship("rId5", "media/image1.png"), mediaRelationship("rId6", "media/image2.png"), mediaRelationship("rId7", "media/image3.png")],
      { "word/media/image1.png": PNG_BYTES, "word/media/image2.png": PNG_BYTES, "word/media/image3.png": PNG_BYTES },
    );

    expect(rows[0].stemLines).toEqual([
      { text: "题干", images: [expect.objectContaining({ id: "image1.png" })] },
      { text: "续行", images: [] },
      { text: "", images: [expect.objectContaining({ id: "image2.png" })] },
    ]);
    expect(rows[0].optionLines).toEqual({
      A: [{ text: "选项A", images: [expect.objectContaining({ id: "image3.png" })] }],
      B: [{ text: "选项B", images: [] }],
    });
  });
});
