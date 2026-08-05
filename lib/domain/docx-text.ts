/**
 * Word 纯文本抽取兼容入口。
 *
 * 结构化抽取（段落 + 嵌入图片）的实现已迁移到 docx-content.ts；
 * extractDocxText 只读取 word/document.xml，不触碰媒体内容。
 */
export { extractDocxText, wordprocessingXmlToLines } from "./docx-content";
