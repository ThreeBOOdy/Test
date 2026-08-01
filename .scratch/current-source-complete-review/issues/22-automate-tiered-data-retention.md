# 22 — 交付分级数据保留与每日清理

**What to build:** 系统每天按数据用途清理过期会话、激活凭据、导入预检和考试草稿等临时数据，任务可安全重试并绝不破坏永久题库、历史和审计记录。

**Blocked by:** 04 — 切换数据库有状态会话与密码策略；08 — 交付学生 Excel 导入预检；09 — 交付导入学生一次性激活流程；13 — 重构教师题库导入与重复识别；19 — 交付服务端考试草稿与断网恢复；20 — 交付服务器计时和自动交卷。

**Status:** completed

- [x] 为服务端会话、激活凭据、学生导入预检、题库预检和已结算考试草稿定义明确保留期限。
- [x] 每日清理任务按状态和到期时间选择数据，可重复运行且不会重复产生副作用。
- [x] 清理失败会记录错误并支持下次重试，单类数据失败不造成无审计的静默遗漏。
- [x] 已提交题目、题目修订、练习与考试历史、错题进度和审计日志不属于临时清理范围。
- [x] 清理前后的数量、持续时间和失败结果可供管理员或运维审计。
- [x] 使用过期与未过期混合数据的集成测试证明边界和幂等性。

**验收证据（2026-08-01）：**
- 测试：tests/data-retention.test.ts、tests/integration/data-retention.integration.test.ts；脚本 scripts/data-retention-maintenance.ts；提交 4a7701f。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
