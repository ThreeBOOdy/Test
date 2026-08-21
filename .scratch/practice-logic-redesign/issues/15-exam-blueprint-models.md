# 15 — ExamBlueprint/Item 数据模型 + 默认蓝图迁移

**What to build:** 新增 ExamBlueprint 与 ExamBlueprintItem 模型；旧 ExamRule 数据迁移为每个字母类的默认蓝图。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] ExamBlueprint 包含 levelId/name/durationMinutes?/passingCount/enabled/isDefault
- [ ] ExamBlueprintItem 包含 blueprintId/knowledgePointId/singleCount/multipleCount
- [ ] 旧 ExamRule 迁移为默认蓝图
- [ ] Prisma validate 与迁移测试通过
