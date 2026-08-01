# 25 — 自动化隔离环境恢复演练

**What to build:** 运维可定期在隔离环境从加密备份恢复系统，并以自动化检查证明数据库、敏感数据、登录、题库和练习链路真正可用，而不仅是生成了备份文件。

**Blocked by:** 11 — 保护敏感资料并支持密钥轮换；20 — 交付服务器计时和自动交卷；24 — 交付加密备份与离线副本。

**Status:** completed

- [x] 恢复流程只在明确的隔离目标上运行，并在执行破坏性步骤前验证目标路径、数据库和环境标识。
- [x] 流程解密并恢复指定备份，验证数据库可启动且迁移版本与备份清单一致。
- [x] 自动检查关键表数量合理，并抽样验证带密钥 ID 的敏感字段可正确解密。
- [x] 自动运行核心登录、公共题库读取、开始练习、答题和交卷链路验证。
- [x] 每次演练记录备份标识、开始结束时间、耗时、校验结果、失败原因和发现的问题。
- [x] 文档定义演练频率、最近成功恢复时间的查看位置及失败后的处置责任。

**验收证据（2026-08-01）：**
- 脚本 scripts/backup-cli.ts、scripts/restore-drill-core.ts；日志 logs/restore-drills.jsonl；提交 707a6b6。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
