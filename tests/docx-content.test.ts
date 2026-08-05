import { describe, expect, it } from "vitest";

import { extractDocxContent } from "../lib/domain/docx-content";
import { extractDocxText } from "../lib/domain/docx-text";
import { PNG_BYTES, buildDocx, drawing, mediaRelationship, paragraph, vmlImage } from "./fixtures/word-docx";

describe("docx structured content extraction", () => {
  it("extracts an inline drawing as an image while keeping paragraph text", async () => {
    const buffer = await buildDocx(
      `<w:p><w:r><w:t>题干</w:t></w:r>${drawing("rId5")}</w:p>`,
      { rels: [mediaRelationship("rId5", "media/image1.png")], media: { "word/media/image1.png": PNG_BYTES } },
    );

    const paragraphs = await extractDocxContent(buffer);

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].text).toBe("题干");
    expect(paragraphs[0].lines).toEqual([{ text: "题干", images: [expect.objectContaining({ id: "image1.png" })] }]);
    expect(paragraphs[0].images[0]).toMatchObject({
      id: "image1.png",
      contentType: "image/png",
      extension: "png",
      size: PNG_BYTES.length,
      paragraphIndex: 0,
    });
    expect(Buffer.from(paragraphs[0].images[0].data)).toEqual(PNG_BYTES);
  });

  it("keeps the text-only extraction identical when drawings are present", async () => {
    const buffer = await buildDocx(
      `<w:p><w:r><w:t>题干</w:t></w:r>${drawing("rId5")}</w:p><w:p><w:r><w:t>第二段</w:t></w:r></w:p>`,
      { rels: [mediaRelationship("rId5", "media/image1.png")], media: { "word/media/image1.png": PNG_BYTES } },
    );

    expect(await extractDocxText(buffer)).toEqual(["题干", "第二段"]);
  });

  it("attaches an image to the line it appears in when a paragraph has inline breaks", async () => {
    const content = `<w:p><w:r><w:t>第一行</w:t></w:r>${drawing("rId5")}<w:r><w:br/></w:r><w:r><w:t>第二行</w:t></w:r></w:p>`;
    const buffer = await buildDocx(content, { rels: [mediaRelationship("rId5", "media/image1.png")], media: { "word/media/image1.png": PNG_BYTES } });

    const paragraphs = await extractDocxContent(buffer);

    expect(paragraphs[0].text).toBe("第一行\n第二行");
    expect(paragraphs[0].lines).toEqual([
      { text: "第一行", images: [expect.objectContaining({ id: "image1.png" })] },
      { text: "第二行", images: [] },
    ]);
  });

  it("extracts legacy VML images referenced by w:pict/v:imagedata", async () => {
    const buffer = await buildDocx(vmlImage("rId8"), {
      rels: [mediaRelationship("rId8", "media/image2.png")],
      media: { "word/media/image2.png": PNG_BYTES },
    });

    const paragraphs = await extractDocxContent(buffer);

    expect(paragraphs[0].images).toEqual([expect.objectContaining({ id: "image2.png", paragraphIndex: 0 })]);
  });

  it("throws a locatable error when a drawing references a missing relationship", async () => {
    const buffer = await buildDocx(`<w:p><w:r><w:t>题干</w:t></w:r>${drawing("rId9")}</w:p>`);

    await expect(extractDocxContent(buffer)).rejects.toThrow("Word 文档图片引用 rId9 缺失");
  });

  it("throws a locatable error when the relationship target file is missing", async () => {
    const buffer = await buildDocx(`<w:p><w:r><w:t>题干</w:t></w:r>${drawing("rId5")}</w:p>`, {
      rels: [mediaRelationship("rId5", "media/missing.png")],
    });

    await expect(extractDocxContent(buffer)).rejects.toThrow("word/media/missing.png 缺失");
  });

  it("preserves pure-text paragraph extraction including empty paragraphs", async () => {
    const buffer = await buildDocx(`${paragraph("第一段")}<w:p/>${paragraph("最后一段")}`);

    const paragraphs = await extractDocxContent(buffer);

    expect(paragraphs.map((item) => item.text)).toEqual(["第一段", "", "最后一段"]);
    expect(paragraphs.every((item) => item.images.length === 0)).toBe(true);
  });
});
