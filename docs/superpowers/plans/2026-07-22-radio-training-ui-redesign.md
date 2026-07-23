# 无线电训练 UI 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变数据库结构、认证、抽题、判题和角色权限的前提下，把系统重构为训练效率优先、手机与电脑同等可用的“克制科技 / 未来通信”体验，并使用 `gpt-image-2` 生成五组无文字美术资源。

**Architecture:** 保留 Next.js App Router 的服务端数据获取和现有 API，把练习页拆成纯状态函数、可测试交互组件和网络提交容器。全局视觉由 CSS 令牌、基础 UI 和轻量背景组件统一；图片由独立 Image API 生成到 `public/art/`，页面通过 `next/image` 响应式加载。教师端只调整壳层和信息层级，不改变业务逻辑。

**Tech Stack:** Next.js 16、React 19、TypeScript 6、Tailwind CSS 4、Prisma 7、Vitest 4、React Testing Library、`gpt-image-2`、CSS transitions。

---

## File Map

- Testing: `vitest.config.ts`, `tests/setup.ts`, `tests/fixtures/practice-session.ts`, `tests/practice-ui.test.ts`, `tests/practice-runner.test.tsx`, `tests/app-shell.test.tsx`.
- Art: five prompt files under `art-prompts/` and five matching WebP files under `public/art/`.
- Design system: `app/globals.css`, `components/ui/*`, and new `components/visual/*`.
- Shell: new `components/mobile-navigation.tsx`; refactor `components/app-shell.tsx`.
- Practice: new `lib/domain/practice-ui.ts`, `components/training/*`; refactor `components/practice-runner.tsx`.
- Pages: student, public/auth and teacher routes plus their existing manager/form components.

---

### Task 1: Add Component Testing Infrastructure

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/fixtures/practice-session.ts`

- [ ] **Step 1: Install dependencies**

Run:

```powershell
npm.cmd install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

Expected: npm exits `0`; package files change without peer-dependency errors.

- [ ] **Step 2: Add Vitest configuration**

Create `vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
```

- [ ] **Step 3: Add a reusable fixture**

Create `tests/fixtures/practice-session.ts` exporting `practiceSessionFixture(overrides)`. It returns a two-question `PublicPracticeSession`: one A-level single-choice radio-wave question and one A-level two-answer interference question. Use stable IDs `session-1`, `question-1`, `question-2`, option IDs `A-D`, and `initialResults: {}` so component tests can override only the required fields.

- [ ] **Step 4: Verify current tests**

Run `npm.cmd test`.

Expected: existing practice engine, question editor and import suites pass under jsdom.

- [ ] **Step 5: Checkpoint**

Run `git diff -- package.json package-lock.json vitest.config.ts tests/setup.ts tests/fixtures/practice-session.ts`.

Expected: only test infrastructure changes. Do not commit unless explicitly requested.

---

### Task 2: Generate Five GPT Image Assets

**Files:**
- Create: `art-prompts/home-orbital-network.txt`
- Create: `art-prompts/login-antenna-array.txt`
- Create: `art-prompts/student-spectrum-cabin.txt`
- Create: `art-prompts/empty-no-signal.txt`
- Create: `art-prompts/training-complete.txt`
- Create: matching `public/art/*.webp`

- [ ] **Step 1: Load the mandatory image skill**

Run:

```powershell
Get-Content -Raw -Encoding UTF8 'C:\Users\admin\.codex\skills\api-image\SKILL.md'
```

Expected: use `generate_image.py`, `CODEX_IMAGE_BASE_URL`, `CODEX_IMAGE_API_KEY`, and `gpt-image-2`; never print the key or alter Codex provider configuration.

- [ ] **Step 2: Write prompt briefs**

Each prompt must explicitly forbid people, logos, letters, numbers, readable text, watermarks, excessive neon, cyberpunk and game HUDs.

```text
home-orbital-network: dark charcoal orbital communications network above Earth, restrained cyan/muted-violet signal arcs, precise antenna geometry, left-side negative space, wide editorial 3D composition.
login-antenna-array: precision antenna array at blue hour, secure calm mood, centered square composition with responsive crop margins.
student-spectrum-cabin: dark spectrum operations cabin, cyan spectrum ribbon, right-weighted wide composition, efficient and focused.
empty-no-signal: compact receiver with lowered antenna and interrupted cyan waveform, reassuring square empty-state icon.
training-complete: circular antenna aperture locking onto a clean cyan signal, calm mastery, square central composition; no trophy or confetti.
```

- [ ] **Step 3: Verify environment names without printing values**

```powershell
if (-not $env:CODEX_IMAGE_BASE_URL) { throw 'Missing CODEX_IMAGE_BASE_URL' }
if (-not $env:CODEX_IMAGE_API_KEY) { throw 'Missing CODEX_IMAGE_API_KEY' }
Write-Output 'Image API environment is configured.'
```

- [ ] **Step 4: Generate all assets**

Run the mandatory script once per prompt:

```powershell
python C:\Users\admin\.codex\skills\api-image\scripts\generate_image.py `
  --prompt-file art-prompts\home-orbital-network.txt `
  --out public\art\home-orbital-network.webp `
  --model gpt-image-2 --mode generate --size 1536x1024 --quality high `
  --output-format webp --output-compression 88 `
  --base-url "$env:CODEX_IMAGE_BASE_URL" --api-key-env CODEX_IMAGE_API_KEY --timeout 300
```

Repeat with `login-antenna-array`, `empty-no-signal`, and `training-complete` at `1024x1024`, and `student-spectrum-cabin` at `1536x1024`. Shell timeout must exceed the request timeout. Never fall back to the conversation provider.

- [ ] **Step 5: Validate and inspect**

Use Pillow to assert WebP format, exact dimensions, and file size above 20 KB. Open all five images locally. Regenerate any asset containing text, watermark, malformed antenna geometry, excessive glow, crushed shadows, or a game-like HUD.

---

### Task 3: Build the Restrained Technology Design System

**Files:**
- Modify: `app/globals.css`
- Modify: `components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `progress.tsx`
- Create: `components/visual/signal-backdrop.tsx`
- Create: `components/visual/spectrum-progress.tsx`
- Create: `components/visual/empty-signal-state.tsx`

- [ ] **Step 1: Replace global tokens**

Use this token contract:

```css
:root {
  color-scheme: dark;
  --background: #070b12;
  --surface: #0d1420;
  --surface-elevated: #121c2a;
  --surface-soft: #101827;
  --foreground: #f3f7fb;
  --muted-foreground: #94a3b8;
  --primary: #55d7e8;
  --primary-strong: #83e7f1;
  --primary-foreground: #031116;
  --secondary: #172235;
  --secondary-strong: #1e2d45;
  --secondary-foreground: #dce9f4;
  --violet: #8d7cf7;
  --success: #42d39b;
  --warning: #e6b866;
  --danger: #f07886;
  --border: rgba(148, 163, 184, 0.18);
  --border-strong: rgba(85, 215, 232, 0.38);
  --ring: rgba(85, 215, 232, 0.72);
  --grid-line: rgba(148, 163, 184, 0.07);
  --shadow-card: 0 18px 60px rgba(0, 0, 0, 0.24);
}
```

Add a 320px minimum body width, restrained cyan/violet radial gradients, a 42px CSS grid utility, safe-area bottom padding, and `prefers-reduced-motion: reduce` rules that effectively disable transitions and animations.

- [ ] **Step 2: Refactor primitives**

```text
Button: 44px minimum height; cyan primary with dark text; dark secondary/outline/ghost; muted rose danger; no neon glow.
Card: --surface, 24px radius, --border, --shadow-card; no hard-coded white.
Badge: low-saturation semantic tones; preserve neutral/green/blue/amber/red API.
Progress: clamp value and expose role="progressbar", aria-valuemin="0", aria-valuemax="100", aria-valuenow.
```

- [ ] **Step 3: Add visual helpers**

`SignalBackdrop` renders only aria-hidden CSS grid and two faint orbital rings. `SpectrumProgress` accepts `{ answered, total, className? }`, renders one segment per question, and exposes progressbar aria values. `EmptySignalState` accepts `{ title, description, action?, compact? }` and uses `/art/empty-no-signal.webp` with `next/image`; text and action remain meaningful if the image fails.

- [ ] **Step 4: Validate**

Run `npx.cmd eslint components/ui components/visual` and `npx.cmd tsc --noEmit`.

Expected: both exit `0`.

---

### Task 4: Show Real User and Complete Mobile Navigation

**Files:**
- Create: `components/mobile-navigation.tsx`
- Modify: `components/app-shell.tsx`
- Create: `tests/app-shell.test.tsx`

- [ ] **Step 1: Write failing tests**

Test real identity:

```tsx
render(
  <AppShellView role="student" currentPath="/student" user={{ username: "student-7", displayName: "周同学" }}>
    <div />
  </AppShellView>,
);
expect(screen.getByText("周同学")).toBeInTheDocument();
expect(screen.queryByText("林小知")).not.toBeInTheDocument();
```

Test teacher mobile reachability:

```tsx
render(<MobileNavigation role="teacher" currentPath="/teacher" />);
await user.click(screen.getByRole("button", { name: "打开更多导航" }));
for (const label of ["管理概览", "题库管理", "知识点目录", "抽题规则", "Excel 导入", "学生管理"]) {
  expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
}
```

- [ ] **Step 2: Verify failure**

Run `npx.cmd vitest run tests/app-shell.test.tsx`.

Expected: missing `AppShellView` and `MobileNavigation` exports.

- [ ] **Step 3: Implement navigation behavior**

```text
Student bar: 学习首页 / 练习记录 / 我的错题.
Teacher primary bar: 管理概览 / 题库管理 / 学生管理 / 更多.
Teacher sheet: all six routes, including primary routes.
Close on route click, Escape, backdrop click, or close button.
More button: aria-expanded and aria-controls="mobile-nav-sheet".
Sheet: role="dialog", aria-label="教师功能导航".
Bottom bar accounts for env(safe-area-inset-bottom).
```

Do not use `slice(0, 3)`.

- [ ] **Step 4: Split async wrapper and view**

```ts
type ShellUser = { username: string; displayName: string };
export async function AppShell(props: { role: "student" | "teacher"; currentPath: string; children: React.ReactNode })
export function AppShellView(props: { role: "student" | "teacher"; currentPath: string; user: ShellUser; children: React.ReactNode })
```

`AppShell` calls cached `getCurrentUser()`. `AppShellView` uses the first visible character of `displayName.trim() || username` as avatar and removes all hard-coded person names.

- [ ] **Step 5: Verify**

Run `npx.cmd vitest run tests/app-shell.test.tsx` and `npx.cmd tsc --noEmit`.

Expected: tests and type check pass.

---

### Task 5: Define Practice UI State with TDD

**Files:**
- Create: `lib/domain/practice-ui.ts`
- Create: `tests/practice-ui.test.ts`

- [ ] **Step 1: Write failing tests**

Cover these exact cases:

```ts
expect(getInitialQuestionIndex(session.questions, { "question-1": result })).toBe(1);
expect(toggleDraftSelection(["A"], "B", "SINGLE_CHOICE", 1)).toEqual(["B"]);
expect(toggleDraftSelection(["A", "B"], "C", "MULTIPLE_CHOICE", 2)).toEqual(["A", "B"]);
expect(toggleDraftSelection(["A", "B"], "A", "MULTIPLE_CHOICE", 2)).toEqual(["B"]);
expect(getQuestionUiState({ isCurrent: false, draftCount: 0, result: { isCorrect: true } })).toBe("correct");
expect(getQuestionUiState({ isCurrent: false, draftCount: 1 })).toBe("drafted");
```

- [ ] **Step 2: Verify module failure**

Run `npx.cmd vitest run tests/practice-ui.test.ts`.

- [ ] **Step 3: Implement pure helpers**

```ts
import type { PublicAnswerResult, PublicQuestion, QuestionType } from "@/lib/domain/types";

export type QuestionUiState = "current" | "correct" | "wrong" | "drafted" | "unanswered";

export function getInitialQuestionIndex(questions: PublicQuestion[], results: Record<string, PublicAnswerResult>) {
  const index = questions.findIndex((question) => !results[question.id]);
  return index === -1 ? 0 : index;
}

export function toggleDraftSelection(current: string[], optionId: string, type: QuestionType, maximum: number) {
  if (type === "SINGLE_CHOICE") return [optionId];
  if (current.includes(optionId)) return current.filter((id) => id !== optionId);
  return current.length >= maximum ? current : [...current, optionId];
}

export function getQuestionUiState(input: { isCurrent: boolean; draftCount: number; result?: Pick<PublicAnswerResult, "isCorrect"> }): QuestionUiState {
  if (input.result) return input.result.isCorrect ? "correct" : "wrong";
  if (input.isCurrent) return "current";
  return input.draftCount > 0 ? "drafted" : "unanswered";
}
```

- [ ] **Step 4: Verify state contract**

Run `npx.cmd vitest run tests/practice-ui.test.ts`.

Expected: all tests pass.

---

### Task 6: Build Focused Practice Components

**Files:**
- Create: `components/training/answer-option.tsx`
- Create: `components/training/question-navigator.tsx`
- Create: `components/training/practice-summary.tsx`

- [ ] **Step 1: Implement AnswerOption**

Public props:

```ts
type AnswerOptionProps = {
  index: number;
  option: { id: string; text: string };
  selected: boolean;
  disabled: boolean;
  correct?: boolean;
  wrongSelected?: boolean;
  onToggle: () => void;
};
```

Render a native button with `aria-pressed`. Show a `1-9` keyboard hint. Use cyan for unanswered selection, green plus Check icon for correct feedback, and rose plus X icon for a wrong selected answer. Minimum height is 64px; long text wraps; answered options remain fully readable instead of becoming translucent.

- [ ] **Step 2: Implement QuestionNavigator**

Props include `questions`, `currentIndex`, `drafts`, `results`, and `onSelect(index)`. Map each question through `getQuestionUiState`. Buttons are labelled `第 N 题，状态`; include a compact legend. Hide below `lg`; keep buttons at least 36px square.

- [ ] **Step 3: Implement PracticeSummary**

Props are `{ title, correct, total }`. Calculate integer accuracy and use `/art/training-complete.webp`. Render “训练完成”, correct/total/accuracy metrics, primary link to `/student`, and secondary link to `/student/history`. No confetti, trophy, ranking, or game-score wording.

- [ ] **Step 4: Validate components**

Run `npx.cmd eslint components/training` and `npx.cmd tsc --noEmit`.

Expected: both exit `0`.

---

### Task 7: Refactor PracticeRunner with Interaction Tests

**Files:**
- Modify: `components/practice-runner.tsx`
- Create: `tests/practice-runner.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Add tests for:

```text
An initial result for question-1 opens question-2.
Number key 1 selects option A; Enter posts the answer.
A draft selected on question-1 remains selected after next/previous navigation.
Submitting one selection on a two-answer question shows role="alert" with “本题要求选择 2 项”.
Successful final submission renders “训练完成”.
```

Mock `fetch` with a real JSON `Response` containing `isCorrect`, `correctOptionIds`, `selectedOptionIds`, `answeredCount`, and `correctCount`.

- [ ] **Step 2: Verify current behavior fails**

Run `npx.cmd vitest run tests/practice-runner.test.tsx`.

Expected: resume, keyboard, draft persistence and accessible alert cases fail.

- [ ] **Step 3: Store drafts per question**

Use:

```tsx
const [index, setIndex] = useState(() => getInitialQuestionIndex(session.questions, session.initialResults));
const [drafts, setDrafts] = useState<Record<string, string[]>>({});
const [results, setResults] = useState<Record<string, AnswerResult>>(session.initialResults);
const question = session.questions[index];
const result = results[question.id];
const selected = result?.selectedOptionIds ?? drafts[question.id] ?? [];
```

`toggleOption` calls `toggleDraftSelection`. A successful submission writes the answer to `results` and removes only the submitted question’s draft.

- [ ] **Step 4: Rebuild responsive layout**

```text
Desktop >=1024px: question card plus 280px sticky navigator.
Mobile: one focused column; no question grid.
Mobile actions: fixed thumb-zone surface above safe-area inset.
Desktop actions: inside the card with shortcut hints.
Header: session title, 第 N / total 题, answered count, SpectrumProgress.
Feedback derives from result.selectedOptionIds.
Every result present: render PracticeSummary.
```

- [ ] **Step 5: Add guarded shortcuts**

Register one cleaned-up `window.keydown` listener. Ignore input, textarea, select and contenteditable targets.

```text
1-9: toggle corresponding option while unanswered.
Enter: submit unanswered; move next when answered.
ArrowLeft / ArrowRight: navigate.
Prevent default only when handled.
```

- [ ] **Step 6: Preserve API and harden errors**

Keep the existing POST URL and body exactly. Parse JSON inside `try/catch/finally`; always reset pending. Malformed/network failures show `提交失败，请稍后重试` in `role="alert"` and do not mutate results.

- [ ] **Step 7: Verify practice suite**

Run:

```powershell
npx.cmd vitest run tests/practice-ui.test.ts tests/practice-runner.test.tsx
```

Expected: all practice UI tests pass.

---

### Task 8: Rebuild the Student Training Console

**Files:**
- Modify: `app/student/page.tsx`
- Modify: `app/student/history/page.tsx`
- Modify: `app/student/wrong/page.tsx`

- [ ] **Step 1: Prioritize continuation**

Query both session statuses, then derive:

```ts
const completedSessions = sessions.filter((session) => session.status === "COMPLETED");
const activeSession = sessions.find((session) => session.status === "IN_PROGRESS");
```

Use only completed sessions for accuracy and weekly metrics. If `activeSession` exists, the strongest CTA is `继续上次训练` linking to `/student/practice?session=${activeSession.id}`. Otherwise prioritize the first available level rule, then knowledge rule. Keep current inventory checks and do not add recommendation logic.

- [ ] **Step 2: Integrate spectrum-cabin art**

Use `next/image` with `/art/student-spectrum-cabin.webp`, descriptive alt, `fill`, `priority`, and `sizes="(max-width: 1024px) 100vw, 46vw"`. Bound the container aspect ratio and add a dark gradient overlay so text remains readable.

- [ ] **Step 3: Reorder content**

Render: primary/continuation hero; available level and knowledge channels; four compact metrics; recent completed training and wrong-question shortcut.

- [ ] **Step 4: Make history resumable**

In-progress rows show `继续训练` linking to their session. Completed rows retain accuracy. Replace the plain empty paragraph with `EmptySignalState` titled `尚未建立训练记录`.

- [ ] **Step 5: Improve wrong-question hierarchy**

Preserve query, ordering, badges and wrong counts. Give unresolved items stronger contrast, mastered items reduced contrast, and use `EmptySignalState` titled `当前没有待巩固信号` when empty.

- [ ] **Step 6: Type-check student pages**

Run `npx.cmd tsc --noEmit`.

Expected: no Prisma include or Image prop errors.

---

### Task 9: Upgrade Landing and Authentication Pages

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/login/page.tsx`
- Modify: `app/change-password/page.tsx`
- Modify: `components/login-form.tsx`
- Modify: `components/change-password-form.tsx`

- [ ] **Step 1: Rebuild the landing hero**

Use `SignalBackdrop` and `/art/home-orbital-network.webp` via `next/image` with `fill`, `priority`, and `sizes="(max-width: 1024px) 100vw, 52vw"`. Keep both student/teacher entry routes and the existing three capability claims. Replace light demo cards with dark surface panels. Motion is limited to subtle 1-2px hover movement and 180-240ms transitions.

- [ ] **Step 2: Build split authentication layouts**

Desktop login: 44% antenna art and 56% form, max width 1120px. Mobile: compact art header above the form. Password change reuses the art as a low-contrast desktop side panel and hides it on narrow screens. Preserve all redirect behavior.

- [ ] **Step 3: Refactor form states**

Inputs use `--surface-soft`, `--border`, visible `focus-within`, existing autocomplete and length constraints. Errors use `role="alert"`. Pending labels do not change button width. Demo credentials stay visible in a low-emphasis disclosure panel.

- [ ] **Step 4: Validate public/auth pages**

Run:

```powershell
npx.cmd eslint app/page.tsx app/login/page.tsx app/change-password/page.tsx components/login-form.tsx components/change-password-form.tsx
npx.cmd tsc --noEmit
```

Expected: both exit `0`.

---

### Task 10: Restyle Teacher Console Without Business Changes

**Files:**
- Modify: `app/teacher/page.tsx`, `questions/page.tsx`, `knowledge/page.tsx`, `rules/page.tsx`, `import/page.tsx`, `students/page.tsx`
- Modify: `components/page-header.tsx`, `stat-card.tsx`
- Modify: `components/question-manager.tsx`, `knowledge-manager.tsx`, `knowledge-tree-view.tsx`
- Modify: `components/rule-editor.tsx`, `import-preview.tsx`, `student-manager.tsx`

- [ ] **Step 1: Apply the teacher visual contract**

```text
Page header: eyebrow, strong title, compact description; actions right-aligned desktop and full-width mobile.
Stats: compact dark panels with tabular numbers and one restrained semantic accent.
Tables/lists: 44px controls and horizontal overflow contained inside cards.
Forms: labels above dark inputs, visible focus, consistent error/success panels.
Rose is destructive only; cyan is primary/current only.
No charts, new metrics, new endpoints, or new Prisma queries.
```

- [ ] **Step 2: Restyle route composition**

All six teacher pages use the new `AppShell`, dark cards and consistent spacing. Preserve every server query and manager prop. At 360px, title and primary action appear before the first data panel.

- [ ] **Step 3: Restyle managers**

Preserve create/edit/archive/enable, validation, import preview/commit conditions, password reset, and student enable/disable behavior. Stack editors on mobile. Wrap wide option tables inside `overflow-x-auto`; never allow body-level horizontal overflow. Import warnings/errors must use icon/text as well as color.

- [ ] **Step 4: Search obsolete light surfaces**

Run:

```powershell
rg -n "bg-white|text-slate-900|border-slate-200|emerald-50" app components
```

Expected: remaining matches are intentional semantic feedback only. Replace generic white/light panels with design tokens without blindly changing success/error states.

- [ ] **Step 5: Validate teacher code**

Run:

```powershell
npx.cmd eslint app/teacher components/page-header.tsx components/stat-card.tsx components/question-manager.tsx components/knowledge-manager.tsx components/knowledge-tree-view.tsx components/rule-editor.tsx components/import-preview.tsx components/student-manager.tsx
npx.cmd tsc --noEmit
```

Expected: both exit `0`.

---

### Task 11: Run Responsive and Accessibility Browser QA

**Files:**
- Modify only files that fail these checks.

- [ ] **Step 1: Start local services**

```powershell
docker compose up -d db
npm.cmd exec prisma migrate deploy
npm.cmd run db:seed
npm.cmd run dev
```

Expected: PostgreSQL becomes healthy, migrations and seed complete, and Next.js serves locally. Never run `docker compose down -v` because it destroys data.

- [ ] **Step 2: Verify student mobile at 390 × 844**

Use `build-web-apps:frontend-testing-debugging` and verify:

```text
Login -> student dashboard.
Continuation/primary training appears before analytics.
Long stems/options wrap without horizontal overflow.
Multi-select cap, incomplete alert and server feedback are readable.
Bottom actions do not cover the last option.
Completion art, summary links, history and wrong-question states work.
```

- [ ] **Step 3: Verify student desktop at 1440 × 900**

Question navigator stays sticky; all states are distinguishable. Number keys select; Enter submits/moves; arrows navigate. Resume opens first unanswered. Tab focus is visible. Art remains subordinate to controls.

- [ ] **Step 4: Verify teacher mobile at 390 × 844**

Open `更多` and visit:

```text
/teacher
/teacher/questions
/teacher/knowledge
/teacher/rules
/teacher/import
/teacher/students
```

Expected: all routes are reachable and no form/table causes body-level horizontal overflow.

- [ ] **Step 5: Verify reduced motion and failed images**

Enable reduced motion: transitions become effectively instant and nothing loops or flashes. Block `*/art/*.webp`: bounded containers preserve layout, text preserves meaning, and primary actions remain usable.

---

### Task 12: Complete Automated and Production Validation

**Files:**
- Modify only files required to resolve redesign regressions.

- [ ] **Step 1: Run the full test suite**

Run `npm.cmd test`.

Expected: existing domain tests and new shell/practice tests pass.

- [ ] **Step 2: Run lint and TypeScript**

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
```

Expected: both exit `0`.

- [ ] **Step 3: Prove the database contract is unchanged**

```powershell
npx.cmd prisma validate
git diff --exit-code -- prisma/schema.prisma prisma/migrations
```

Expected: schema validates and no schema/migration diff exists.

- [ ] **Step 4: Run production build**

Run `npm.cmd run build`.

Expected: Prisma generation and Next.js build succeed; every route compiles.

- [ ] **Step 5: Check artifacts and secrets**

```powershell
git diff --check
git status --short
rg -n "CODEX_IMAGE_API_KEY|OPENAI_API_KEY|sk-[A-Za-z0-9_-]+" . --glob '!node_modules/**' --glob '!.next/**' --glob '!package-lock.json'
```

Expected: diff check is clean; status contains only intended source, prompt, test, plan and image files; no key value is embedded. Environment-variable names may appear in documentation.

- [ ] **Step 6: Review against approved specification**

Run `git diff --stat` and inspect `git diff -- app components lib tests art-prompts docs/superpowers public/art package.json vitest.config.ts`.

Confirm:

```text
Restrained future-communications visual direction.
Practice is the strongest experience.
Mobile and desktop are first-class.
Real user display name appears.
All teacher mobile routes are reachable.
First-unanswered resume works.
Five gpt-image-2 assets exist and contain no text.
No large animation/chart dependency was added.
prefers-reduced-motion is respected.
Database, auth, draw/scoring logic and roles are unchanged.
```

- [ ] **Step 7: Present for user review**

Report changed files, image previews, test/build results and environmental limitations. Do not commit or push unless explicitly requested.

---

## Execution Notes

- Implement tasks in order. Task 2 may run parallel to dependency installation only with disjoint workers.
- Use `superpowers:test-driven-development` before Tasks 4, 5 and 7.
- Use `api-image` for Task 2 and never route raster generation through the conversation provider.
- Use `build-web-apps:react-best-practices` for React/Next edits and `build-web-apps:frontend-testing-debugging` for Task 11.
- Use `superpowers:verification-before-completion` before claiming completion.
- Do not create a worktree, branch, commit or push unless the user explicitly asks.
