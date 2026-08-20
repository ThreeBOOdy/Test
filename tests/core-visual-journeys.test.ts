import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("core visual journeys", () => {
  it("uses the public auth shell on the login entry", () => {
    expect(read("app/login/page.tsx")).toContain("PublicAuthShell");
  });

  it("uses the shared authentication console for internal auth pages", () => {
    for (const file of ["app/register/page.tsx", "app/change-password/page.tsx"]) {
      expect(read(file), file).toContain("AuthConsole");
    }
  });

  it("uses the generated signal-station artwork on registration", () => {
    expect(read("app/register/page.tsx")).toContain("/art/register-signal-station.webp");
    expect(fs.existsSync(path.join(process.cwd(), "public/art/register-signal-station.webp"))).toBe(true);
  });

  it("uses the ambient signal field on the home brand page and keeps radio instruments on role surfaces", () => {
    expect(read("app/page.tsx")).toContain("SignalField");
    expect(read("app/page.tsx")).toContain("开始刷题");
    expect(read("app/student/page.tsx")).toContain("CallsignLabel");
    expect(read("app/student/practice/start/page.tsx")).toContain("FrequencyScale");
    expect(read("app/teacher/page.tsx")).toContain("SignalMeter");
  });
});
