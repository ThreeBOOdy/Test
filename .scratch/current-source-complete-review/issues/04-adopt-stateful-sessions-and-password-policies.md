# 04 — 切换数据库有状态会话与密码策略

**What to build:** 用户登录后使用可由服务器即时撤销的数据库会话，并按角色执行不同的空闲与绝对到期时间；密码规则和首次改密要求在所有入口保持一致。

**Blocked by:** 02 — 收紧角色守卫并修正种子账号。

**Status:** completed

- [x] 会话令牌只以不可逆摘要存入数据库，浏览器使用关闭即失效且不支持“记住登录”的 Cookie。
- [x] 学生会话空闲 1 小时；教师空闲 2 小时且最长 8 小时；管理员空闲 30 分钟且最长 4 小时。
- [x] 退出、修改密码、停用账号和重置密码后，相关服务端会话立即失效。
- [x] 学生密码至少 8 位，教师和管理员密码至少 12 位，所有表单与 API 返回一致提示。
- [x] 临时密码账号首次登录只能进入改密流程，完成后才可访问角色业务页面。
- [x] 会话到期、撤销、并发请求和首次改密均有领域及 API 测试覆盖。

**验收证据（2026-08-01）：**
- 测试：tests/session-guards.test.ts、tests/session-policy.test.ts、tests/logout-route.test.ts、tests/change-password-route.test.ts、tests/auth-routing.test.ts；提交 68a9c7b。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
