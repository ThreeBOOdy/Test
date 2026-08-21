import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { login, logout, waitForPageHydration } from "./helpers/login";

const runId = `${Date.now().toString(36)}-${process.pid}`;
const numericRunId = `${Date.now()}${process.pid}`.slice(-8).padStart(8, "0");
const studentUsername = `e2e-${runId}`;
// 激活后学生用户名会变成所选人物身份的用户名；人物一经占用便从可选列表消失，
// 因此不能在本地持久化库中写死某个具体人物，运行首条用例时动态读取所选人物。
let activatedStudentUsername = "radio-001";
const studentNationalId = createNationalId(Number(numericRunId));
const studentPhone = `138${numericRunId}`;
const initialPassword = "InitialPass123!";
const changedPassword = "ChangedPass456!";
const blueprintName = `E2E模拟-${runId}`;

function createNationalId(seed: number) {
  const sequence = String(100 + (seed % 450) * 2).padStart(3, "0");
  const body = `11010520080101${sequence}`;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checks = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
  const sum = body.split("").reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  return `${body}${checks[sum % 11]}`;
}

function forceReviewDue(username: string) {
  execFileSync(process.execPath, ["--import", "tsx", path.resolve("tests/e2e/helpers/review-plan-due.ts"), username], {
    encoding: "utf8",
    env: { ...process.env },
  });
}

async function optionLabels(page: Page) {
  return page.locator('label:has(input[type="radio"]), label:has(input[type="checkbox"])').allInnerTexts();
}

async function answerQuestion(page: Page, optionTexts: string[]) {
  const options = page.locator('input[type="radio"], input[type="checkbox"]');
  await expect(options).toHaveCount(4);
  const labels = await optionLabels(page);
  for (const optionText of optionTexts) {
    const index = labels.findIndex((label) => label.includes(optionText));
    if (index < 0) throw new Error(`未找到选项：${optionText}`);
    await options.nth(index).check({ force: true });
  }
  await page.getByRole("button", { name: "提交答案" }).first().click();
  await expect(page.getByText(/回答正确|回答错误/, { exact: true })).toBeVisible();
}

async function answerWrong(page: Page) {
  const correctTexts = correctOptionTexts(await page.getByRole("heading", { level: 1 }).innerText());
  const isMultiple = await page.getByText("多选题", { exact: true }).isVisible();
  const labels = await optionLabels(page);
  const wrongOption = labels.find((label) => !correctTexts.some((text) => label.includes(text)));
  if (!wrongOption) throw new Error("未找到错误选项");
  const selections = isMultiple ? [...correctTexts.slice(0, -1), wrongOption] : [wrongOption];
  await answerQuestion(page, selections);
  await expect(page.getByText("回答错误", { exact: true })).toBeVisible();
}

function correctOptionTexts(stem: string) {
  const mappings: Array<[string, string[]]> = [
    ["通常属于良导体", ["铜"]],
    ["电流的国际单位", ["安培"]],
    ["电压的国际单位", ["伏特"]],
    ["电阻的国际单位", ["欧姆"]],
    ["直流电的电流方向", ["方向不变"]],
    ["功率的国际单位", ["瓦特"]],
    ["通常属于绝缘体", ["玻璃", "橡胶", "陶瓷"]],
    ["描述基本电路状态", ["电流", "电压", "电阻"]],
    ["安全用电应做到", ["保持干燥", "切断电源后检修", "使用合格器材"]],
    ["常见半导体器件", ["二极管", "三极管", "集成电路"]],
    ["Question ", ["A"]],
  ];
  const match = mappings.find(([text]) => stem.includes(text));
  if (!match) throw new Error(`未找到题目答案映射：${stem}`);
  return match[1];
}

async function answerCorrect(page: Page) {
  const stem = await page.getByRole("heading", { level: 1 }).innerText();
  await answerQuestion(page, correctOptionTexts(stem));
  await expect(page.getByText("回答正确", { exact: true })).toBeVisible();
}

test.describe.serial("production business flows", () => {
  test.describe.configure({ timeout: 300_000 });
  test("administrator imports and activates a student through the one-time credential flow", async ({ page }) => {
    await login(page, "admin", "123456", "/admin");
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
      await expect(studentRow).toContainText("通过", { timeout: 20_000 });
      await studentRow.getByRole("button", { name: "编辑" }).click();
      const editDialog = page.getByRole("dialog", { name: "编辑导入学生" });
      await expect(editDialog.getByLabel("姓名")).toHaveValue("端到端学生");
      await expect(editDialog.getByLabel("身份证号")).toHaveValue(studentNationalId);
      await expect(editDialog.getByText("性别由身份证号自动推导：女")).toBeVisible();
      await editDialog.getByLabel("学校").fill("端到端实验中学");
      const editResponsePromise = page.waitForResponse((response) => response.url().includes(`/api/v1/admin/student-imports/`) && response.url().includes(`/rows/`) && response.request().method() === "PUT");
      await editDialog.getByRole("button", { name: "保存并校验" }).click();
      const editResponse = await editResponsePromise;
      const editBody = await editResponse.text();
      expect(editResponse.ok(), `student-import row update ${editResponse.status()}: ${editBody}`).toBe(true);
      await expect(editDialog).toBeHidden();
      await expect(page.getByRole("status")).toHaveText("导入行已保存并重新校验");
      const commitResponsePromise = page.waitForResponse((response) => response.url().endsWith("/commit") && response.request().method() === "POST");
      await page.getByRole("button", { name: "确认导入" }).click();
      const commitResponse = await commitResponsePromise;
      const commitBody = await commitResponse.text();
      expect(commitResponse.ok(), `student-import commit ${commitResponse.status()}: ${commitBody}`).toBe(true);
      await expect(page.getByRole("status")).toHaveText("成功导入 1 个学生账号。请立即安全分发下方凭据；离开此结果后系统无法恢复明文。", { timeout: 20_000 });
    } finally {
      fs.rmSync(filePath, { force: true });
    }
    const credentialRow = page.getByRole("row").filter({ hasText: studentUsername }).last();
    const importedPassword = (await credentialRow.locator("td").nth(1).innerText()).trim();
    const activationCode = (await credentialRow.locator("td").nth(2).innerText()).trim();
    expect(importedPassword).not.toBe(initialPassword);
    await logout(page);

    await login(page, studentUsername, importedPassword, "/activate");
    // 等待人物列表客户端加载完成（“共 N 位”文本仅在水合与异步请求后出现），
    // 避免在 React 水合完成前填写受控输入框导致值被重置而拦下表单提交。
    await expect(page.getByText(/共 \d+ 位 · 第 1 \/ \d+ 页/)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel("初始密码").fill(importedPassword);
    await page.getByLabel("激活码").fill(activationCode);
    await page.getByRole("textbox", { name: "新密码", exact: true }).fill(changedPassword);
    await page.getByRole("textbox", { name: "确认新密码", exact: true }).fill(changedPassword);
    const firstPersonRadio = page.locator('input[name="radioPersonId"]').first();
    await expect(firstPersonRadio).toBeVisible();
    await firstPersonRadio.check();
    const selectedLabelText = await firstPersonRadio.locator("xpath=ancestor::label").innerText();
    const usernameMatch = selectedLabelText.match(/radio-\d{3}/);
    expect(usernameMatch, `所选人物身份应包含 radio-XXX 用户名，实际标签：${selectedLabelText}`).not.toBeNull();
    activatedStudentUsername = usernameMatch![0];
    const activateResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/v1/auth/activate") && response.request().method() === "POST");
    await page.getByRole("button", { name: "完成激活" }).click();
    const activateResponse = await activateResponsePromise;
    const activateBody = await activateResponse.text();
    expect(activateResponse.ok(), `activate ${activateResponse.status()}: ${activateBody}`).toBe(true);
    await expect(page).toHaveURL(/\/student$/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "欢迎回来，端到端学生" })).toBeVisible();

    await logout(page);
    await login(page, activatedStudentUsername, changedPassword, "/student");
    await expect(page.getByRole("heading", { name: "欢迎回来，端到端学生" })).toBeVisible();
  });

  test("teacher binds the activated student to the A level", async ({ page }) => {
    await login(page, "teacher", "123456", "/teacher/students");
    const row = page.getByRole("row").filter({ hasText: activatedStudentUsername });
    await expect(row).toContainText("端到端学生", { timeout: 20_000 });
    if (await row.getByText("未分配", { exact: true }).count()) {
      await row.getByRole("combobox").selectOption({ label: "A · A级 · 基础掌握" });
      await row.getByRole("button", { name: "保存", exact: true }).click();
      await expect(page.getByRole("status")).toHaveText("字母类已保存");
    } else {
      await expect(row).toContainText("A级");
    }

    // 后续学生端“一键清除错题”用例要求该年级开放自助清除。
    await page.goto("/teacher");
    await waitForPageHydration(page);
    const wrongClearCard = page.getByText("JUNIOR_1", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]")
      .filter({ hasText: /仅教师可清除|已开放自助清除/ })
      .first();
    await expect(wrongClearCard).toBeVisible({ timeout: 20_000 });
    if (await wrongClearCard.getByRole("button", { name: "开启自助清除" }).count()) {
      await wrongClearCard.getByRole("button", { name: "开启自助清除" }).click();
    }
    await expect(wrongClearCard).toContainText("已开放自助清除", { timeout: 30_000 });
  });

  test("teacher configures an A-level mock exam blueprint", async ({ page }) => {
    await login(page, "teacher", "123456", "/teacher/rules");
    const aCard = page.getByRole("heading", { name: "A级 · 基础掌握 · 模拟测试蓝图" }).locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]");
    await expect(aCard).toBeVisible({ timeout: 20_000 });
    await aCard.getByRole("button", { name: "新增蓝图" }).click();
    const dialog = page.getByRole("dialog", { name: "新建蓝图" });
    await dialog.getByLabel("蓝图名称").fill(blueprintName);
    await dialog.getByLabel("考试时间（分钟）").fill("30");
    await dialog.getByLabel("合格题数").fill("1");
    await dialog.getByRole("button", { name: "添加知识点条目" }).click();
    const picker = page.getByRole("dialog", { name: "选择知识点" });
    await picker.getByRole("button", { name: "选择知识点 4.1.1 导体与绝缘体" }).click();
    await dialog.getByLabel("4.1.1 单选数量").fill("1");
    await expect(dialog.getByRole("status")).toContainText("共 1 题");
    await dialog.getByRole("button", { name: "保存蓝图" }).click();
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await expect(page.getByText(blueprintName, { exact: true })).toBeVisible({ timeout: 20_000 });
  });

  test("student practice restores progress and closes the wrong-question loop", async ({ page }) => {
    await login(page, activatedStudentUsername, changedPassword, "/student");
    await page.getByRole("link", { name: /A级顺序刷题/ }).click();
    // 首次访问会冷编译路由并在服务端创建练习会话，CI 冷启动下可能超过默认 5 秒。
    await expect(page).toHaveURL(/\/student\/practice\?session=/, { timeout: 30_000 });
    await expect(page.getByText("第 1 / 20 题", { exact: true })).toBeVisible();

    await answerWrong(page);
    await page.getByRole("button", { name: "下一题" }).click();
    await expect(page.getByText("第 2 / 20 题", { exact: true })).toBeVisible();
    const secondStem = await page.getByRole("heading", { level: 1 }).innerText();
    await page.reload();
    await expect(page.getByText("第 2 / 20 题", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(secondStem);

    for (let questionNumber = 2; questionNumber <= 20; questionNumber += 1) {
      await answerWrong(page);
      await page.getByRole("button", { name: questionNumber === 20 ? "查看结果" : "下一题" }).click();
    }
    await expect(page.getByRole("heading", { name: "训练完成" })).toBeVisible();
    await expect(page.getByText("正确", { exact: true }).locator("..")).toContainText("0");
    await expect(page.getByText("总题", { exact: true }).locator("..")).toContainText("20");

    // 今日复习计划应基于刚产生的错题生成；FSRS 错题默认 10 分钟后到期，
    // 这里直接置为立即到期，避免用例等待真实时长。
    forceReviewDue(activatedStudentUsername);
    await page.goto("/student");
    await expect(page.getByText("今日复习计划")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/错题巩固/).first()).toBeVisible();
    await page.goto("/student/history");
    await expect(page.getByText("A级顺序练习").first()).toBeVisible();
    await expect(page.getByText("20 题", { exact: false }).first()).toBeVisible();

    for (let sessionNumber = 1; sessionNumber <= 4; sessionNumber += 1) {
      await page.goto("/student/wrong");
      await expect(page.getByText("待巩固 20", { exact: true })).toBeVisible();
      await page.getByRole("link", { name: "随机巩固错题" }).click();
      await expect(page.getByText("第 1 / 20 题", { exact: true })).toBeVisible();

      for (let questionNumber = 1; questionNumber <= 20; questionNumber += 1) {
        await answerCorrect(page);
        await page.getByRole("button", { name: questionNumber === 20 ? "查看结果" : "下一题" }).click();
      }
      await expect(page.getByRole("heading", { name: "训练完成" })).toBeVisible();
      await expect(page.getByText("正确", { exact: true }).locator("..")).toContainText("20");
      await expect(page.getByText("总题", { exact: true }).locator("..")).toContainText("20");
    }

    await page.goto("/student/wrong");
    await expect(page.getByText("待巩固 0", { exact: true })).toBeVisible();
    await expect(page.getByText("已掌握 20", { exact: true })).toBeVisible();
    // 一键清除错题：先制造一道错题，再通过学生端清除
    await page.goto("/student/practice/start?mode=order&level=A");
    await expect(page).toHaveURL(/\/student\/practice\?session=/, { timeout: 30_000 });
    await expect(page.getByText("第 1 / 20 题", { exact: true })).toBeVisible();
    await answerWrong(page);
    await page.goto("/student/wrong");
    await expect(page.getByText("待巩固 1", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "一键清除错题" }).click();
    await page.getByRole("button", { name: "确认清除" }).click();
    await expect(page.getByText("待巩固 0", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.goto("/student/history");
    await expect(page.getByText("错题巩固练习").first()).toBeVisible();
  });


  test("student can use random, favorite and mock exam channels", async ({ page }) => {
    await login(page, activatedStudentUsername, changedPassword, "/student");

    // 随机刷题
    await page.getByRole("link", { name: /A级随机刷题/ }).click();
    await expect(page).toHaveURL(/\/student\/practice\?session=/, { timeout: 30_000 });
    await expect(page.getByText("第 1 / 20 题", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "收藏", exact: true }).click();
    await expect(page.getByRole("button", { name: "收藏", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("link", { name: "退出训练" }).click();
    await expect(page).toHaveURL(/\/student$/, { timeout: 20_000 });

    // 收藏列表与收藏练习
    await page.goto("/student/favorites");
    await expect(page.getByRole("heading", { name: "我的收藏" })).toBeVisible();
    await expect(page.getByRole("link", { name: "练习收藏题" })).toBeVisible();
    await page.getByRole("link", { name: "练习收藏题" }).click();
    await expect(page).toHaveURL(/\/student\/practice\?session=/, { timeout: 30_000 });
    await expect(page.getByText("第 1 / 1 题", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "退出训练" }).click();
    await expect(page).toHaveURL(/\/student$/, { timeout: 20_000 });

    // 教师配置的模拟测试蓝图
    await page.goto("/student/practice/start");
    const examLink = page.getByRole("link", { name: new RegExp(`A级·${blueprintName}`) });
    await expect(examLink).toBeVisible();
    await examLink.click();
    await expect(page).toHaveURL(/\/student\/practice\?session=/, { timeout: 30_000 });
    await expect(page.getByText("模拟考试", { exact: true })).toBeVisible();
    await expect(page.getByText("第 1 / 1 题", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "放弃考试" }).click();
    await expect(page).toHaveURL(/\/student$/, { timeout: 20_000 });
  });

  test("Excel preview, issue report, commit, and revert work as one server-owned batch", async ({ page }) => {
    await login(page, "teacher", "123456", "/teacher/import");
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
      await expect(page.getByText("单 sheet 导入向导")).toBeVisible();
      await page.getByLabel("大类知识点（类型）").selectOption({ label: "默认（DEFAULT）" });
      await page.getByRole("button", { name: "应用向导并重新预检" }).click();
      await expect(page.getByRole("button", { name: "确认导入 101 道题" })).toBeVisible();
      await expect(page.getByText("总行数", { exact: true }).locator("..")).toContainText("101");
      await expect(page.getByText("可导入", { exact: true }).locator("..")).toContainText("101");
      await expect(page.getByText("警告", { exact: true }).locator("..")).toContainText("101");
      await expect(page.getByText("错误", { exact: true }).locator("..")).toContainText("0");
      await page.getByRole("button", { name: "确认导入 101 道题" }).click();
      await expect(page.getByRole("dialog", { name: "字母类归类向导" })).toBeVisible();
      await page.getByRole("button", { name: "暂不归类" }).click();
      await expect(page.getByText("成功导入 101 道题，跳过重复 0 道")).toBeVisible();

      const batchList = page.getByText("最近导入批次").locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]");
      const batch = batchList.getByText(path.basename(filePath)).locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]").first();
      await expect(batch).toContainText("COMMITTED");
      await batch.getByRole("button", { name: "查看报告" }).click();
      await expect(batch.getByText("问题报告（共 101 行）")).toBeVisible({ timeout: 30_000 });
      await expect(batch.getByText(/警告［题目编号］/).first()).toBeVisible({ timeout: 30_000 });

      page.once("dialog", (dialog) => dialog.accept());
      const revertResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/api/v1/teacher/import-batches/") && response.url().endsWith("/revert"), { timeout: 30_000 });
      await batch.getByRole("button", { name: "撤销" }).click();
      const revertResponse = await revertResponsePromise;
      expect(revertResponse.ok()).toBe(true);
      expect(await revertResponse.json()).toEqual({ archived: 101 });
      await expect(page.getByText("已归档 101 道题目，未物理删除任何公开题目")).toBeVisible({ timeout: 15_000 });
      await expect(batch).toContainText("REVERTED");
      await expect(batch.getByRole("button", { name: "撤销" })).toHaveCount(0);
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });
});
