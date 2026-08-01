# 06 — 交付学生人物用户名注册流程

**What to build:** 学生使用真实姓名提交实名资料，再从无线电人物目录中选择独立登录用户名；身份确认具备并发保护，并在确认后永久绑定且不可由管理员代改。

**Blocked by:** 04 — 切换数据库有状态会话与密码策略。

**Status:** completed

- [x] `username` 与 `realName` 在模型、注册 API、审核数据和页面展示中明确分离。
- [x] 系统提供可维护的人物身份目录，至少包含稳定 ID、唯一用户名、人物资料、资源状态和可选状态。
- [x] 自主注册先收集实名资料，再进入独立人物选择页；确认前可返回更换。
- [x] 两名学生并发确认同一人物时最多一人成功，失败者得到可重新选择的明确反馈。
- [x] 已确认的人物身份在待审核、拒绝、停用或账号过期后仍不释放，用户名不可修改。
- [x] 管理员不能通过页面、API 或服务层替学生选择、替换或修改人物用户名。

**验收证据（2026-08-01）：**
- 测试：tests/student-identity.test.ts、tests/student-registration.test.ts、tests/radio-person-manager.test.tsx、tests/student-registration-form.test.tsx；提交 5af82d6。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
