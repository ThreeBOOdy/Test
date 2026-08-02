import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { extractDocxText, wordprocessingXmlToLines } from "../lib/domain/docx-text";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

function documentXml(paragraphs: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}</w:body>
</w:document>`;
}

async function buildDocx(paragraphs: string, extraFiles: Record<string, string | Uint8Array> = {}): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("word/document.xml", documentXml(paragraphs));
  for (const [path, content] of Object.entries(extraFiles)) zip.file(path, content);
  return zip.generateAsync({ type: "arraybuffer" });
}

function paragraph(text: string): string {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

describe("docx text extraction", () => {
  it("treats paragraph ends as line breaks", async () => {
    const lines = await extractDocxText(await buildDocx(`${paragraph("第一段")}${paragraph("第二段")}${paragraph("第三段")}`));

    expect(lines).toEqual(["第一段", "第二段", "第三段"]);
  });

  it("treats inline breaks inside a paragraph as line breaks", async () => {
    const content = `<w:p><w:r><w:t>第一行</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>第二行</w:t></w:r><w:r><w:cr/></w:r><w:r><w:t>第三行</w:t></w:r></w:p>`;

    expect(await extractDocxText(await buildDocx(content))).toEqual(["第一行", "第二行", "第三行"]);
  });

  it("preserves tabs and runs with xml:space", async () => {
    const content = `<w:p><w:r><w:tab/></w:r><w:r><w:t xml:space="preserve">  选项A  </w:t></w:r></w:p>`;

    expect(await extractDocxText(await buildDocx(content))).toEqual(["\t  选项A  "]);
  });

  it("ignores media files and never reads their content", async () => {
    const lines = await extractDocxText(
      await buildDocx(paragraph("题干文本"), { "word/media/image1.png": "FAKE-PNG-BYTES-NOT-DOCUMENT-TEXT", "word/_rels/document.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>` }),
    );

    expect(lines).toEqual(["题干文本"]);
    expect(lines.join("\n")).not.toContain("FAKE-PNG-BYTES-NOT-DOCUMENT-TEXT");
  });

  it("keeps only visible w:t text and skips field instructions and deleted text", async () => {
    const content = `<w:p><w:r><w:t>题干</w:t><w:instrText> PAGE </w:instrText><w:del><w:delText>已删除</w:delText></w:del><w:t>正文</w:t></w:r></w:p>`;

    expect(await extractDocxText(await buildDocx(content))).toEqual(["题干正文"]);
  });

  it("decodes XML entities in text", async () => {
    const content = `<w:p><w:r><w:t>1 &lt; 2 &amp;&amp; 3 &gt; 2，分类号 &#20013;文</w:t></w:r></w:p>`;

    expect(await extractDocxText(await buildDocx(content))).toEqual(["1 < 2 && 3 > 2，分类号 中文"]);
  });

  it("keeps empty paragraphs as empty lines without a trailing phantom line", async () => {
    const content = `${paragraph("第一段")}<w:p/>${paragraph("最后一段")}`;

    expect(await extractDocxText(await buildDocx(content))).toEqual(["第一段", "", "最后一段"]);
  });

  it("rejects a buffer that is not a zip archive", async () => {
    await expect(extractDocxText(new TextEncoder().encode("not a docx"))).rejects.toThrow("不是有效的 .docx");
  });

  it("rejects a zip without word/document.xml", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES);
    const buffer = await zip.generateAsync({ type: "arraybuffer" });

    await expect(extractDocxText(buffer)).rejects.toThrow("缺少正文");
  });

  it("exposes the pure xml-to-lines function for reuse", () => {
    expect(wordprocessingXmlToLines(documentXml(paragraph("纯文本")))).toEqual(["纯文本"]);
  });
});
