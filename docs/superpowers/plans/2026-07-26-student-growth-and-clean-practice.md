# Student Growth Space and Clean Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the full student growth-space entry flow while limiting the clean layout to active answer sessions.

**Architecture:** Keep the existing student dashboard, history, and wrong-question pages unchanged. Route public student entry to the dashboard, wrap the unified launcher in the shared student `AppShell`, and leave the active practice session as the only shell-free student page.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Lock the student entry contract

**Files:**
- Modify: `tests/auth-routing.test.ts`
- Modify: `tests/repository-quality.test.ts`

- [ ] Change the role-entry assertions so a student session and a logged-out student entry both target `/student`.
- [ ] Add repository assertions that the launcher uses `AppShell` with `currentPath="/student/practice/start"` while the active practice page does not use `AppShell`.
- [ ] Run `npm.cmd test -- tests/auth-routing.test.ts tests/repository-quality.test.ts` and confirm the new assertions fail before implementation.

### Task 2: Restore the dashboard as primary entry

**Files:**
- Modify: `lib/domain/auth-routing.ts`
- Modify: `app/page.tsx`

- [ ] Change `getEntryHrefForRole` so the student entry path is `/student`.
- [ ] Update public-home student copy to describe the full learning space rather than only the launcher.
- [ ] Run the targeted routing and repository-quality tests and confirm they pass.

### Task 3: Put the launcher inside student navigation

**Files:**
- Modify: `app/student/practice/start/page.tsx`

- [ ] Import `AppShell` and wrap the rendered launcher with `role="student"` and `currentPath="/student/practice/start"`.
- [ ] Preserve query-driven immediate launch behavior so quick-entry links still redirect directly into a practice session.
- [ ] Keep `app/student/practice/page.tsx` shell-free so only the answer session remains visually clean.
- [ ] Run the targeted repository-quality test and confirm it passes.

### Task 4: Verify the separated flows

**Files:**
- Test: `tests/auth-routing.test.ts`
- Test: `tests/repository-quality.test.ts`
- Test: `tests/practice-runner.test.tsx`

- [ ] Run `npm.cmd test -- tests/auth-routing.test.ts tests/repository-quality.test.ts tests/practice-runner.test.tsx`.
- [ ] Open `http://localhost:3000`, log in as a student, and verify public home → learning dashboard → launcher → answer session.
- [ ] Confirm dashboard navigation exposes history and wrong questions, launcher keeps the same navigation, and the answer session hides navigation and question metadata.
