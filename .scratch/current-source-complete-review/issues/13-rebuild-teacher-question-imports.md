# 13 — 重构教师题库导入与重复识别

**What to build:** 教师可预检并提交自己的题库批次，系统明确区分完全相同、内容冲突、无编号疑似重复和批内重复，并在提交时重新验证而不静默跳过任何题目。

**Blocked by:** 01 — 建立单课程数据隔离边界；03 — 拆分管理员与教师页面及 API；05 — 交付教师账号完整管理闭环；12 — 建立题目修订与并发更新机制。

**Status:** completed

- [x] 每个题库导入批次记录创建教师和课程，教师只能查看、修改、提交或撤销本人批次。
- [x] 预检以题号及规范化内容识别完全相同和内容冲突；无题号数据进入可人工判断的疑似重复结果。
- [x] 同一批次内部重复属于阻断错误，不能依赖 `skipDuplicates` 静默跳过。
- [x] 提交时在事务内重新执行重复和版本检查，预检后发生的冲突会使提交失败而不覆盖现有题目。
- [x] 成功提交的题目进入课程公共题库，其他教师可按权限查看和修订，但不能管理原批次。
- [x] 多工作表、批次所有权、各种重复类型和提交竞态均有测试覆盖。

**验收证据（2026-08-01）：**
- 测试：tests/question-import.test.ts、tests/question-editor.test.ts、tests/e2e/production-flows.spec.ts（教师 Excel 批次）；提交 e3da552。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
