import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === "true";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: "retain-on-failure", ...(process.env.CI ? {} : { channel: "chrome" as const }) },
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `${baseURL}/api/health/live`,
    reuseExistingServer,
    timeout: 120_000,
    env: { ...process.env, COOKIE_SECURE: "false" },
  },
});
