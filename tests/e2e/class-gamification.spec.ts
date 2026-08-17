import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, username: string, password: string, destination: string) {
  await page.goto(`/login?next=${encodeURIComponent(destination)}`);
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "进入系统", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination.replaceAll("/", "\\/")}$`), { timeout: 20_000 });
}

test.describe.serial("teacher class gamification control", () => {
  test("teacher can hide and show gamification for a grade", async ({ page }) => {
    await login(page, "teacher", "ChangeMe123!", "/teacher");
    await expect(page.getByRole("heading", { name: "班级游戏化显示" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("七年级", { exact: true })).toBeVisible();

    const row = page.getByText("JUNIOR_1", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    await expect(row).toContainText("显示游戏化");

    await row.getByRole("button", { name: "隐藏" }).click();
    await expect(row).toContainText("隐藏游戏化");

    await row.getByRole("button", { name: "显示" }).click();
    await expect(row).toContainText("显示游戏化");
  });
});
