# 07 — 重构管理员注册审核工作台

**What to build:** 只有管理员能够在可分页、搜索和筛选的工作台中审核学生注册；批量审核面对任一冲突时整体失败，不会留下部分成功结果。

**Blocked by:** 02 — 收紧角色守卫并修正种子账号；05 — 交付教师账号完整管理闭环；06 — 交付学生人物用户名注册流程。

**Status:** completed

- [x] 注册审核入口仅存在于管理员页面和 `/api/v1/admin/*`，教师入口被删除且直接请求返回 `403`。
- [x] 待审核列表采用服务端分页，支持搜索和状态筛选，默认每页 20 条且单页最多 100 条。
- [x] 单项批准或拒绝会校验当前状态、人物占用和账号冲突，并记录管理员操作审计。
- [x] 批量审核在单一数据库事务中处理，任一目标冲突时所有目标保持原状。
- [x] 并发审核同一申请时只有一个结果生效，另一请求得到确定的冲突响应。
- [x] API、事务和页面测试覆盖分页、越权、冲突及全有或全无行为。

**验收证据（2026-08-01）：**
- 测试：tests/registration-review-route.test.ts、tests/registration-review-manager.test.tsx、tests/registration-status.test.tsx；提交 1dbe05d。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
