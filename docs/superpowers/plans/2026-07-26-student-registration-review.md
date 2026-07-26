# Student Registration and Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver public student registration, restricted application status, administrator review, grade maintenance, and complete administrator student-account management.

**Architecture:** Route every account transition through one server service that normalizes data, encrypts sensitive values, checks keyed uniqueness hashes, writes review/audit history, and increments `sessionVersion`. Public, restricted-student, and administrator APIs use separate capability guards. UI components consume safe DTOs and never receive full sensitive values unless an administrator explicitly opens an edit form.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma/MySQL, Zod, Vitest, Testing Library, Playwright.

**Depends On:** `docs/superpowers/plans/2026-07-26-student-account-foundation.md`

---

### Task 1: Registration Domain Contracts

**Files:**
- Create: `lib/domain/student-registration.ts`
- Create: `tests/student-registration.test.ts`

- [ ] **Step 1: Write failing tests** for username format, trimmed name/school, enabled-grade requirement, strict ID/phone validation, matching passwords, immutable username, mandatory rejection reason, and legal transitions `PENDING→ACTIVE`, `PENDING→REJECTED`, `REJECTED→PENDING`.
- [ ] **Step 2: Verify RED** with `npx.cmd vitest run tests/student-registration.test.ts`.
- [ ] **Step 3: Export Zod schemas** `publicRegistrationSchema`, `registrationProfileUpdateSchema`, `approveRegistrationSchema`, `rejectRegistrationSchema`, `adminStudentUpdateSchema`, and `gradeMutationSchema`.
- [ ] **Step 4: Export transition helpers** `assertReviewTransition` and `buildDefaultValidity(reviewDate)`; the latter returns start date and one-calendar-year end date.
- [ ] **Step 5: Verify GREEN** with the focused test command.

### Task 2: Student Account Service

**Files:**
- Create: `lib/server/student-account-service.ts`
- Create: `tests/integration/student-account-workflows.test.ts`

- [ ] **Step 1: Write failing integration tests** for self-registration, duplicate username/hash conflicts, pending edits, rejected resubmission, approval defaults, mandatory rejection reason, admin edits, long-term toggling, disable/enable, and password reset.
- [ ] **Step 2: Verify RED** with `npm.cmd run test:integration -- --run tests/integration/student-account-workflows.test.ts`.
- [ ] **Step 3: Implement** `registerStudent`, `getRegistrationStatus`, `updateRegistrationProfile`, `resubmitRegistration`, `approveRegistration`, `rejectRegistration`, `listStudents`, `getStudentDetail`, `updateStudentAccount`, and `resetStudentPassword`.
- [ ] **Step 4: Set exact source/status values**: self-registration creates `registrationSource = SELF_REGISTRATION` and `studentStatus = PENDING`; approval changes only the status to `ACTIVE`.
- [ ] **Step 5: Normalize and validate first**, then compute HMAC conflicts, encrypt full values, derive gender, and write `StudentReviewRecord` plus `AuditLog` in the same transaction.
- [ ] **Step 6: Increment `sessionVersion`** for approvals, rejections, sensitive-profile changes, enabled changes, validity changes, long-term changes, and password resets.
- [ ] **Step 7: Use conditional updates** on status and `updatedAt`; map conflicts to `STALE_ACCOUNT_STATE`.
- [ ] **Step 8: Verify GREEN** with the focused integration test.

### Task 3: Public Registration and Login Routing

**Files:**
- Create: `app/api/v1/auth/register/route.ts`
- Modify: `app/api/v1/auth/login/route.ts`
- Create: `app/api/v1/grades/public/route.ts`
- Create: `components/student-registration-form.tsx`
- Create: `app/register/page.tsx`
- Modify: `components/login-form.tsx`
- Modify: `app/login/page.tsx`
- Create: `tests/student-registration-form.test.tsx`
- Modify: `tests/auth-routing.test.ts`

- [ ] **Step 1: Write failing component tests** for the login-page registration link, automatic gender display, password confirmation, grade loading, successful submission, and safe conflict messaging.
- [ ] **Step 2: Write failing login tests** proving pending/rejected users receive a restricted session, active valid users enter `/student`, admins enter `/admin`, and disabled/expired/future accounts receive specific post-password errors without a cookie.
- [ ] **Step 3: Verify RED** with `npx.cmd vitest run tests/student-registration-form.test.tsx tests/auth-routing.test.ts` and the new integration cases.
- [ ] **Step 4: Implement public APIs** using `assertSameOrigin`, body limits, Zod schemas, registration rate limiting, and safe `REGISTRATION_CONFLICT` responses.
- [ ] **Step 5: Implement registration UI** at `/register` with username, name, ID, derived read-only gender, school, enabled grade, phone, password, confirmation, and truth/privacy acknowledgment.
- [ ] **Step 6: Update login routing** to return stable status codes only after password verification and create restricted cookies only for pending/rejected students.
- [ ] **Step 7: Verify GREEN** with focused unit/integration tests and `npx.cmd tsc --noEmit`.

### Task 4: Restricted Application Status

**Files:**
- Create: `app/api/v1/registration/route.ts`
- Create: `app/api/v1/registration/resubmit/route.ts`
- Create: `components/registration-status.tsx`
- Create: `app/registration/status/page.tsx`
- Create: `tests/registration-status.test.tsx`

- [ ] **Step 1: Write failing tests** for masked read-only display, editable pending data, rejected reason/reviewer/time, immutable username, recalculated gender, and explicit resubmission.
- [ ] **Step 2: Verify RED** with `npx.cmd vitest run tests/registration-status.test.tsx`.
- [ ] **Step 3: Implement GET/PATCH** using `requireRegistrationStudent`; GET returns masked DTOs, while the edit action may return the signed-in student's own decrypted ID/phone only inside the edit response.
- [ ] **Step 4: Implement resubmission** only from `REJECTED`; clear current reason, update `submittedAt`, preserve history, and increment `sessionVersion` so the old restricted session is replaced by a fresh login.
- [ ] **Step 5: Implement status UI** with pending/rejected variants, modification form, rejection details, resubmit action, and logout.
- [ ] **Step 6: Verify GREEN** with focused component and integration tests.

### Task 5: Grade Administration

**Files:**
- Create: `app/api/v1/admin/grades/route.ts`
- Create: `app/api/v1/admin/grades/[id]/route.ts`
- Create: `components/grade-manager.tsx`
- Create: `app/admin/grades/page.tsx`
- Create: `tests/grade-manager.test.tsx`
- Extend: `tests/integration/student-account-workflows.test.ts`

- [ ] **Step 1: Write failing tests** for add, rename, sort, enable, disable, duplicate code/name rejection, and refusal to delete referenced grades.
- [ ] **Step 2: Verify RED** with focused unit and integration tests.
- [ ] **Step 3: Implement admin-only APIs** with `requireAdministrator` and optimistic `updatedAt` checks.
- [ ] **Step 4: Implement manager UI** showing code, name, order, enabled state, and associated student count.
- [ ] **Step 5: Verify GREEN** with focused tests and type checking.

### Task 6: Administrator Registration Review

**Files:**
- Create: `app/api/v1/admin/registrations/route.ts`
- Create: `app/api/v1/admin/registrations/[id]/approve/route.ts`
- Create: `app/api/v1/admin/registrations/[id]/reject/route.ts`
- Create: `app/api/v1/admin/registrations/bulk-approve/route.ts`
- Create: `components/registration-review-manager.tsx`
- Create: `app/admin/registrations/page.tsx`
- Create: `tests/registration-review-manager.test.tsx`

- [ ] **Step 1: Write failing UI/API tests** for search, grade/date filters, pending counts, single approval with editable dates/long-term, bulk default approval, mandatory rejection reason, and stale-state conflict handling.
- [ ] **Step 2: Verify RED** with the focused component test and workflow integration test.
- [ ] **Step 3: Implement admin-only list and transition routes**; approval/rejection must condition on current `PENDING` status.
- [ ] **Step 4: Implement review UI** showing safe masked data by default and an audited explicit detail action for full ID/phone.
- [ ] **Step 5: Do not implement bulk rejection**. Bulk approval uses the same current business date and one-calendar-year default for every selected row.
- [ ] **Step 6: Verify GREEN** with focused tests and type checking.

### Task 7: Administrator Student Management

**Files:**
- Replace: `components/student-manager.tsx`
- Create: `app/admin/students/page.tsx`
- Modify: `app/api/v1/admin/students/route.ts`
- Modify: `app/api/v1/admin/students/[id]/route.ts`
- Create: `app/api/v1/admin/students/[id]/reset-password/route.ts`
- Modify: `app/teacher/students/page.tsx`
- Create: `tests/student-manager.test.tsx`

- [ ] **Step 1: Write failing tests** for masked list columns, immutable username, full admin edit form, ID-driven gender, validity edits, long-term toggle, disable/enable, password reset, legacy incomplete badge, and session revocation.
- [ ] **Step 2: Verify RED** with `npx.cmd vitest run tests/student-manager.test.tsx` and workflow integration tests.
- [ ] **Step 3: Replace legacy teacher-only create/update contract** with administrator list/detail/update/reset endpoints backed by `student-account-service`.
- [ ] **Step 4: Implement admin page** with filters for source, review status, effective status, grade, long-term, and incomplete legacy profiles.
- [ ] **Step 5: Redirect `/teacher/students`** to `/admin/students` for admins; ordinary teachers receive the existing role-mismatch/no-permission path and never fetch student data.
- [ ] **Step 6: Verify GREEN** with component, integration, repository-quality, and type tests.

### Task 8: Review History and Audit Safety

**Files:**
- Create: `app/api/v1/admin/students/[id]/history/route.ts`
- Create: `components/student-account-history.tsx`
- Modify: `lib/server/audit.ts`
- Extend: `tests/integration/student-account-workflows.test.ts`

- [ ] **Step 1: Write failing tests** that every submit/update/resubmit/approve/reject/admin-edit/validity/long-term/disable/reset action writes expected structured history and audit action.
- [ ] **Step 2: Assert logs never contain** password, full national ID, full phone, encryption ciphertext, or hash values.
- [ ] **Step 3: Implement history API and UI** with non-sensitive summaries and administrator-only access.
- [ ] **Step 4: Verify GREEN** with the focused integration suite.

### Task 9: End-to-End Registration Flow

**Files:**
- Modify: `tests/e2e/production-flows.spec.ts`
- Modify: `prisma/seed.ts` only if deterministic E2E fixtures require additional pending/rejected users.

- [ ] **Step 1: Add E2E flow**: public registration → pending status → admin rejection with mandatory reason → student edit/resubmit → admin approval → restricted session revoked → student login and practice access.
- [ ] **Step 2: Add E2E access controls**: teacher cannot open admin student pages; admin can open teaching pages; disable expires a current student session; long-term toggle restores access.
- [ ] **Step 3: Run** `npm.cmd run test:e2e` with configured MySQL and secrets.
- [ ] **Step 4: Run full verification**: `npm.cmd test`, `npm.cmd run test:integration`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
- [ ] **Step 5: Stop here**; begin student Excel import only after registration and administration flows pass.
