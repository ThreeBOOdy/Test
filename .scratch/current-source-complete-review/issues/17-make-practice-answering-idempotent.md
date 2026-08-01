# 17 — 交付普通答题幂等闭环

**What to build:** 学生因网络重试重复提交同一道题的相同答案时获得原结果且不会重复累计；若尝试用不同答案覆盖已接受答案，系统明确拒绝。

**Blocked by:** 16 — 限制唯一进行中练习并支持放弃。

**Status:** completed

- [x] 答题请求携带稳定幂等键或等价唯一请求标识，并持久关联到接受的答案。
- [x] 相同请求和相同答案的重试返回原有判题结果，不新增答案、错题、进度或统计记录。
- [x] 相同题目已接受答案后提交不同答案不会覆盖原记录，并返回明确冲突响应。
- [x] 并发相同请求只结算一次，并发不同答案最多接受一个且结果可确定。
- [x] 普通练习仍可按设计即时返回对错，但不显示尚未建设的题目解析或误导性占位文案。
- [x] 幂等重试、不同答案冲突和并发提交有数据库集成测试覆盖。

**验收证据（2026-08-01）：**
- 测试：tests/practice-engine.test.ts（幂等重试/并发）、tests/integration/production-foundation.test.ts；提交 1c5c02e。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
