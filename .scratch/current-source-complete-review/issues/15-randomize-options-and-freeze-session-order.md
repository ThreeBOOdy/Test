# 15 — 交付选项随机化与判题规则

**What to build:** 学生每次开始练习或考试时默认获得随机题目选项顺序，同一会话内顺序保持稳定；确实依赖字母或位置的特殊题可锁定顺序并在导入时得到风险提示。

**Blocked by:** 01 — 建立单课程数据隔离边界；12 — 建立题目修订与并发更新机制。

**Status:** completed

- [x] 题目支持 `preserveOptionOrder` 或等价字段，默认值使普通题随机化选项。
- [x] 练习和考试创建时把题目及选项顺序写入会话快照，刷新、重连和后续读取保持一致。
- [x] 标记为保持顺序的题目按原顺序展示，导入预检提示题干或答案依赖字母、序号或位置的风险。
- [x] 单选按稳定选项身份判定，多选必须完全匹配标准答案，不提供部分得分。
- [x] 学生界面不提示多选题应选择的选项数量。
- [x] 随机化、锁定顺序、快照冻结和多选完全匹配均有确定性测试。

**验收证据（2026-08-01）：**
- 测试：tests/answer-option.test.tsx、tests/exam-rules.test.ts、tests/practice-snapshot.test.ts；提交 b5db319。
- 验收门禁（2026-08-01）：`npm.cmd run acceptance` 在全新隔离库 practice_ci_integration/practice_ci_migration/practice_acceptance_e2e 上返回 0；lint、领域/API/UI 测试、两库全新迁移、种子、MySQL 集成测试、Playwright E2E、生产构建与 TypeScript 检查、隔离恢复演练全部 passed。
