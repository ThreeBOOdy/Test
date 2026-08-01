# 01 — 建立单课程数据隔离边界

**What to build:** 系统在不增加课程选择界面的前提下，将现有题库、练习规则、题目、练习会话和历史数据统一归入 `RADIO` 课程，使所有后续教学与练习能力都具有明确且可扩展的课程边界。

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] 数据库提供唯一启用的 `RADIO` 课程，并将现有相关数据无损迁移到该课程。
- [x] 新建题目、规则、导入批次和练习会话时必须由服务端写入课程归属，客户端不能伪造其他课程。
- [x] 题库、规则、练习和历史查询均按课程过滤，缺少或错误课程归属的数据不会混入结果。
- [x] 当前页面不出现课程选择或切换入口，现有无线电练习主流程保持可用。
- [x] 领域测试和迁移测试证明课程隔离约束有效且旧数据可继续访问。

**验收证据（2026-08-01）：**
- 测试：tests/course-boundary.test.ts、tests/integration/course-migration.test.ts、tests/integration/production-foundation.test.ts；提交 0bf6207/300e6f6/5492035/c7f4298/4aaead5。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
