# 08 — 交付学生 Excel 导入预检

**What to build:** 管理员上传学生 Excel 后可在服务端完成受限、分页且可修正的预检，清楚看到跨工作表的数据错误，而不会提前创建账号或保存可恢复的秘密。

**Blocked by:** 02 — 收紧角色守卫并修正种子账号；06 — 交付学生人物用户名注册流程。

**Status:** completed

- [x] 单次导入最多接受 10 个工作表和 200 行，超限文件在解析前后均被服务端拒绝。
- [x] 预检识别必填字段、格式、重复学生、现有账号冲突和工作表来源，并返回可定位的错误信息。
- [x] 预检结果由服务端分页，默认每页 20 条且单页最多 100 条。
- [x] 管理员可修正预检行并重新验证，未通过的批次不能提交。
- [x] 预检阶段不创建学生账号，不保存可逆初始密码，也不占用人物身份。
- [x] 多工作表、行数限制、分页、修正和冲突均有服务及 API 测试覆盖。

**验收证据（2026-08-01）：**
- 测试：tests/student-import-route.test.ts、tests/student-import-preview.test.tsx、tests/student-import.test.ts、tests/integration/student-import-workflows.test.ts；提交 d3071e6。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
