# 03 — Excel 含图整份拒绝

**What to build:** 预检 Excel 时若工作簿包含任何图片，整份文件直接报错并提示改用 Word 模板，不产生批次；无图 Excel 行为完全不变。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 含图片的 `.xlsx` 预检返回整份错误，提示「Excel 不支持图片，请改用 Word 模板」，不创建批次。
- [ ] 无图 `.xlsx` 预检行为与现在完全一致（回归）。
- [ ] 单元/集成测试覆盖上述两种场景。

