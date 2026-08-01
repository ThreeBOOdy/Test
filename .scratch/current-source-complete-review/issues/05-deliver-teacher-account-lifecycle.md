# 05 — 交付教师账号完整管理闭环

**What to build:** 管理员可以安全创建、停用和重置教师账号；教师以不可变用户名和一次性临时密码开始使用系统，停用不会破坏其历史教学数据。

**Blocked by:** 02 — 收紧角色守卫并修正种子账号；04 — 切换数据库有状态会话与密码策略。

**Status:** completed

- [x] 管理员页面和 API 支持创建教师，要求填写不可变用户名和独立真实姓名。
- [x] 系统生成符合管理人员策略的随机临时密码，只在成功结果中展示一次且数据库不可恢复原文。
- [x] 教师首次登录必须修改临时密码，之后才能进入教师页面。
- [x] 管理员可停用或重置教师账号但不能物理删除；停用和重置立即撤销教师全部会话。
- [x] 停用教师后，其已提交题目、修订历史、导入批次和审计记录继续保留。
- [x] 创建、停用和重置操作与审计日志在同一事务中成功或失败。

**验收证据（2026-08-01）：**
- 测试：tests/teacher-account-route.test.ts、tests/teacher-account-service.test.ts；提交 3964d3a、feb0e11。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
