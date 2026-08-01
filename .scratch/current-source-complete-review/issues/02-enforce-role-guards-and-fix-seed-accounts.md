# 02 — 收紧角色守卫并修正种子账号

**What to build:** 管理员、教师和学生只能调用各自被明确授权的服务端能力，演示与测试账号的名称和角色一致，不再存在管理员兼任教师或教学角色进入管理能力的隐式通道。

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] 提供独立的管理员、教师和学生服务端守卫，并移除 `requireTeachingUser()` 等跨角色能力聚合。
- [x] 每条受保护路由和服务入口只接受其声明的单一角色，越权请求统一返回 `403`。
- [x] 种子数据使用含义明确且互不混淆的管理员、教师和学生账号。
- [x] 管理员不能调用教师教学服务，教师不能调用注册审核、账号管理或敏感数据服务。
- [x] API 权限测试覆盖三个角色的允许路径和交叉越权矩阵。

**验收证据（2026-08-01）：**
- 测试：tests/role-route-access.test.ts、tests/login-route.test.ts、tests/student-sensitive-data-route.test.ts；提交 089b32a。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
