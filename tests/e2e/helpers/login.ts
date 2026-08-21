import { expect, type Page } from "@playwright/test";

/**
 * Wait until React has hydrated the login form.
 *
 * Without this wait, Playwright can click the submit button before React
 * attaches the client-side `onSubmit` handler. The native HTML form then
 * performs a GET submission, leaking credentials into the URL and staying on
 * the login page, which makes UI-login E2E flaky in cold-start / dev-server runs.
 *
 * The wait is deliberately bounded: if the chunk/hydration is slow or missing,
 * the caller should let the test retry rather than hang until the test timeout.
 */
async function waitForLoginHydration(page: Page, timeoutMs = 8_000) {
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return form && Object.keys(form).some((key) => key.startsWith("__reactProps$"));
  }, { timeout: timeoutMs }).catch(() => {
    // Non-fatal: a later retry will pick a hydrated page if this one was not.
  });
}

/**
 * Wait until React has hydrated the current document. Many client-interactive
 * pages (student manager, grade settings, practice UI) need React state to be
 * attached before buttons/selects can update; interacting before hydration
 * silently does nothing or leaves controls disabled.
 */
export async function waitForPageHydration(page: Page, timeoutMs = 10_000) {
  await page.waitForFunction(() => {
    return Object.keys(document.body).some((key) => key.startsWith("__reactProps$"));
  }, { timeout: timeoutMs }).catch(() => {
    // Non-fatal; the following locator waits usually surface a real failure.
  });
}

/**
 * UI login through the actual login form. Used by the public-entry acceptance
 * spec, which specifically covers the login page behaviour.
 */
export async function loginViaUi(page: Page, username: string, password: string, destination: string) {
  await page.goto(`/login?next=${encodeURIComponent(destination)}`);
  await waitForLoginHydration(page);
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "进入系统", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination.replaceAll("/", "\\/")}$`), { timeout: 20_000 });
}

/**
 * API login used by the long business-flow specs. It bypasses the form so the
 * suite is not blocked by the intermittent dev-server hydration flake; the
 * login UI itself is still covered by public-entry.spec.ts. The fetch runs in
 * the page context so cookies/session handling matches the browser.
 */
export async function login(page: Page, username: string, password: string, destination: string) {
  await page.goto("/login");
  const result = await page.evaluate(async ({ username, password, next }) => {
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, next }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.user) {
      throw new Error(`API login failed for ${username}: ${response.status} ${JSON.stringify(data)}`);
    }
    return data;
  }, { username, password, next: destination });
  if (!result.user) {
    throw new Error(`API login failed for ${username}: no user in response`);
  }
  await page.goto(destination);
  await waitForPageHydration(page);
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/$/);
}
