export async function register() {
  if (process.env.NEXT_RUNTIME !== "edge") {
    const { assertProductionStudentDataEnvironment } = await import("@/lib/server/env");
    assertProductionStudentDataEnvironment();
  }
}
