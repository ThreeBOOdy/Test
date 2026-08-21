import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { buildDocx, drawing, mediaRelationship, paragraph } from "../fixtures/word-docx";
import { login, logout } from "./helpers/login";

const runId = `${Date.now().toString(36)}-${process.pid}`;
const fileName = `question-image-${runId}.docx`;
const stemText = `含图题干 E2E ${runId}`;
const searchKeyword = `含图题干 E2E ${runId}`;
// 200x200 实色 PNG：真实尺寸图片才能被正常点击，1x1 占位图会把点击中心让给相邻文本。
const QUESTION_IMAGE_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAACF0lEQVR4nO3TMRHAIADAQBQjrJrwAgZ6WWH44fcsGfNbG/g3bgfAywwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEAwCwSAQDALBIBAMAsEgEA6VJOu109XqMQAAAABJRU5ErkJggg==",
  "base64",
);

async function buildQuestionImagesFile(): Promise<void> {
  const stemParagraph = `<w:p><w:r><w:t>1. ${stemText}：请观察下方电路图</w:t></w:r>${drawing("rId1")}</w:p>`;
  const paragraphs = [
    stemParagraph,
    paragraph("A、电流表"),
    paragraph("B、电压表"),
    paragraph("C、电阻箱"),
    paragraph("D、电源"),
    paragraph("答案：A"),
    paragraph("解析：图中符号为电流表。"),
  ].join("");
  const buffer = await buildDocx(paragraphs, {
    rels: [mediaRelationship("rId1", "media/image1.png")],
    media: { "word/media/image1.png": QUESTION_IMAGE_BYTES },
  });
  fs.writeFileSync(path.join(os.tmpdir(), fileName), Buffer.from(buffer));
}

const dbHelperPath = path.resolve("tests/e2e/helpers/question-image-db.ts");

function runDbHelper(command: string, keyword: string): string {
  return execFileSync(process.execPath, ["--import", "tsx", dbHelperPath, command, keyword], {
    encoding: "utf8",
    env: { ...process.env },
  });
}

test("question images render across bank, revisions, wrong book, and practice zoom", async ({ page }) => {
  await buildQuestionImagesFile();
  const filePath = path.join(os.tmpdir(), fileName);
  try {
    await login(page, "teacher", "123456", "/teacher/import");
    await page.locator('input[type="file"]').setInputFiles(filePath);
    await page.getByLabel("大类知识点（类型）").selectOption({ label: "默认（DEFAULT）" });
    await page.getByLabel("分类号").fill("4.1.1");
    await page.getByLabel("知识点名称（可选）").fill("导体与绝缘体");
    await page.getByRole("button", { name: "开始预检" }).click();
    await expect(page.getByText("图片 1 张")).toBeVisible();
    await page.getByRole("button", { name: "确认导入 1 道题" }).click();
    await expect(page.getByRole("dialog", { name: "字母类归类向导" })).toBeVisible();
    await page.getByRole("button", { name: "暂不归类" }).click();
    await expect(page.getByText("成功导入 1 道题，跳过重复 0 道")).toBeVisible();

    await page.goto(`/teacher/questions?search=${encodeURIComponent(searchKeyword)}`);
    const bankRow = page.getByRole("row").filter({ hasText: stemText });
    await expect(bankRow).toBeVisible();
    const bankImage = bankRow.locator('img[src^="/api/v1/question-images/"]');
    await expect(bankImage).toBeVisible();

    await bankRow.getByRole("button", { name: "编辑" }).click();
    const stemInput = page.getByRole("textbox", { name: "题干" });
    await expect(stemInput).toHaveValue(new RegExp(`\\[图:qimg_[A-Za-z0-9_-]+\\]`));
    const editedStem = `${await stemInput.inputValue()}（已修订）`;
    await stemInput.fill(editedStem);
    await page.getByRole("button", { name: "保存题目" }).click();
    await expect(page.getByRole("dialog", { name: "编辑题目" })).toBeHidden({ timeout: 15_000 });

    await page.goto(`/teacher/questions?search=${encodeURIComponent(searchKeyword)}`);
    const editedRow = page.getByRole("row").filter({ hasText: `${stemText}：请观察下方电路图` });
    await expect(editedRow).toBeVisible();
    await expect(editedRow.locator('img[src^="/api/v1/question-images/"]')).toBeVisible();

    await editedRow.getByRole("button", { name: "历史" }).click();
    const historyDialog = page.getByRole("dialog", { name: "题目修订历史" });
    await expect(historyDialog.locator('img[src^="/api/v1/question-images/"]').first()).toBeVisible({ timeout: 15_000 });
    await historyDialog.getByRole("button", { name: "关闭" }).click();
    await expect(historyDialog).toBeHidden();

    runDbHelper("seed-wrong", searchKeyword);

    await logout(page);
    await login(page, "student", "123456", "/student/wrong");
    await expect(page.getByText("待巩固 1", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('img[src^="/api/v1/question-images/"]').first()).toBeVisible();

    await page.getByRole("link", { name: "随机巩固错题" }).click();
    // 首次访问会冷编译路由并在服务端创建练习会话，CI 冷启动下可能超过默认 5 秒。
    await expect(page).toHaveURL(/\/student\/practice\?session=/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(stemText, { timeout: 15_000 });
    const practiceImage = page.locator('img[src^="/api/v1/question-images/"]').first();
    await expect(practiceImage).toBeVisible({ timeout: 15_000 });

    await practiceImage.click();
    const viewer = page.getByRole("dialog", { name: "图片预览" });
    await expect(viewer).toBeVisible();
    await viewer.getByRole("img", { name: "题目图片放大查看" }).click();
    await expect(viewer).toBeHidden();

    await practiceImage.click();
    await expect(page.getByRole("dialog", { name: "图片预览" })).toBeVisible();
    await page.getByRole("button", { name: "关闭图片" }).click();
    await expect(page.getByRole("dialog", { name: "图片预览" })).toBeHidden();

    runDbHelper("cleanup", searchKeyword);

    await page.goto("/student/wrong");
    await logout(page);
    await login(page, "teacher", "123456", "/teacher/import");
    const batch = page.getByText(fileName).locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    page.once("dialog", (dialog) => dialog.accept());
    await batch.getByRole("button", { name: "撤销" }).click();
    await expect(page.getByText("已归档 1 道题目，未物理删除任何公开题目")).toBeVisible({ timeout: 15_000 });
  } finally {
    fs.rmSync(filePath, { force: true });
  }
});
