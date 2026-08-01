# 21 — 修正学习历史和教师统计口径

**What to build:** 学生历史和教师统计使用一致的服务端口径区分进行中、完成、自动结算和放弃记录，避免把放弃会话算作完成或继续显示为进行中。

**Blocked by:** 03 — 拆分管理员与教师页面及 API；18 — 实现错题三刷连续掌握；20 — 交付服务器计时和自动交卷。

**Status:** completed

- [x] 学生历史明确展示普通练习、模拟考试、进行中、完成、自动结算和放弃状态。
- [x] 已放弃会话不再显示为进行中，也不计入完成次数、通过次数、正确率或掌握进度统计。
- [x] 自动交卷考试与主动交卷考试使用相同完成统计口径，同时保留结算来源供审计和展示。
- [x] 模拟考试只按答对题目数量显示合格或未合格，不引入分数概念。
- [x] 教师通过 `/api/v1/teacher/*` 查看全体学生的非敏感学习统计，不能读取账号敏感资料。
- [x] 历史和报表测试使用混合状态数据验证每项统计口径。

**验收证据（2026-08-01）：**
- 测试：tests/teacher-statistics-route.test.ts、tests/practice-engine.test.ts；提交 6be1dfa。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
