import JSZip from "jszip";
import { ApiError } from "./api-error";

const DOCUMENT_ENTRY = "word/document.xml";

const XML_TOKEN_PATTERN = /<(?:\/?)([A-Za-z0-9:_-]+)(?:"[^"]*"|'[^']*'|[^<>"'])*?\/?>|[^<]+/g;

/**
 * 解压 .docx 并抽取正文纯文本行。
 *
 * 只读取 word/document.xml，不触碰 word/media/* 等媒体内容，
 * 文本抽取与后续媒体提取相互独立。
 */
export async function extractDocxText(buffer: ArrayBuffer | Uint8Array): Promise<string[]> {
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(buffer);
  } catch {
    throw new ApiError("文件不是有效的 .docx 压缩包", 400);
  }

  const documentEntry = archive.file(DOCUMENT_ENTRY);
  if (!documentEntry) throw new ApiError("Word 文档缺少正文 word/document.xml", 400);

  return wordprocessingXmlToLines(await documentEntry.async("text"));
}

/**
 * 将 word/document.xml 的正文抽取为文本行：
 * 段落结束（</w:p>）视为换行、文档内换行（<w:br/>、<w:cr/>）视为换行、
 * 制表符（<w:tab/>）保留，其余 XML 标签忽略，只保留 <w:t> 中的可见文本。
 */
export function wordprocessingXmlToLines(xml: string): string[] {
  let output = "";
  let inText = false;
  const body = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;

  for (const match of body.matchAll(XML_TOKEN_PATTERN)) {
    const token = match[0];
    const name = match[1] ?? "";

    if (token.startsWith("<")) {
      const isEndTag = token.startsWith("</");
      const isSelfClosing = /\/>$/.test(token);

      if (name === "w:t") {
        inText = !isEndTag && !isSelfClosing;
      } else if (name === "w:p" && (isEndTag || isSelfClosing)) {
        output += "\n";
      } else if ((name === "w:br" || name === "w:cr") && !isEndTag) {
        output += "\n";
      } else if (name === "w:tab" && !isEndTag) {
        output += "\t";
      }
      continue;
    }

    if (inText) output += decodeXmlText(token);
  }

  const lines = output.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex: string) => decodeCodePoint(Number.parseInt(hex, 16), match))
    .replace(/&#(\d+);/g, (match, decimal: string) => decodeCodePoint(Number(decimal), match))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function decodeCodePoint(code: number, fallback: string): string {
  if (Number.isInteger(code) && code >= 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)) {
    return String.fromCodePoint(code);
  }
  return fallback;
}
