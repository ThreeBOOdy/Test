import { expect, test } from "@playwright/test";
import { loginViaUi } from "./helpers/login";

const TEST_PASSWORD = "123456";

const roles = [
  { username: "student", home: "/student" },
  { username: "teacher", home: "/teacher" },
  { username: "admin", home: "/admin" },
] as const;

test.describe.serial("public entry acceptance", () => {
  test("unauthenticated home shows the minimal brand page and points to student login", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "波段研习 · 无线电考证智能刷题" })).toBeVisible();
    await expect(page.getByRole("link", { name: /开始刷题/ })).toBeVisible();
    await expect(page.getByText("进入教师控制台", { exact: true })).toHaveCount(0);
    await expect(page.getByText("进入学生频道", { exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: /开始刷题/ }).click();
    await expect(page).toHaveURL(new RegExp("/login\\?next=/student$"));

    await expect(page.getByRole("heading", { name: "学员登录" })).toBeVisible();
    await expect(page.getByText("还没有账号？", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: /注册学生账号/ })).toBeVisible();
  });

  test("student, teacher and admin log in to their role home and root redirects when authenticated", async ({ page }) => {
    for (const role of roles) {
      await loginViaUi(page, role.username, TEST_PASSWORD, role.home);

      await page.goto("/");
      await expect(page).toHaveURL(new RegExp(`${role.home.replaceAll("/", "\\/")}$`), { timeout: 20_000 });
    }
  });

  test("login page registration link navigates to the register page", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /注册学生账号/ }).click();

    await expect(page).toHaveURL(new RegExp("/register$"));
    await expect(page.getByRole("heading", { name: "注册学生账号" })).toBeVisible();
  });
});
