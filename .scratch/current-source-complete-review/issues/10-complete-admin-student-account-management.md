# 10 — 完善管理员学生账号管理

**What to build:** 管理员可以通过服务端分页工作台管理学生状态、有效期和非用户名资料，同时始终看到真实姓名与人物用户名的明确区分，且无法改动永久用户名。

**Blocked by:** 05 — 交付教师账号完整管理闭环；06 — 交付学生人物用户名注册流程；07 — 重构管理员注册审核工作台；09 — 交付导入学生一次性激活流程。

**Status:** completed

- [x] 学生列表和详情采用服务端分页、搜索与状态筛选，默认每页 20 条且单页最多 100 条。
- [x] 列表同时显示真实姓名、人物用户名、来源、账号状态、有效期和激活状态，但敏感字段仅返回脱敏值。
- [x] 管理员可修改真实姓名等允许字段、设置有效期、停用账号和重置密码或激活凭据。
- [x] 页面、API 和服务层均禁止管理员修改学生 `username` 或替换人物身份。
- [x] 停用、密码重置和凭据重置立即撤销相关学生会话。
- [x] 每项重要变更与审计日志在同一事务中提交，故障时业务回滚。

**验收证据（2026-08-01）：**
- 测试：tests/student-account-route.test.ts、tests/student-manager.test.tsx、tests/student-import-route.test.ts；提交 44cba72。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
