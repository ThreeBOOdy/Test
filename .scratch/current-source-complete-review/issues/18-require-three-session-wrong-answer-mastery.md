# 18 — 实现错题三刷连续掌握

**What to build:** 错题只有在三个不同练习会话中连续答对三次才标记为已掌握；任何中途答错都会重置连续进度，网络重试不会虚增次数。

**Blocked by:** 16 — 限制唯一进行中练习并支持放弃；17 — 交付普通答题幂等闭环。

**Status:** completed

- [x] 普通练习答错、考试答错和考试未作答均可创建或更新错题记录，并保留错误原因。
- [x] 同一道错题只有在三个不同已结算练习会话中连续答对才进入已掌握状态。
- [x] 同一会话内重复答对或请求重试最多计数一次。
- [x] 连续进度期间任一有效答错会把连续正确次数重置，并记录最近计数会话。
- [x] 放弃且未结算的会话不会推进或重置掌握进度。
- [x] 页面展示当前连续进度、最近错误原因和掌握状态，领域测试覆盖完整状态机。

**验收证据（2026-08-01）：**
- 测试：tests/wrong-question-mastery.test.ts、tests/e2e/production-flows.spec.ts（三次独立错题会话）；提交 79acf0b。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
