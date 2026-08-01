# 19 — 交付服务端考试草稿与断网恢复

**What to build:** 模拟考试的答案草稿和当前位置实时保存在服务器，学生关闭或刷新浏览器后可继续；网络延迟产生的旧请求不能覆盖较新的草稿。

**Blocked by:** 15 — 交付选项随机化与判题规则；16 — 限制唯一进行中练习并支持放弃；17 — 交付普通答题幂等闭环。

**Status:** completed

- [x] 考试草稿持久保存每题答案、当前题号、版本和更新时间，并关联到唯一考试会话。
- [x] 学生选择或修改答案后触发服务端保存，客户端可对暂时失败执行安全自动重试。
- [x] 保存请求必须携带草稿版本，旧版本写入不改变数据并返回 `409`。
- [x] 刷新、关闭浏览器、重新登录或短暂断网后，学生可恢复服务器上的最新答案和位置。
- [x] 草稿接口在考试结算或放弃后拒绝进一步写入，且考试期间不返回正确答案或判题结果。
- [x] 并发保存、乱序响应、断网重试和恢复流程均有 API 与端到端测试。

**验收证据（2026-08-01）：**
- 测试：tests/practice-draft-route.test.ts、tests/e2e/production-flows.spec.ts（断网恢复）；提交 e2d3dbd。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
