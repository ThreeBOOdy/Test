import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("modern signal laboratory visual contract", () => {
  it("defines reusable radio surfaces and restrained motion tokens", () => {
    const css = read("app/globals.css");
    expect(css).toContain("--signal-cyan");
    expect(css).toContain("--signal-amber");
    expect(css).toContain("--font-mono");
    expect(css).toContain("--motion-fast");
    expect(css).toContain(".spectrum-waterfall");
    expect(css).toContain(".receiver-panel");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("uses radio status instruments in the app shell", () => {
    const shell = read("components/app-shell.tsx");
    expect(shell).toContain("CallsignLabel");
    expect(shell).toContain("SignalMeter");
    expect(shell).toContain("FrequencyScale");
    expect(shell).toContain("频道已同步");
  });

  it("keeps the unified launcher as the only practice mode directory", () => {
    const studentHome = read("app/student/page.tsx");
    expect(studentHome).not.toContain("基础练习模式");
    expect(studentHome).not.toContain("/student/practice/start?mode=order");
    expect(studentHome).not.toContain("/student/practice/start?mode=random");
    expect(studentHome).not.toContain("/student/practice/start?mode=exam");
  });
});
