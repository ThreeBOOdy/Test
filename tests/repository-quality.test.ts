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

  it("keeps the dashboard primary while routing practice choices through the launcher", () => {
    const home = read("app/page.tsx");
    const studentHome = read("app/student/page.tsx");
    const launcher = read("app/student/practice/start/page.tsx");
    const practice = read("app/student/practice/page.tsx");
    const navigation = read("components/navigation-items.ts");

    expect(home).toContain('getEntryHrefForRole("STUDENT"');
    expect(home).toContain('href={studentHref as never}');
    expect(navigation).toContain('{ href: "/student/practice/start", label: "开始练习"');
    expect(studentHome).toContain('<AppShell role="student" currentPath="/student">');
    expect(studentHome).toContain('href="/student/history"');
    expect(studentHome).toContain('href="/student/wrong"');
    expect(studentHome).not.toMatch(/["']\?{2,}["']/);
    expect(studentHome).not.toMatch(/href=\{`\/student\/practice\?mode=/);
    expect(studentHome).toContain("/student/practice/start?mode=order");
    expect(studentHome).toContain("/student/practice/start?mode=random");
    expect(studentHome).toContain("/student/practice/start?mode=exam");
    expect(launcher).toContain('import { AppShell } from "@/components/app-shell"');
    expect(launcher).toContain('<AppShell role="student" currentPath="/student/practice/start">');
    expect(practice).not.toContain("AppShell");
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

  it("uses capability guards for teaching and student practice routes", () => {
    const teachingRoutes = [
      "app/api/v1/admin/knowledge-points/route.ts",
      "app/api/v1/admin/knowledge-points/[id]/route.ts",
      "app/api/v1/admin/practice-rules/route.ts",
      "app/api/v1/admin/questions/route.ts",
      "app/api/v1/admin/questions/[id]/route.ts",
      "app/api/v1/admin/import-batches/route.ts",
      "app/api/v1/admin/import-batches/[id]/route.ts",
      "app/api/v1/admin/import-batches/[id]/revert/route.ts",
      "app/api/v1/imports/preview/route.ts",
      "app/api/v1/imports/commit/route.ts",
    ];
    const studentRoutes = [
      "app/api/v1/practice-sessions/route.ts",
      "app/api/v1/practice-sessions/[id]/answers/route.ts",
      "app/api/v1/practice-sessions/[id]/submit/route.ts",
    ];

    for (const file of teachingRoutes) {
      expect(read(file), `${file} should allow administrators to use teaching features`).toContain("requireTeachingUser");
      expect(read(file), `${file} should not use the legacy teacher-only guard`).not.toContain('requireRole("TEACHER")');
    }
    for (const file of studentRoutes) {
      expect(read(file), `${file} should enforce active-student access`).toContain("requireActiveStudent");
      expect(read(file), `${file} should not use the legacy student-only guard`).not.toContain('requireRole("STUDENT")');
    }
  });

  it("reserves student account management for administrators", () => {
    const collection = read("app/api/v1/admin/students/route.ts");
    const detail = read("app/api/v1/admin/students/[id]/route.ts");
    const service = read("lib/server/student-account-service.ts");

    expect(collection).toContain("requireAdministrator");
    expect(detail).toContain("requireAdministrator");
    expect(collection).not.toContain('requireRole("TEACHER")');
    expect(detail).not.toContain('requireRole("TEACHER")');
    expect(collection).not.toContain("prisma.user.create");
    expect(detail).toContain("updateStudentAccount");
    expect(service).toContain("sessionVersion: { increment: 1 }");
  });
});
