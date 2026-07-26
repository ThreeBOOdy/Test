# Student Account Excel Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add administrator-only Excel preview, editable validation, and atomic import for student accounts that become active immediately and require a first-login password change.

**Architecture:** Use student-import-specific batch and row models rather than mixing account data with question imports. Parse workbooks into normalized row DTOs, store non-password payload as JSON and the initial password as authenticated ciphertext bound to the creating administrator, and revalidate every row against current database state immediately before a single transaction creates users. Successful commit removes encrypted draft passwords and exposes only a non-sensitive result list.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma/MySQL, ExcelJS, Zod, Node cryptography, Vitest, Testing Library, Playwright.

**Depends On:** `docs/superpowers/plans/2026-07-26-student-registration-review.md`

---

### Task 1: Import Row Domain Rules

**Files:**
- Create: `lib/domain/student-import.ts`
- Create: `tests/student-import.test.ts`

- [ ] **Step 1: Write failing tests** for standard Chinese headers, enabled/long-term boolean aliases, Excel date values, `YYYY-MM-DD` text, default dates, end-without-start errors, disabled grades, password policy, ID/phone validation, and derived gender.
- [ ] **Step 2: Add duplicate-set tests** for username, national ID, and phone repeated across different sheets.
- [ ] **Step 3: Verify RED** with `npx.cmd vitest run tests/student-import.test.ts`.
- [ ] **Step 4: Define** `StudentImportRowInput`, `NormalizedStudentImportRow`, `StudentImportIssue`, `StudentImportValidationContext`, and `StudentImportValidationResult`.
- [ ] **Step 5: Implement** `normalizeStudentImportRow`, `validateStudentImportRow`, `findWorkbookDuplicates`, `parseImportBoolean`, and `parseImportDate` using the same identity and validity helpers as registration.
- [ ] **Step 6: Keep gender derived** and never accept it as an input column.
- [ ] **Step 7: Verify GREEN** with the focused test command.

### Task 2: Import Batch Persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260726120000_student_account_imports/migration.sql`
- Modify: `tests/mysql-migration.test.ts`
- Modify: `tests/integration/student-import-workflows.test.ts`

- [ ] **Step 1: Write failing migration tests** for `StudentImportBatch` and `StudentImportRow`, creator relation, status/expiry indexes, unique batch-row identity, encrypted-password field, and committed timestamp.
- [ ] **Step 2: Verify RED** with `npx.cmd vitest run tests/mysql-migration.test.ts`.
- [ ] **Step 3: Add** `StudentImportStatus` with `PREVIEW`, `COMMITTED`, `FAILED`, and `EXPIRED`.
- [ ] **Step 4: Add `StudentImportBatch`** with file name, status, counts, creator, sheet names JSON, expiry, committed time, and created time.
- [ ] **Step 5: Add `StudentImportRow`** with batch relation, sheet name, source row number, editable payload JSON excluding password, `initialPasswordEncrypted`, issues JSON, valid flag, and timestamps.
- [ ] **Step 6: Generate migration** with `npm.cmd exec prisma migrate dev -- --name student_account_imports` and inspect it for cascade deletion of rows only, never users.
- [ ] **Step 7: Verify GREEN** with `npm.cmd run db:generate`, migration tests, and the focused integration file.

### Task 3: Workbook Preview Service

**Files:**
- Create: `lib/server/student-import-service.ts`
- Create: `app/api/v1/admin/student-imports/preview/route.ts`
- Extend: `tests/integration/student-import-workflows.test.ts`

- [ ] **Step 1: Write failing integration tests** for multiple worksheets, limits, safe cached formula values, database conflicts, creator ownership, 24-hour expiry, and encrypted draft passwords.
- [ ] **Step 2: Verify RED** with `npm.cmd run test:integration -- --run tests/integration/student-import-workflows.test.ts`.
- [ ] **Step 3: Implement workbook parsing** with ExcelJS, exact header mapping, file/workbook/row limits, no macro or formula execution, and source sheet/row preservation.
- [ ] **Step 4: Implement `previewStudentImport`** to load enabled grades and existing uniqueness hashes, validate every row, encrypt each initial password, and create one batch plus rows in a transaction.
- [ ] **Step 5: Return safe DTOs** containing derived gender and issues but never password ciphertext, hashes, full existing-account sensitive values, or another administrator's draft.
- [ ] **Step 6: Enforce administrator-only and same-origin checks** in the route.
- [ ] **Step 7: Verify GREEN** with the focused integration test and type checking.

### Task 4: Editable Draft and Revalidation APIs

**Files:**
- Create: `app/api/v1/admin/student-imports/[id]/route.ts`
- Create: `app/api/v1/admin/student-imports/[id]/rows/[rowId]/route.ts`
- Create: `app/api/v1/admin/student-imports/[id]/validate/route.ts`
- Extend: `lib/server/student-import-service.ts`
- Extend: `tests/integration/student-import-workflows.test.ts`

- [ ] **Step 1: Write failing tests** for paginated draft retrieval, owner-only access, editable fields, optional password replacement, immediate gender recomputation, invalidation after edits, single-row validation, full validation, and expired-batch rejection.
- [ ] **Step 2: Verify RED** with the focused integration test.
- [ ] **Step 3: Implement `getStudentImportBatch`** returning page, page size, total, counts, safe rows, and expiry.
- [ ] **Step 4: Implement `updateStudentImportRow`** using the same registration schema; username remains editable before commit, and a replacement password is encrypted immediately.
- [ ] **Step 5: Implement `validateStudentImportBatch`** to recompute workbook duplicates and current database conflicts for every row and atomically refresh counts/issues.
- [ ] **Step 6: Refuse edits or validation** unless status is `PREVIEW`, batch is unexpired, and actor is its creator.
- [ ] **Step 7: Verify GREEN** with focused integration tests.

### Task 5: Atomic Commit

**Files:**
- Create: `app/api/v1/admin/student-imports/[id]/commit/route.ts`
- Extend: `lib/server/student-import-service.ts`
- Extend: `tests/integration/student-import-workflows.test.ts`

- [ ] **Step 1: Write failing tests** for all-valid requirement, final database recheck, default commit-date validity, custom dates, long-term accounts, disabled imports, direct `ACTIVE` status, `mustChangePassword = true`, and rollback after an injected row failure.
- [ ] **Step 2: Verify RED** with the focused integration test.
- [ ] **Step 3: Implement `commitStudentImport`** that locks/conditions the preview batch, revalidates all rows, decrypts initial passwords only inside the service, hashes passwords, encrypts sensitive fields, and creates all users in one transaction.
- [ ] **Step 4: Set exact account values** `registrationSource = EXCEL_IMPORT`, `studentStatus = ACTIVE`, and `mustChangePassword = true` for every imported user.
- [ ] **Step 5: Apply commit-time defaults**: missing start is the business date of commit; missing end is one calendar year later; long-term keeps dates but bypasses them.
- [ ] **Step 6: Mark batch committed and remove password material** by setting every `initialPasswordEncrypted` to `null` before transaction completion.
- [ ] **Step 7: Write audit metadata** containing counts, batch ID, and non-sensitive summaries only.
- [ ] **Step 8: Verify GREEN** with focused integration tests and inspect the database after the rollback case to prove zero users were created.

### Task 6: Editable Import Interface

**Files:**
- Create: `components/student-import-preview.tsx`
- Create: `app/admin/student-import/page.tsx`
- Create: `tests/student-import-preview.test.tsx`

- [ ] **Step 1: Write failing component tests** for upload, all-sheet statistics, paginated editable rows, masked password fields, temporary reveal, automatic gender, per-row errors, dirty state, row validation, validate-all, expired drafts, and disabled commit until zero errors.
- [ ] **Step 2: Verify RED** with `npx.cmd vitest run tests/student-import-preview.test.tsx`.
- [ ] **Step 3: Implement upload and preview UI** using existing Card/Button/Badge patterns and a dedicated table wide enough for all editable student fields.
- [ ] **Step 4: Persist edits through row APIs** instead of editing only client state; after every edit, mark the row pending validation and refresh server counts.
- [ ] **Step 5: Implement commit confirmation** summarizing active, disabled, long-term, and default-validity counts.
- [ ] **Step 6: Warn before leaving** when a preview batch has uncommitted edits; do not store initial passwords in localStorage, query strings, or console logs.
- [ ] **Step 7: Verify GREEN** with the focused component test and `npx.cmd tsc --noEmit`.

### Task 7: Safe Result Export and History

**Files:**
- Create: `app/api/v1/admin/student-imports/route.ts`
- Create: `app/api/v1/admin/student-imports/[id]/export/route.ts`
- Create: `components/student-import-history.tsx`
- Extend: `app/admin/student-import/page.tsx`
- Extend: `tests/integration/student-import-workflows.test.ts`

- [ ] **Step 1: Write failing tests** for history listing, committed counts, no password recovery, export without ID/phone/password, and formula-injection escaping for text beginning with `=`, `+`, `-`, or `@`.
- [ ] **Step 2: Verify RED** with focused integration tests.
- [ ] **Step 3: Implement history API/UI** for current and committed batches with batch ID, file, operator, time, status, row counts, long-term count, disabled count, and validity summary.
- [ ] **Step 4: Implement export** containing username, name, school, grade, gender, enabled, long-term, validity, and result only. Prefix dangerous cell text with an apostrophe.
- [ ] **Step 5: Verify GREEN** with focused tests.

### Task 8: End-to-End Import Flow

**Files:**
- Modify: `tests/e2e/production-flows.spec.ts`

- [ ] **Step 1: Create a temporary multi-sheet workbook** with at least one invalid ID, duplicate username, disabled grade, weak password, custom validity, and long-term row.
- [ ] **Step 2: Add E2E actions**: admin upload → edit failing fields in page → validate all → commit → verify success/history/export.
- [ ] **Step 3: Log in as an imported student** and prove first login redirects to password change, then enters `/student` after changing it.
- [ ] **Step 4: Prove ordinary teacher denial** from the import page and APIs.
- [ ] **Step 5: Run `npm.cmd run test:e2e`** with configured MySQL and student-data keys.

### Task 9: Import Verification

- [ ] Run `npm.cmd run db:generate` and `npx.cmd prisma format`.
- [ ] Run `npx.cmd vitest run tests/student-import.test.ts tests/student-import-preview.test.tsx`.
- [ ] Run `npm.cmd run test:integration -- --run tests/integration/student-import-workflows.test.ts`.
- [ ] Run `npm.cmd test`, `npm.cmd run test:integration`, `npm.cmd run lint`, and `npm.cmd run build`.
- [ ] Run `git diff --check` and inspect that no plaintext password, ID, phone, ciphertext, or HMAC was logged or exported.
