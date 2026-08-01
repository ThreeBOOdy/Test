# 16 — 限制唯一进行中练习并支持放弃

**What to build:** 每名学生在同一时间只能拥有一个进行中练习；尝试开始新练习时必须继续或主动放弃旧练习，放弃记录永久保留但不计入完成统计。

**Blocked by:** 01 — 建立单课程数据隔离边界；15 — 交付选项随机化与判题规则。

**Status:** completed

- [x] 数据库约束或等价事务机制保证每名学生最多一个 `IN_PROGRESS` 练习会话。
- [x] 开始新练习时如存在进行中会话，API 返回可继续或放弃的状态而不是创建第二个会话。
- [x] 两个并发创建请求最多产生一个进行中会话，失败请求可安全获取已创建会话。
- [x] 学生可主动放弃普通练习，系统记录 `abandonedAt` 和操作来源并释放唯一进行中约束。
- [x] 放弃会话保留答案和快照，但不批改未答题、不计完成次数或正确率。
- [x] 创建、继续、并发创建和放弃行为均有领域、API 与页面测试。

**验收证据（2026-08-01）：**
- 测试：tests/practice-engine.test.ts、tests/practice-runner.test.tsx；提交 1c5c02e 及练习链路提交。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
