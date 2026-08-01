# 24 — 交付加密备份与离线副本

**What to build:** 运维可自动生成经过认证加密的数据库备份，按明确日、周、月策略安全保留，并将校验通过的副本转移到非长期挂载介质。

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] 备份在写入持久存储前使用经过认证的加密方式保护，密钥不写入仓库、日志或备份文件旁的明文配置。
- [x] 每份备份包含数据库版本、应用提交、迁移版本、创建时间、文件校验和和必要恢复元数据清单。
- [x] 自动保留按日、周、月层级和清单时间执行，删除前验证解析后的目标位于指定备份目录内。
- [x] 备份和保留清理失败会产生非零退出、持久日志和可接入告警的结果。
- [x] 离线复制完成后验证文件哈希，备份密钥不只存在于生产服务器。
- [x] 脚本测试覆盖加密输出、清单、保留选择、路径防护和失败处理。

**验收证据（2026-08-01）：**
- 测试：tests/backup-operations.test.ts；脚本 scripts/backup-cli.ts、scripts/backup-core.ts；提交 06c5fd3。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
