# 06 — Word 导入端到端验收（Excel 不回归）

**What to build:** 教师完整走通 Word 题库导入闭环——上传、预检、确认导入、题库可见、撤销，同时现有 Excel 导入与全套验收门禁保持通过。

**Blocked by:** 05 — 导入页支持 Word 与整份表单，导航改名

**Status:** completed

- [x] Playwright 端到端覆盖：上传 Word → 预检 → 确认导入 → 题库可见 → 撤销批次。
- [x] 现有 Excel 导入端到端与 question-import 单测保持通过。
- [x] 全套验收门禁通过：lint、领域/API/UI 测试、迁移与种子、Playwright E2E、生产构建与 TypeScript 检查。

**验收证据（2026-08-02）：** Word 导入 e2e（上传-预检-导入-可见-撤销）在 practice_ci_e2e 上通过（7.6s），Excel 导入回归用例通过（9.1s）；全套单测 67 文件 415 通过、lint、tsc、生产构建通过；提交 7fd71e3、969b660。
