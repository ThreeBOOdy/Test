# Student Account Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the data, security, access-control, role, and navigation foundation required by student registration and administrator account management.

**Architecture:** Extend the unified `User` model with nullable student fields so legacy accounts migrate safely. Keep identity and validity rules pure in `lib/domain`, cryptography server-only, and derive capabilities from fresh database state for every protected request. `ADMIN` receives account-management pages and may also use teaching features.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Prisma 7/MySQL, Zod 4, Node `crypto`, Jose JWT, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-26-student-account-registration-review-design.md`

---

### Task 1: Identity Validation

**Files:**
- Create: `lib/domain/student-identity.ts`
- Create: `tests/student-identity.test.ts`

- [ ] **Step 1: Write failing tests** for normalization, checksum, impossible dates, gender derivation, and mainland mobile numbers.
- [ ] **Step 2: Verify RED** with `npx.cmd vitest run tests/student-identity.test.ts`; expect the missing-module failure.
- [ ] **Step 3: Implement** `StudentGender`, `normalizeNationalId`, `validateMainlandNationalId`, `deriveGenderFromNationalId`, `normalizePhone`, and `validateMainlandPhone`.
- [ ] **Step 4: Use** ID weights `[7,9,10,5,8,4,2,1,6,3,7,9,10,5,8,4,2]`, checksum map `1,0,X,9,8,7,6,5,4,3,2`, strict date round-trips, and `^1[3-9]\\d{9}$`.
- [ ] **Step 5: Verify GREEN** with the same focused test command.

### Task 2: Effective Access Rules

**Files:**
- Create: `lib/domain/student-access.ts`
- Create: `tests/student-access.test.ts`

- [ ] **Step 1: Write failing tests** for leap-day calendar years, inclusive end dates, long-term bypass, pending/rejected restricted access, disabled, future, expired, forced-password, teacher, and administrator decisions.
- [ ] **Step 2: Verify RED** with `npx.cmd vitest run tests/student-access.test.ts`.
- [ ] **Step 3: Define** `AppRole`, `StudentStatus`, `AccessCapability`, `AccessErrorCode`, `AccountAccessInput`, and `AccessDecision`.
- [ ] **Step 4: Implement** `addCalendarYear(date)` and `evaluateAccountAccess(input, today)` using ISO date-only strings and inclusive end dates.
- [ ] **Step 5: Verify GREEN** with the focused test command.

### Task 3: Sensitive Data Protection

**Files:**
- Create: `lib/server/student-sensitive-data.ts`
- Create: `tests/student-sensitive-data.test.ts`
- Modify: `lib/server/env.ts`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Write failing tests** that set two synthetic 32-byte Base64 keys, round-trip an encrypted ID, reject a tampered authentication tag, produce deterministic HMAC output, and mask IDs and phones.
- [ ] **Step 2: Verify RED** with `npx.cmd vitest run tests/student-sensitive-data.test.ts`.
- [ ] **Step 3: Add** `getStudentDataSecrets()` and `getBusinessTimeZone()` to `lib/server/env.ts`. Reject missing or malformed production keys without printing their values.
- [ ] **Step 4: Implement** `encryptSensitiveValue`, `decryptSensitiveValue`, `hashSensitiveValue`, `maskNationalId`, and `maskPhone`.
- [ ] **Step 5: Use** AES-256-GCM, a random 12-byte IV, a 16-byte tag, versioned Base64URL storage, and HMAC-SHA-256.
- [ ] **Step 6: Add** `APP_TIME_ZONE`, `STUDENT_DATA_ENCRYPTION_KEY`, and `STUDENT_DATA_HASH_KEY` placeholders to `.env.example` and document PowerShell key generation in `README.md`.
- [ ] **Step 7: Verify GREEN** with `npx.cmd vitest run tests/student-sensitive-data.test.ts tests/production-rules.test.ts` and `npx.cmd tsc --noEmit`.

### Task 4: Prisma Schema and Legacy Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260726110000_student_account_foundation/migration.sql`
- Modify: `prisma/seed.ts`
- Modify: `tests/mysql-migration.test.ts`
- Modify: `tests/integration/production-foundation.test.ts`

- [ ] **Step 1: Write failing migration assertions** for the `ADMIN` enum value, `Grade`, `StudentReviewRecord`, nullable encrypted fields, and unique ID/phone hash indexes.
- [ ] **Step 2: Verify RED** with `npx.cmd vitest run tests/mysql-migration.test.ts`.
- [ ] **Step 3: Add enums** `StudentAccountStatus`, `StudentRegistrationSource`, `StudentGender`, and `StudentReviewAction`; add `ADMIN` to `UserRole`.
- [ ] **Step 4: Use exact registration source values** `SELF_REGISTRATION`, `EXCEL_IMPORT`, and `LEGACY` so later services and import code share one generated Prisma type.
- [ ] **Step 5: Add User fields** `studentStatus`, `registrationSource`, encrypted/hash/last-four identity fields, `gender`, `school`, `gradeId`, submission/review fields, validity dates, `isLongTerm`, and `profileIncomplete`.
- [ ] **Step 6: Add models** `Grade` and `StudentReviewRecord` with reviewer/student relations and indexes from the specification.
- [ ] **Step 7: Generate migration** with `npm.cmd exec prisma migrate dev -- --name student_account_foundation`.
- [ ] **Step 8: Inspect SQL** to ensure it preserves User IDs and practice foreign keys, backfills existing students to `ACTIVE`/`LEGACY`/long-term/incomplete, and promotes only username `teacher`.
- [ ] **Step 9: Update seed** so `teacher` is `ADMIN`, `instructor` is `TEACHER`, stable grades are seeded, and demo `student` remains usable as a legacy long-term account.
- [ ] **Step 10: Verify GREEN** with `npm.cmd run db:generate`, `npx.cmd vitest run tests/mysql-migration.test.ts`, and `npm.cmd run test:integration`.

### Task 5: Session Capabilities and Guards

**Files:**
- Modify: `lib/server/session.ts`
- Modify: `lib/server/api.ts`
- Modify: `lib/server/time.ts`
- Modify: `tests/integration/production-foundation.test.ts`

- [ ] **Step 1: Write failing integration tests** for `FULL_ADMIN`, `FULL_TEACHER`, `FULL_STUDENT`, `REGISTRATION_ONLY`, expired, future, disabled, and stale-version sessions.
- [ ] **Step 2: Verify RED** with `npm.cmd run test:integration -- --run tests/integration/production-foundation.test.ts`.
- [ ] **Step 3: Extend `SessionPayload`** to allow `ADMIN` and select current student status, validity, long-term, and password flags from the database.
- [ ] **Step 4: Derive capability** by calling `evaluateAccountAccess` with the business date from `lib/server/time.ts`; return `null` for unusable full sessions but retain pending/rejected students as `REGISTRATION_ONLY`.
- [ ] **Step 5: Export guards** `requireAdministrator`, `requireTeachingUser`, `requireActiveStudent`, and `requireRegistrationStudent`. `requireTeachingUser` accepts administrators and teachers.
- [ ] **Step 6: Verify GREEN** with the integration test and `npx.cmd tsc --noEmit`.

### Task 6: Administrator Routing and Navigation

**Files:**
- Modify: `lib/domain/auth-routing.ts`
- Modify: `tests/auth-routing.test.ts`
- Modify: `components/navigation-items.ts`
- Modify: `components/app-shell.tsx`
- Modify: `components/mobile-navigation.tsx`
- Modify: `tests/app-shell.test.tsx`
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Modify: `app/teacher/layout.tsx`
- Modify: `app/student/layout.tsx`
- Modify: `app/change-password/page.tsx`
- Modify: `components/change-password-form.tsx`

- [ ] **Step 1: Write failing routing tests** for `/admin`, administrator access to `/teacher`, teacher denial from `/admin`, and `REGISTRATION_ONLY` defaulting to `/registration/status`.
- [ ] **Step 2: Write failing shell tests** proving admin navigation contains 注册审核、学生账号、学生导入、年级配置 while teacher navigation excludes them.
- [ ] **Step 3: Verify RED** with `npx.cmd vitest run tests/auth-routing.test.ts tests/app-shell.test.tsx`.
- [ ] **Step 4: Implement routing** so administrators may use `/admin` and `/teacher`; teachers only `/teacher`; students only `/student`; restricted students only the registration status path.
- [ ] **Step 5: Add protected admin layout and overview**, extend `AppShellView` to `student | teacher | admin`, and preserve current visual structure.
- [ ] **Step 6: Change password redirect** to accept `AccessCapability` and call `getDefaultPathForCapability`.
- [ ] **Step 7: Verify GREEN** with focused tests and `npx.cmd tsc --noEmit`.

### Task 7: Administrator Teaching Access

**Files:**
- Modify: `app/api/v1/admin/knowledge-points/route.ts`
- Modify: `app/api/v1/admin/knowledge-points/[id]/route.ts`
- Modify: `app/api/v1/admin/practice-rules/route.ts`
- Modify: `app/api/v1/admin/questions/route.ts`
- Modify: `app/api/v1/admin/questions/[id]/route.ts`
- Modify: `app/api/v1/admin/import-batches/route.ts`
- Modify: `app/api/v1/admin/import-batches/[id]/route.ts`
- Modify: `app/api/v1/admin/import-batches/[id]/revert/route.ts`
- Modify: `app/api/v1/imports/preview/route.ts`
- Modify: `app/api/v1/imports/commit/route.ts`
- Modify: `app/teacher/layout.tsx`
- Modify: `tests/repository-quality.test.ts`

- [ ] **Step 1: Add a failing repository rule** that teaching routes must not use the legacy teacher-only role guard.
- [ ] **Step 2: Verify RED** with `npx.cmd vitest run tests/repository-quality.test.ts`.
- [ ] **Step 3: Replace guards** with `requireTeachingUser()` for questions, knowledge points, practice rules, reports, question imports, import batches, and reverts.
- [ ] **Step 4: Keep student-account routes separate**; they use administrator-only guards in the next plan.
- [ ] **Step 5: Verify GREEN** with repository tests, integration tests, and `npx.cmd tsc --noEmit`.

### Task 8: Enforce Active Student Access Everywhere

**Files:**
- Modify: `app/api/v1/practice-sessions/route.ts`
- Modify: `app/api/v1/practice-sessions/[id]/answers/route.ts`
- Modify: `app/api/v1/practice-sessions/[id]/submit/route.ts`
- Modify: `app/student/layout.tsx`
- Modify: `app/student/page.tsx`
- Modify: `app/student/history/page.tsx`
- Modify: `app/student/wrong/page.tsx`
- Modify: `app/student/practice/page.tsx`
- Modify: `app/student/practice/start/page.tsx`
- Modify: `tests/repository-quality.test.ts`
- Extend: `tests/integration/production-foundation.test.ts`

- [ ] **Step 1: Add a failing repository rule** that student practice routes may not use the legacy student-only role guard.
- [ ] **Step 2: Add integration cases** showing expiration, disablement, or long-term removal blocks the next create/answer/submit request.
- [ ] **Step 3: Replace route checks** with `requireActiveStudent()` and ensure all student server pages require `FULL_STUDENT` before querying learning data.
- [ ] **Step 4: Verify GREEN** with repository, integration, and type tests.

### Task 9: Foundation Verification

- [ ] Run `npm.cmd run db:generate` and `npx.cmd prisma format`.
- [ ] Run `npm.cmd test`, `npm.cmd run test:integration`, `npm.cmd run lint`, and `npm.cmd run build`.
- [ ] Run `git diff --check`.
- [ ] Inspect encryption, environment, session, schema, migration, and seed diffs for leaked secrets or plaintext student data.
- [ ] Stop here; begin the registration/review plan only after this phase passes.
