import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { expect, test, type Page } from "@playwright/test";

const runId = `${Date.now().toString(36)}-${process.pid}`;
const fileName = `word-import-${runId}.docx`;
const searchKeyword = `Word E2E ${runId}`;
const firstStem = `Word E2E ${runId} 题干一（力与运动）`;
const secondStem = `Word E2E ${runId} 题干二（电与磁）`;

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

function paragraph(text: string): string {
  return `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

async function buildWordQuestionsFile(): Promise<void> {
  const lines = [
    "小鹅通 Word 批量导入模板说明：请保留题号，选择题答案写在答案行。",
    `1. ${firstStem}`,
    "A、物体间相互作用的力",
    "B、物体运动的速度",
    "C、物体质量的单位",
    "D、物体体积的大小",
    "答案：A",
    "解析：力是物体对物体的作用，选项 A 正确。",
    `2、${secondStem}`,
    "A、电荷定向移动形成电流",
    "B、电压与电流无关",
    "C、电阻只与长度有关",
    "D、功率单位是伏特",
    "答案：A",
    "解析：电荷定向移动形成电流，选项 A 正确。",
  ];
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("word/document.xml", documentXml(lines.map(paragraph).join("")));
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(path.join(os.tmpdir(), fileName), buffer);
}

async function login(page: Page, username: string, password: string, destination: string) {
  await page.goto(`/login?next=${encodeURIComponent(destination)}`);
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "进入系统", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination.replaceAll("/", "\\/")}$`), { timeout: 20_000 });
}

test("Word question import runs preview, commit, bank visibility, and revert as one loop", async ({ page }) => {
  await buildWordQuestionsFile();
  const filePath = path.join(os.tmpdir(), fileName);
  try {
    await login(page, "teacher", "123456", "/teacher/import");
    await page.locator('input[type="file"]').setInputFiles(filePath);
    await page.getByLabel("大类知识点（类型）").selectOption({ label: "默认（DEFAULT）" });
    await page.getByLabel("分类号").fill("4.1.1");
    await page.getByLabel("知识点名称（可选）").fill("导体与绝缘体");
    await page.getByRole("button", { name: "开始预检" }).click();

    await expect(page.getByRole("button", { name: "确认导入 2 道题" })).toBeVisible();
    await expect(page.getByText("总行数", { exact: true }).locator("..")).toContainText("2");
    await expect(page.getByText("可导入", { exact: true }).locator("..")).toContainText("2");
    await expect(page.getByText("错误", { exact: true }).locator("..")).toContainText("0");
    await expect(page.getByRole("cell").filter({ hasText: "第 1 题" }).first()).toBeVisible();
    await expect(page.getByRole("cell").filter({ hasText: "第 2 题" }).first()).toBeVisible();

    await page.getByRole("button", { name: "确认导入 2 道题" }).click();
    await expect(page.getByRole("dialog", { name: "字母类归类向导" })).toBeVisible();
    await page.getByRole("checkbox", { name: "字母类 A" }).check();
    await page.getByRole("button", { name: "拉取到所选字母类" }).click();
    await expect(page.getByText("已拉取到 A级，共 2 条关联。")).toBeVisible();

    await page.goto(`/teacher/questions?search=${encodeURIComponent(searchKeyword)}`);
    const questionRow = page.getByRole("row").filter({ hasText: firstStem });
    await expect(questionRow).toBeVisible();
    await expect(questionRow).toContainText("A级");
    await expect(questionRow).toContainText("4.1.1");
    await expect(questionRow).toContainText("启用");
    await expect(page.getByRole("row").filter({ hasText: secondStem })).toBeVisible();

    await page.goto("/teacher/import");
    const batch = page.getByText(fileName).locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    await expect(batch).toContainText("COMMITTED");
    page.once("dialog", (dialog) => dialog.accept());
    const revertResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/v1/teacher/import-batches/") && response.url().endsWith("/revert"), { timeout: 30_000 });
    await batch.getByRole("button", { name: "撤销" }).click();
    const revertResponse = await revertResponsePromise;
    expect(revertResponse.ok()).toBe(true);
    expect(await revertResponse.json()).toEqual({ archived: 2 });
    await expect(page.getByText("已归档 2 道题目，未物理删除任何公开题目")).toBeVisible({ timeout: 15_000 });
    await expect(batch).toContainText("REVERTED");
    await expect(batch.getByRole("button", { name: "撤销" })).toHaveCount(0);

    await page.goto(`/teacher/questions?search=${encodeURIComponent(searchKeyword)}`);
    await expect(page.getByRole("row").filter({ hasText: firstStem })).toContainText("归档");
  } finally {
    fs.rmSync(filePath, { force: true });
  }
});
