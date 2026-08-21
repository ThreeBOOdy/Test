import { expect, test } from "@playwright/test";
import { login } from "./helpers/login";

test.describe.serial("teacher class gamification control", () => {
  test("teacher can hide and show gamification for a grade", async ({ page }) => {
    await login(page, "teacher", "123456", "/teacher");
    await expect(page.getByRole("heading", { name: "班级游戏化显示" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("七年级", { exact: true }).first()).toBeVisible();

    const row = page.getByText("JUNIOR_1", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]").first();

    // 若上一轮失败把年级留在了“隐藏游戏化”，先恢复为显示，保证用例可重入。
    if (await row.getByText("隐藏游戏化", { exact: true }).count()) {
      await row.getByRole("button", { name: "显示" }).click();
      await expect(row).toContainText("显示游戏化", { timeout: 30_000 });
    }
    await expect(row).toContainText("显示游戏化");

    await row.getByRole("button", { name: "隐藏" }).click();
    await expect(row).toContainText("隐藏游戏化", { timeout: 30_000 });

    await row.getByRole("button", { name: "显示" }).click();
    await expect(row).toContainText("显示游戏化", { timeout: 30_000 });
  });
});
