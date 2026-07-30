import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

const runId = `${Date.now().toString(36)}-${process.pid}`;
const numericRunId = `${Date.now()}${process.pid}`.slice(-8).padStart(8, "0");
const studentUsername = `e2e-${runId}`;
const studentNationalId = createNationalId(Number(numericRunId));
const studentPhone = `138${numericRunId}`;
const initialPassword = "InitialPass123!";
const changedPassword = "ChangedPass456!";

function createNationalId(seed: number) {
  const sequence = String(100 + (seed % 450) * 2).padStart(3, "0");
  const body = `11010520080101${sequence}`;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checks = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
  const sum = body.split("").reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  return `${body}${checks[sum % 11]}`;
}

async function login(page: Page, username: string, password: string, destination: string) {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "进入系统", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination.replaceAll("/", "\\/")}$`), { timeout: 20_000 });
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/$/);
}

function optionIndexes(ids: string[]) {
  return ids.map((id) => id.charCodeAt(0) - 65);
}

async function answerQuestion(page: Page, optionIds: string[]) {
  const options = page.locator('input[type="radio"], input[type="checkbox"]');
  await expect(options).toHaveCount(4);
  for (const index of optionIndexes(optionIds)) await options.nth(index).check({ force: true });
  await page.getByRole("button", { name: "提交答案" }).first().click();
  await expect(page.getByText(/回答正确|回答错误/, { exact: true })).toBeVisible();
}

async function answerWrong(page: Page) {
  const isMultiple = await page.getByText("多选题", { exact: true }).isVisible();
  await answerQuestion(page, isMultiple ? ["B", "C", "D"] : ["D"]);
  await expect(page.getByText("回答错误", { exact: true })).toBeVisible();
}

function correctOptions(stem: string) {
  const mappings: Array<[string, string[]]> = [
    ["通常属于良导体", ["A"]],
    ["电流的国际单位", ["B"]],
    ["电压的国际单位", ["C"]],
    ["电阻的国际单位", ["A"]],
    ["直流电的电流方向", ["B"]],
    ["功率的国际单位", ["B"]],
    ["通常属于绝缘体", ["A", "B", "D"]],
    ["描述基本电路状态", ["A", "B", "C"]],
    ["安全用电应做到", ["A", "C", "D"]],
    ["常见半导体器件", ["A", "B", "D"]],
    ["Question ", ["A"]],
  ];
  const match = mappings.find(([text]) => stem.includes(text));
  if (!match) throw new Error(`未找到题目答案映射：${stem}`);
  return match[1];
}

async function answerCorrect(page: Page) {
  const stem = await page.getByRole("heading", { level: 1 }).innerText();
  await answerQuestion(page, correctOptions(stem));
  await expect(page.getByText("回答正确", { exact: true })).toBeVisible();
}

test.describe.serial("production business flows", () => {
  test("administrator imports an active student who must change the first-login password", async ({ page }) => {
    await login(page, "admin", "ChangeMe123!", "/admin");
    await page.goto("/admin/student-import");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("学生");
    sheet.addRow(["用户名", "姓名", "身份证号", "学校", "年级", "手机号", "初始密码", "启用", "开始日期", "结束日期", "长期"]);
    sheet.addRow([studentUsername, "端到端学生", studentNationalId, "端到端中学", "JUNIOR_1", studentPhone, initialPassword, "是", "", "", "否"]);
    const filePath = path.join(os.tmpdir(), `student-accounts-${runId}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    try {
      await page.getByLabel("学生账号 Excel").setInputFiles(filePath);
      const studentRow = page.getByRole("row").filter({ hasText: studentUsername });
      await expect(studentRow).toContainText("通过");
      await studentRow.getByRole("button", { name: "编辑" }).click();
      const editDialog = page.getByRole("dialog", { name: "编辑导入学生" });
      await expect(editDialog.getByLabel("姓名")).toHaveValue("端到端学生");
      await expect(editDialog.getByLabel("身份证号")).toHaveValue(studentNationalId);
      await expect(editDialog.getByText("性别由身份证号自动推导：女")).toBeVisible();
      await editDialog.getByLabel("学校").fill("端到端实验中学");
      await editDialog.getByRole("button", { name: "保存并校验" }).click();
      await expect(editDialog).toBeHidden();
      await expect(page.getByRole("status")).toHaveText("导入行已保存并重新校验");
      const commitResponsePromise = page.waitForResponse((response) => response.url().endsWith("/commit") && response.request().method() === "POST");
      await page.getByRole("button", { name: "确认导入" }).click();
      const commitResponse = await commitResponsePromise;
      const commitBody = await commitResponse.text();
      expect(commitResponse.ok(), `student-import commit ${commitResponse.status()}: ${commitBody}`).toBe(true);
      await expect(page.getByText("成功导入 1 个学生账号，账号直接生效。")).toBeVisible({ timeout: 20_000 });
    } finally {
      fs.rmSync(filePath, { force: true });
    }
    await logout(page);

    await login(page, studentUsername, initialPassword, "/change-password");
    await expect(page.getByText("管理员为你创建或重置了密码，请先完成修改。")).toBeVisible();
    await page.getByLabel("当前密码").fill(initialPassword);
    await page.getByLabel("新密码", { exact: true }).fill(changedPassword);
    await page.getByLabel("确认新密码").fill(changedPassword);
    const changePasswordResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/v1/auth/change-password") && response.request().method() === "POST");
    await page.getByRole("button", { name: "保存新密码" }).click();
    const changePasswordResponse = await changePasswordResponsePromise;
    const changePasswordBody = await changePasswordResponse.text();
    expect(changePasswordResponse.ok(), `change-password ${changePasswordResponse.status()}: ${changePasswordBody}`).toBe(true);
    await expect(page).toHaveURL(/\/student$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "欢迎回来，端到端学生" })).toBeVisible();

    await logout(page);
    await login(page, studentUsername, changedPassword, "/student");
    await expect(page.getByRole("heading", { name: "欢迎回来，端到端学生" })).toBeVisible();
  });

  test("student practice restores progress and closes the wrong-question loop", async ({ page }) => {
    await login(page, studentUsername, changedPassword, "/student");
    await page.getByRole("link", { name: /A级综合训练/ }).click();
    await expect(page).toHaveURL(/\/student\/practice\?session=/);
    await expect(page.getByText("第 1 / 10 题", { exact: true })).toBeVisible();

    await answerWrong(page);
    await page.getByRole("button", { name: "下一题" }).click();
    await expect(page.getByText("第 2 / 10 题", { exact: true })).toBeVisible();
    const secondStem = await page.getByRole("heading", { level: 1 }).innerText();
    await page.reload();
    await expect(page.getByText("第 2 / 10 题", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(secondStem);

    for (let questionNumber = 2; questionNumber <= 10; questionNumber += 1) {
      await answerWrong(page);
      await page.getByRole("button", { name: questionNumber === 10 ? "查看结果" : "下一题" }).click();
    }
    await expect(page.getByRole("heading", { name: "训练完成" })).toBeVisible();
    await expect(page.getByText("正确", { exact: true }).locator("..")).toContainText("0");
    await expect(page.getByText("总题", { exact: true }).locator("..")).toContainText("10");

    await page.goto("/student/history");
    await expect(page.getByText("A级综合练习").first()).toBeVisible();
    await expect(page.getByText("10 题", { exact: false }).first()).toBeVisible();

    await page.goto("/student/wrong");
    await expect(page.getByText("待巩固 10", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "随机巩固错题" }).click();
    await expect(page.getByText("第 1 / 10 题", { exact: true })).toBeVisible();

    for (let questionNumber = 1; questionNumber <= 10; questionNumber += 1) {
      await answerCorrect(page);
      await page.getByRole("button", { name: questionNumber === 10 ? "查看结果" : "下一题" }).click();
    }
    await expect(page.getByRole("heading", { name: "训练完成" })).toBeVisible();
    await expect(page.getByText("正确", { exact: true }).locator("..")).toContainText("10");
    await expect(page.getByText("总题", { exact: true }).locator("..")).toContainText("10");

    await page.goto("/student/wrong");
    await expect(page.getByText("待巩固 0", { exact: true })).toBeVisible();
    await expect(page.getByText("已掌握 10", { exact: true })).toBeVisible();
    await page.goto("/student/history");
    await expect(page.getByText("错题巩固练习").first()).toBeVisible();
  });

  test("Excel preview, issue report, commit, and revert work as one server-owned batch", async ({ page }) => {
    await login(page, "teacher", "ChangeMe123!", "/teacher/import");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Questions");
    sheet.addRow(["等级", "题库编号", "分类号", "知识点名称", "题目编号", "问题", "答案", "选项规格", "A", "B", "C", "D", "是否启用"]);
    for (let index = 1; index <= 101; index += 1) {
      sheet.addRow(["A", `E2E-${runId}`, "4.1.1", "导体与绝缘体", `MC2-E2E-${runId}-${index}`, `Question ${runId}-${index}`, "A", "4选1", "Correct", "Wrong B", "Wrong C", "Wrong D", "是"]);
    }
    const filePath = path.join(os.tmpdir(), `zhixue-e2e-${runId}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    try {
      await page.locator('input[type="file"]').setInputFiles(filePath);
      await page.getByRole("button", { name: "开始预检" }).click();
      await expect(page.getByRole("button", { name: "确认导入 101 道题" })).toBeVisible();
      await expect(page.getByText("总行数", { exact: true }).locator("..")).toContainText("101");
      await expect(page.getByText("可导入", { exact: true }).locator("..")).toContainText("101");
      await expect(page.getByText("警告", { exact: true }).locator("..")).toContainText("101");
      await expect(page.getByText("错误", { exact: true }).locator("..")).toContainText("0");
      await page.getByRole("button", { name: "确认导入 101 道题" }).click();
      await expect(page.getByText("成功导入 101 道题，跳过重复 0 道")).toBeVisible();

      const batch = page.getByText(path.basename(filePath)).locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
      await expect(batch).toContainText("COMMITTED");
      await batch.getByRole("button", { name: "查看报告" }).click();
      await expect(batch.getByText("问题报告（共 101 行）")).toBeVisible();
      await expect(batch.getByText(/警告［题目编号］/).first()).toBeVisible();

      page.once("dialog", (dialog) => dialog.accept());
      const revertResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/v1/admin/import-batches/") && response.url().endsWith("/revert"), { timeout: 30_000 });
      await batch.getByRole("button", { name: "撤销" }).click();
      const revertResponse = await revertResponsePromise;
      expect(revertResponse.ok()).toBe(true);
      expect(await revertResponse.json()).toEqual({ deleted: 101, archived: 0 });
      await expect(page.getByText("已删除 101 道未使用题目，归档 0 道已使用题目")).toBeVisible({ timeout: 15_000 });
      await expect(batch).toContainText("REVERTED");
      await expect(batch.getByRole("button", { name: "撤销" })).toHaveCount(0);
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });
});
