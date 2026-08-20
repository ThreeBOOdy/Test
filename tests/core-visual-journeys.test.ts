import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("core visual journeys", () => {
  it("uses the public auth shell on the login and registration entries", () => {
    for (const file of ["app/login/page.tsx", "app/register/page.tsx"]) {
      expect(read(file), file).toContain("PublicAuthShell");
    }
  });

  it("uses the shared authentication console for internal auth pages", () => {
    expect(read("app/change-password/page.tsx")).toContain("AuthConsole");
  });

  it("does not use the legacy signal-station artwork on registration", () => {
    expect(read("app/register/page.tsx")).not.toContain("/art/register-signal-station.webp");
  });

  it("uses the ambient signal field on the home brand page and keeps radio instruments on role surfaces", () => {
    expect(read("app/page.tsx")).toContain("SignalField");
    expect(read("app/page.tsx")).toContain("开始刷题");
    expect(read("app/student/page.tsx")).toContain("CallsignLabel");
    expect(read("app/student/practice/start/page.tsx")).toContain("FrequencyScale");
    expect(read("app/teacher/page.tsx")).toContain("SignalMeter");
  });
});
