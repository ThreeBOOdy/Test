# 11 — 保护敏感资料并支持密钥轮换

**What to build:** 管理员日常只能看到身份证号和手机号的脱敏值；确需查看原文时必须在短时重新验证窗口内操作并留下审计，运维可在不提供 Web 入口的情况下轮换加密密钥。

**Blocked by:** 04 — 切换数据库有状态会话与密码策略；05 — 交付教师账号完整管理闭环；10 — 完善管理员学生账号管理。

**Status:** completed

- [x] 学生列表、详情和搜索结果默认只返回身份证号及手机号的脱敏表示，教师永远不能读取原文。
- [x] 管理员修改敏感字段时无需先读取原文，提交的新值在应用层加密后保存。
- [x] 查看敏感原文要求管理员在最近 5 分钟内重新验证密码，超时或会话变化后必须再次验证。
- [x] 每次原文查看均记录操作者、目标、字段、时间、来源和结果，审计失败时不返回原文。
- [x] 密文携带密钥 ID，旧密钥只保留解密能力，新写入始终使用当前密钥。
- [x] 提供仅服务器可执行的密钥轮换脚本，支持分批、幂等、失败恢复和轮换审计，不增加 Web 功能。
- [x] 测试证明数据库、API 响应和日志中不会出现未授权的敏感原文。

**验收证据（2026-08-01）：**
- 测试：tests/student-sensitive-data.test.ts、tests/student-sensitive-data-route.test.ts；脚本 scripts/rotate-student-data-keys.ts、scripts/security-maintenance.ts；提交 5259bfc。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
