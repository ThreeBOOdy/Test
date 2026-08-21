import { expect, test } from "@playwright/test";
import { login } from "./helpers/login";

// 回归测试: 桌面端侧边栏必须能被点击并完成路由跳转。
// 背景: 内容包装层 z-10 曾覆盖 z-auto 的固定侧边栏, 导致点击被透明层拦截(点击不报错也不跳转)。
const roles = [
  { username: "student", home: "/student", target: "开始练习", expected: "/student/practice/start" },
  { username: "teacher", home: "/teacher", target: "题库管理", expected: "/teacher/questions" },
  { username: "admin", home: "/admin", target: "学生账号", expected: "/admin/students" },
] as const;

test("desktop sidebar links receive clicks and navigate for every role", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const { username, home, target, expected } of roles) {
    await login(page, username, "123456", home);
    const link = page.locator("aside nav a", { hasText: target }).first();
    await expect(link).toBeVisible();
    // 若侧边栏被透明层覆盖, click 会因收不到指针事件而超时
    await link.click();
    await expect(page).toHaveURL(new RegExp(expected.replaceAll("/", "\\/")));
  }
});