import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === "true";

const channel = process.env.PLAYWRIGHT_CHANNEL?.trim() || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...(channel ? { channel } : {}),
  },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `${baseURL}/api/health/live`,
    reuseExistingServer,
    timeout: 120_000,
    env: { ...process.env, COOKIE_SECURE: "false" },
  },
});
