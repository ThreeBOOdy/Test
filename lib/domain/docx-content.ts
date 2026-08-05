import JSZip from "jszip";

import { ApiError } from "./api-error";

const DOCUMENT_ENTRY = "word/document.xml";
const DOCUMENT_RELS_ENTRY = "word/_rels/document.xml.rels";

const XML_TOKEN_PATTERN = /<(?:\/?)([A-Za-z0-9:_-]+)(?:"[^"]*"|'[^']*'|[^<>"'])*?\/?>|[^<]+/g;

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  emf: "image/x-emf",
  wmf: "image/x-wmf",
  tiff: "image/tiff",
  bmp: "image/bmp",
};

export type DocxImage = {
  /** 文档内媒体文件名（如 image1.png）；同一媒体多次引用会产生多条记录。 */
  id: string;
  data: Uint8Array;
  contentType: string;
  extension: string;
  size: number;
  paragraphIndex: number;
};

export type DocxContentLine = {
  text: string;
  images: DocxImage[];
};

export type DocxParagraph = {
  /** 段落完整文本；段落内换行（w:br/w:cr）以 \n 表示。 */
  text: string;
  /** 按换行切分后的行，每行携带该行位置的图片。 */
  lines: DocxContentLine[];
  /** 段落内全部图片（文档顺序）。 */
  images: DocxImage[];
};

type Segment = string | { relId: string };
type RawParagraph = Segment[];

/**
 * 解压 .docx 并抽取正文纯文本行（只读 word/document.xml，不触碰媒体）。
 * 与升级前逐行行为一致，供纯文本导入与旧调用方使用。
 */
export async function extractDocxText(buffer: ArrayBuffer | Uint8Array): Promise<string[]> {
  return paragraphsToLines(wordprocessingXmlToParagraphs(await loadDocumentXml(buffer)));
}

/**
 * 解压 .docx 并抽取结构化段落：每段同时产出文本与嵌入图片。
 *
 * 图片通过 word/_rels/document.xml.rels 解析到 word/media/* 二进制；
 * 现代内嵌图（w:drawing/a:blip r:embed）与旧版 VML 图（w:pict/v:imagedata r:id）均支持。
 */
export async function extractDocxContent(buffer: ArrayBuffer | Uint8Array): Promise<DocxParagraph[]> {
  const archive = await loadArchive(buffer);
  const xml = await readDocumentEntry(archive);
  const rels = await readDocumentRels(archive);
  const contentTypes = await readContentTypeDefaults(archive);
  const rawParagraphs = wordprocessingXmlToRawParagraphs(xml);
  const relIds = [
    ...new Set(
      rawParagraphs.flatMap((paragraph) =>
        paragraph.flatMap((segment) => (typeof segment === "string" ? [] : [segment.relId])),
      ),
    ),
  ];
  const imagesByRelId = new Map<string, DocxImage>();
  for (const relId of relIds) {
    imagesByRelId.set(relId, await loadImage(archive, rels, contentTypes, relId));
  }
  return rawParagraphs.map((paragraph, paragraphIndex) =>
    buildParagraph(paragraph.map((segment) => (typeof segment === "string" ? segment : imagesByRelId.get(segment.relId)!)), paragraphIndex),
  );
}

/** 将 word/document.xml 抽取为纯文本段落（不含图片）。 */
export function wordprocessingXmlToParagraphs(xml: string): DocxParagraph[] {
  return wordprocessingXmlToRawParagraphs(xml).map((segments, paragraphIndex) =>
    buildParagraph(segments.filter((segment): segment is string => typeof segment === "string"), paragraphIndex),
  );
}

/** 将 word/document.xml 抽取为文本行（段落结束与文档内换行均视为换行）。 */
export function wordprocessingXmlToLines(xml: string): string[] {
  return paragraphsToLines(wordprocessingXmlToParagraphs(xml));
}

export function paragraphsToLines(paragraphs: readonly DocxParagraph[]): string[] {
  const lines = paragraphs
    .map((paragraph) => paragraph.text)
    .join("\n")
    .split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

async function loadArchive(buffer: ArrayBuffer | Uint8Array): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(buffer);
  } catch {
    throw new ApiError("文件不是有效的 .docx 压缩包", 400);
  }
}

async function loadDocumentXml(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const archive = await loadArchive(buffer);
  return readDocumentEntry(archive);
}

async function readDocumentEntry(archive: JSZip): Promise<string> {
  const entry = archive.file(DOCUMENT_ENTRY);
  if (!entry) throw new ApiError("Word 文档缺少正文 word/document.xml", 400);
  return entry.async("text");
}

async function readDocumentRels(archive: JSZip): Promise<Map<string, string>> {
  const entry = archive.file(DOCUMENT_RELS_ENTRY);
  if (!entry) return new Map();
  const xml = await entry.async("text");
  const rels = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = extractAttribute(match[0], "Id");
    const type = extractAttribute(match[0], "Type");
    const target = extractAttribute(match[0], "Target");
    if (id && target && type?.endsWith("/image")) rels.set(id, target);
  }
  return rels;
}

async function readContentTypeDefaults(archive: JSZip): Promise<Map<string, string>> {
  const entry = archive.file("[Content_Types].xml");
  if (!entry) return new Map();
  const xml = await entry.async("text");
  const defaults = new Map<string, string>();
  for (const match of xml.matchAll(/<Default\b[^>]*>/g)) {
    const extension = extractAttribute(match[0], "Extension")?.toLowerCase();
    const contentType = extractAttribute(match[0], "ContentType");
    if (extension && contentType) defaults.set(extension, contentType);
  }
  return defaults;
}

async function loadImage(
  archive: JSZip,
  rels: Map<string, string>,
  contentTypes: Map<string, string>,
  relId: string,
): Promise<DocxImage> {
  const target = rels.get(relId);
  if (!target) throw new ApiError(`Word 文档图片引用 ${relId} 缺失`, 400);
  const partPath = target.startsWith("/") ? target.slice(1) : `word/${target}`;
  const entry = archive.file(partPath);
  if (!entry) throw new ApiError(`Word 文档图片文件 ${partPath} 缺失`, 400);
  const data = await entry.async("uint8array");
  const fileName = partPath.split("/").pop() ?? partPath;
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const contentType = contentTypes.get(extension) ?? EXTENSION_CONTENT_TYPES[extension] ?? "application/octet-stream";
  return { id: fileName, data, contentType, extension, size: data.length, paragraphIndex: -1 };
}

function wordprocessingXmlToRawParagraphs(xml: string): RawParagraph[] {
  const body = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  const paragraphs: RawParagraph[] = [];
  let segments: Segment[] | null = null;
  let inText = false;
  let drawingDepth = 0;
  let pictDepth = 0;

  for (const match of body.matchAll(XML_TOKEN_PATTERN)) {
    const token = match[0];
    const name = match[1] ?? "";

    if (token.startsWith("<")) {
      const isEndTag = token.startsWith("</");
      const isSelfClosing = /\/>$/.test(token);

      if (name === "w:p") {
        if (isEndTag) {
          if (segments !== null) {
            paragraphs.push(segments);
            segments = null;
          }
        } else if (isSelfClosing) {
          if (segments !== null) {
            paragraphs.push(segments);
            segments = null;
          }
          paragraphs.push([]);
        } else {
          segments = [];
        }
        continue;
      }
      if (segments === null) continue;

      if (name === "w:t") {
        inText = !isEndTag && !isSelfClosing;
      } else if ((name === "w:br" || name === "w:cr") && !isEndTag) {
        segments.push("\n");
      } else if (name === "w:tab" && !isEndTag) {
        segments.push("\t");
      } else if (name === "w:drawing") {
        if (!isEndTag && !isSelfClosing) drawingDepth += 1;
        else if (isEndTag) drawingDepth = Math.max(0, drawingDepth - 1);
      } else if (name === "w:pict") {
        if (!isEndTag && !isSelfClosing) pictDepth += 1;
        else if (isEndTag) pictDepth = Math.max(0, pictDepth - 1);
      } else if (drawingDepth > 0 && name === "a:blip") {
        const relId = extractAttribute(token, "r:embed");
        if (relId) segments.push({ relId });
      } else if (pictDepth > 0 && name === "v:imagedata") {
        const relId = extractAttribute(token, "r:id");
        if (relId) segments.push({ relId });
      }
      continue;
    }

    if (segments !== null && inText) segments.push(decodeXmlText(token));
  }

  return paragraphs;
}

function buildParagraph(segments: readonly (string | DocxImage)[], paragraphIndex: number): DocxParagraph {
  const lines: DocxContentLine[] = [];
  let current: DocxContentLine = { text: "", images: [] };
  for (const segment of segments) {
    if (typeof segment === "string") {
      const parts = segment.split("\n");
      for (let index = 0; index < parts.length; index += 1) {
        if (index > 0) {
          lines.push(current);
          current = { text: "", images: [] };
        }
        current.text += parts[index];
      }
    } else {
      current.images.push({ ...segment, paragraphIndex });
    }
  }
  lines.push(current);
  return {
    text: segments
      .filter((segment): segment is string => typeof segment === "string")
      .join(""),
    lines,
    images: segments
      .filter((segment): segment is DocxImage => typeof segment !== "string")
      .map((image) => ({ ...image, paragraphIndex })),
  };
}

function extractAttribute(tag: string, attribute: string): string | null {
  const match = new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`).exec(tag);
  return match?.[1] ?? null;
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
