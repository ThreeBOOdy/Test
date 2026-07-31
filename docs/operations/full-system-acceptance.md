# 全系统验收

`npm.cmd run acceptance` 是发布前的统一验收入口。它按固定顺序执行 Prisma 校验、ESLint、领域/API/UI 测试、隔离 MySQL 集成测试、生产构建、Playwright E2E 和可选的隔离恢复演练，并在 `docs/operations/full-system-acceptance-report.md` 写入结果。

## 安全前置

集成和 E2E 测试会清理并重建测试数据，验收脚本拒绝使用普通开发库。必须显式设置以下变量，且数据库名包含 `acceptance`、`ci`、`test`、`e2e` 或 `migration`：

```powershell
$env:ACCEPTANCE_DATABASE_URL = 'mysql://.../practice_acceptance'
$env:ACCEPTANCE_MIGRATION_DATABASE_URL = 'mysql://.../practice_migration'
$env:ACCEPTANCE_E2E_DATABASE_URL = 'mysql://.../practice_e2e'
npm.cmd run acceptance
```

脚本不会打印数据库 URL、密码、密钥或令牌。缺少隔离数据库时，相关检查记为 `blocked`，并记录可复现原因，不会伪装成业务失败或通过。

## 设计映射

报告逐项映射设计文档第 28 节，并保留未覆盖场景的缺口：权限、一致性、考试、安全以及数据与恢复。已有测试通过不会替代缺失场景的验证。

## 结果与责任

- `passed`：命令成功完成。
- `failed`：命令已执行但业务或测试失败，开发负责人负责修复和重跑。
- `blocked`：数据库、浏览器或恢复目标不可用，环境负责人负责准备条件后重跑；验收入口以非零退出阻止发布。

建议每次发布前执行一次；生产备份隔离恢复按 `docs/operations/data-retention.md` 和 `scripts/backup-cli.ts` 的运维周期执行，最近成功时间以报告文件和恢复演练 JSONL 日志为准。