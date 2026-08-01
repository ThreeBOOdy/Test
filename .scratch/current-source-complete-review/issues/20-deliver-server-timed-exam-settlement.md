# 20 — 交付服务器计时和自动交卷

**What to build:** 模拟考试完全以服务器时间为准，独立 worker 自动结算过期考试；主动交卷、访问时兜底和自动交卷共享同一幂等事务，并在交卷后统一展示结果。

**Blocked by:** 17 — 交付普通答题幂等闭环；18 — 实现错题三刷连续掌握；19 — 交付服务端考试草稿与断网恢复。

**Status:** completed

- [x] 考试创建时由服务器写入开始和到期时间，客户端倒计时只作展示且不能延长考试。
- [x] 独立 worker 每 15 秒扫描过期考试，并在重启后补交尚未结算的过期会话。
- [x] 主动交卷、worker 自动交卷和访问过期会话时的兜底结算调用同一个幂等事务，最多结算一次。
- [x] 未作答题按错误计入答对题数判定，并以“未作答”原因进入错题本。
- [x] 考试期间任何接口都不返回正确答案或判题结果；交卷后才统一展示答对数量及合格/未合格。
- [x] 考试不限重考次数，每次重新抽题且永久独立留档；题目和选项顺序在会话内冻结。
- [x] 主动放弃考试不批改、不更新错题本、不泄露答案且不计完成统计。
- [x] worker 重启、并发交卷、到期边界和未作答结算均有集成与端到端测试。

**验收证据（2026-08-01）：**
- 测试：tests/exam-rules.test.ts、tests/practice-draft-route.test.ts；脚本 scripts/exam-settlement-worker.ts；提交 a7a6f9c。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
