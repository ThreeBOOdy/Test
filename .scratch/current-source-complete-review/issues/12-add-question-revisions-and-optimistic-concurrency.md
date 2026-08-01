# 12 — 建立题目修订与并发更新机制

**What to build:** 教师对公共题目、知识点和规则的修改均具备版本条件和完整历史，两个编辑者并发操作时旧版本会被明确拒绝而不是静默覆盖。

**Blocked by:** 01 — 建立单课程数据隔离边界；03 — 拆分管理员与教师页面及 API；05 — 交付教师账号完整管理闭环。

**Status:** completed

- [x] 每道题目的初始内容和后续变更形成完整 `QuestionRevision` 历史，包含操作者、时间和变更来源。
- [x] 题目、知识点和练习规则更新必须携带服务端版本或 `updatedAt` 条件。
- [x] 旧版本更新不会改变当前数据，并统一返回 `409` 和可刷新重试的错误信息。
- [x] 恢复历史修订会生成新的当前版本，不会删除或改写旧修订。
- [x] 所有成功变更与审计记录在同一事务内提交。
- [x] 并发测试覆盖题目、知识点、规则更新以及历史恢复冲突。

**验收证据（2026-08-01）：**
- 测试：tests/question-revisions.test.ts、tests/question-concurrency-routes.test.ts；提交 554e220。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
