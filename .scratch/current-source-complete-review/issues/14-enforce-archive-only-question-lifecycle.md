# 14 — 落实公共题库只归档生命周期

**What to build:** 已进入公共题库的题目只能停用、归档或以新修订恢复，撤销导入也不会物理删除题目，从而保证历史练习、考试快照和审计始终可追溯。

**Blocked by:** 12 — 建立题目修订与并发更新机制；13 — 重构教师题库导入与重复识别。

**Status:** completed

- [x] 公共题目没有物理删除路径，页面、API、服务和数据库操作统一使用停用或归档状态。
- [x] 撤销导入批次只改变批次及题目可用状态，不删除已提交题目或修订历史。
- [x] 历史练习和考试快照仍能引用已停用或归档题目并展示当时内容。
- [x] 恢复归档题目会创建新修订并执行乐观并发检查。
- [x] 停用、归档、恢复和批次撤销均与审计记录原子提交。
- [x] 回归测试证明任何公开题目生命周期操作都不会触发物理删除。

**验收证据（2026-08-01）：**
- 测试：tests/question-lifecycle.test.ts、tests/e2e/production-flows.spec.ts（撤销只归档）；提交 50b4db8。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
