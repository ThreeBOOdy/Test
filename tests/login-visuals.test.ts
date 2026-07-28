import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("login input readability", () => {
  it("keeps focused and autofilled inputs readable in the dark theme", () => {
    const form = fs.readFileSync(path.resolve("components/login-form.tsx"), "utf8");
    const css = fs.readFileSync(path.resolve("app/globals.css"), "utf8");

    expect(form).not.toContain("focus-within:bg-white");
    expect(form).toContain("text-[var(--foreground)]");
    expect(form).toContain("placeholder:text-[var(--muted-foreground)]");
    expect(css).toContain("input:-webkit-autofill");
    expect(css).toContain("-webkit-text-fill-color: var(--foreground)");
  });
});
