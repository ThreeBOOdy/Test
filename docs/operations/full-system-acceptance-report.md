# 全系统验收报告

- 执行时间：2026-07-31T09:17:24.811Z 至 2026-07-31T09:18:56.231Z
- 主机：LAPTOP-TEP5OGIF
- Node：v24.14.1
- 工作区：D:\Tests\Test
- 规则：仅实际命令成功才记为 passed；缺少环境记为 blocked；场景缺口记为 partial。

## 执行结果

| 检查 | 状态 | 耗时 | 说明 |
| --- | --- | ---: | --- |
| Prisma schema validation | passed | 3335 ms | 完成 |
| Lint | passed | 13073 ms | 完成 |
| 领域/API/UI 测试 | passed | 42344 ms | 完成 |
| MySQL 集成测试 | blocked | 0 ms | 必须提供三套显式隔离数据库：practice_ci_integration/practice_acceptance_integration、practice_ci_migration/practice_acceptance_migration、practice_ci_e2e/practice_acceptance_e2e。 |
| Playwright 端到端测试 | blocked | 0 ms | 缺少显式隔离的 E2E 数据库连接地址。 |
| 生产构建与 TypeScript 检查 | passed | 32668 ms | 完成 |
| 隔离恢复演练 | blocked | 0 ms | 未提供完整隔离恢复目标、备份清单、敏感数据密钥和 smoke 凭据；未执行破坏性恢复操作。 |

## 设计第 28 节映射

| 章节 | 状态 | 证据 | 缺口或环境说明 |
| --- | --- | --- | --- |
| 28.1 权限验收 | verified | tests/role-route-access.test.ts；tests/registration-review-access.test.ts；tests/student-sensitive-data-route.test.ts；tests/course-boundary.test.ts | 无 |
| 28.2 一致性验收 | partial | tests/registration-review-route.test.ts；tests/question-concurrency-routes.test.ts；tests/practice-engine.test.ts；tests/practice-draft-route.test.ts | 审计故障回滚、并发建练习和所有幂等请求未被统一验收场景完整覆盖。 |
| 28.3 考试验收 | blocked | tests/exam-rules.test.ts；tests/practice-draft-route.test.ts；scripts/exam-settlement-worker.ts；tests/e2e/production-flows.spec.ts | 关闭浏览器、worker 重启补交、延迟泄题和未作答组合仍需专门验收。 |
| 28.4 安全验收 | partial | tests/backup-operations.test.ts；tests/student-sensitive-data.test.ts；tests/session-guards.test.ts；docs/operations/lan-https-acceptance.md | 生产数据库、备份、日志和受管设备证书需在目标环境检查；脚本不会打印密钥。 |
| 28.5 数据与恢复验收 | blocked | tests/data-retention.test.ts；tests/integration/data-retention.integration.test.ts；tests/backup-operations.test.ts；scripts/backup-cli.ts；scripts/restore-drill-core.ts | 未提供隔离恢复目标和密钥，未执行破坏性恢复操作。 |

## 重跑步骤

```powershell
$env:ACCEPTANCE_DATABASE_URL='mysql://.../practice_ci_integration'
$env:ACCEPTANCE_MIGRATION_DATABASE_URL='mysql://.../practice_ci_migration'
$env:ACCEPTANCE_E2E_DATABASE_URL='mysql://.../practice_ci_e2e'
npm.cmd run acceptance
```

隔离恢复还需设置 `BACKUP_ENCRYPTION_KEY`、`BACKUP_MANIFEST_AUTH_KEY`、`BACKUP_RESTORE_*`、`STUDENT_DATA_ENCRYPTION_KEY` 和 smoke 凭据；脚本不会将这些值写入报告。

## 失败处置

- `failed`：保存命令输出和测试产物，由开发负责人修复后重跑。
- `blocked`：由环境负责人准备隔离 MySQL、浏览器或恢复目标后重跑；验收入口以非零退出阻止发布。
