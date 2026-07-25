import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("repository release quality", () => {
  it("uses the dedicated WebP artwork for every visual scene", () => {
    const expectedReferences = new Map([
      ["app/page.tsx", "/art/home-orbital-network.webp"],
      ["app/login/page.tsx", "/art/login-antenna-array.webp"],
      ["app/change-password/page.tsx", "/art/login-antenna-array.webp"],
      ["app/student/page.tsx", "/art/student-spectrum-cabin.webp"],
      ["components/visual/empty-signal-state.tsx", "/art/empty-no-signal.webp"],
      ["components/training/practice-summary.tsx", "/art/training-complete.webp"],
    ]);

    for (const [file, reference] of expectedReferences) {
      expect(read(file), `${file} should reference ${reference}`).toContain(reference);
      expect(fs.existsSync(path.join(root, "public", reference))).toBe(true);
    }

    const sourceFiles = [...expectedReferences.keys(), "components/visual/artwork.tsx"];
    for (const file of sourceFiles) expect(read(file), `${file} should not reference legacy visuals`).not.toContain("/visuals/");
    expect(fs.existsSync(path.join(root, "public", "visuals"))).toBe(false);
  });

  it("preloads above-the-fold artwork with the current Next.js image API", () => {
    const artwork = read("components/visual/artwork.tsx");
    expect(artwork).toContain("preload={preload}");
    expect(artwork).toContain('loading={preload ? "eager" : "lazy"}');
    expect(artwork).not.toContain("priority={priority}");
    expect(read("app/page.tsx")).toContain("preload variant=\"orbital\"");
    expect(read("app/login/page.tsx")).toContain("preload variant=\"antenna\"");
    expect(read("app/change-password/page.tsx")).toContain("preload variant=\"antenna\"");
    expect(read("app/student/page.tsx")).toContain("preload variant=\"spectrum\"");
  });

  it("declares smooth scroll behavior for Next.js route transitions", () => {
    expect(read("app/layout.tsx")).toContain('data-scroll-behavior="smooth"');
  });

  it("isolates integration and end-to-end MySQL databases in CI", () => {
    const workflow = read(".github/workflows/ci.yml");
    expect(workflow).toContain("practice_ci_integration");
    expect(workflow).toContain("practice_ci_e2e");
    expect(workflow).toContain("mysql:8.0.46");
    expect(workflow.indexOf("practice_ci_e2e")).toBeLessThan(workflow.lastIndexOf("npm run db:seed"));
    expect(workflow.lastIndexOf("npm run db:seed")).toBeLessThan(workflow.indexOf("npm run test:e2e"));
  });

  it("documents main as the unified production branch", () => {
    const readme = read("README.md");
    expect(readme).toContain("当前统一主线：`main`");
    expect(readme).not.toContain("当前生产化开发分支：`codex/production-hardening`");
  });

  it("pins the patched Next.js release", () => {
    const packageJson = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
    expect(packageJson.dependencies.next).toBe("16.2.11");
  });
});
