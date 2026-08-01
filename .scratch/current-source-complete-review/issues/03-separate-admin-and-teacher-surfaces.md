# 03 — 拆分管理员与教师页面及 API

**What to build:** 管理员只看到账号与安全管理功能，教师只看到题库、规则和统计功能；页面入口、API 命名空间、服务查询条件与写入条件形成一致的角色隔离。

**Blocked by:** 01 — 建立单课程数据隔离边界；02 — 收紧角色守卫并修正种子账号。

**Status:** completed

- [x] 教学 API 全部位于 `/api/v1/teacher/*`，管理员账号访问时返回 `403`。
- [x] 管理员 API 全部位于 `/api/v1/admin/*`，教师账号访问时返回 `403`。
- [x] `/admin/*` 不再提供题库、规则或教学统计入口，`/teacher/*` 不再提供学生注册审核和账号管理入口。
- [x] 原有错误命名空间的调用方完成迁移，不保留可绕过新边界的兼容入口。
- [x] 页面导航、直接 URL、API 请求和服务层测试均证明角色边界一致。

**验收证据（2026-08-01）：**
- 测试：tests/admin-channel-navigation.test.tsx、tests/registration-review-access.test.ts、tests/teacher-statistics-route.test.ts；提交 e02d703。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
