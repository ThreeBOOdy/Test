import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码").fill("ChangeMe123!");
  await page.getByRole("button", { name: "登录" }).click();
}

test("teacher and student can enter their protected workspaces", async ({ page }) => {
  await login(page, "teacher");
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByText("教师工作台").first()).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();
  await login(page, "student");
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByText(/欢迎回来/)).toBeVisible();
});

test("Excel preview commits every row beyond the first hundred", async ({ page }) => {
  await login(page, "teacher");
  await page.goto("/teacher/import");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Questions");
  sheet.addRow(["等级", "分类号", "知识点名称", "题目编号", "问题", "答案", "选项规格", "A", "B", "C", "D", "是否启用"]);
  for (let index = 1; index <= 101; index += 1) sheet.addRow(["A", "9.1.1", "E2E Knowledge", `E2E-${index}`, `Question ${index}`, "A", "4选1", "Correct", "Wrong B", "Wrong C", "Wrong D", "是"]);
  const filePath = path.join(os.tmpdir(), `zhixue-e2e-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  try {
    await page.locator('input[type="file"]').setInputFiles(filePath);
    await page.getByRole("button", { name: "开始预检" }).click();
    await expect(page.getByRole("button", { name: "确认导入 101 道题" })).toBeVisible();
    await page.getByRole("button", { name: "确认导入 101 道题" }).click();
    await expect(page.getByText("成功导入 101 道题，跳过重复 0 道")).toBeVisible();
  } finally {
    fs.rmSync(filePath, { force: true });
  }
});
