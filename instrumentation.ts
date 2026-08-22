export async function register() {
  if (process.env.NEXT_RUNTIME !== "edge") {
    // Standalone server (`node .next/standalone/server.js`) does not load `.env`
    // automatically. Load it here so DATABASE_URL and other secrets are available
    // to the login/auth stack in production deployments.
    await import("dotenv/config");
    const { assertProductionStudentDataEnvironment } = await import("@/lib/server/env");
    assertProductionStudentDataEnvironment();
  }
}
