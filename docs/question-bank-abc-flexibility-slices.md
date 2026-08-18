# 题库导入与自定义归类 — 独立执行分片（交接用）

> 新对话直接读本文件 + `docs/question-bank-abc-flexibility-spec.md`。
> 完整需求背景、数据模型、导入向导、字母类拉取细节都在规格文档里。

## 目标

把题库导入改造成：

1. 导入阶段不决定字母类（A/B/C/K……），题目先进公共题池；
2. 导入后通过“归类向导/批量拉取”把题目拉取到字母类；
3. 知识点类型独立成字典，可自定义扩展；
4. 多 sheet 用 sheet 名作为知识点类型，单 sheet/Word 由向导询问大类+小类；
5. “几点几”知识点框架可自定义，不写死；
6. 有 `externalQuestionCode` 时全局唯一，重复题不再重复导入。

## 核心模型决策

- 字母类：沿用 `Level`，`code` 为字母串（A/B/C/K……），可扩展。
- 题目-字母类：新增 `QuestionLevel` 关联表；`Question.levelId` 删除。
- 知识点类型：新增 `KnowledgePointType` 字典表；`KnowledgePoint.typeId` 必填；`@@unique([typeId, code])`。
- 重复 Key：`Question.externalQuestionCode` 全局唯一（NULL 允许多条无编号题）。
- 导入不写字母类；提交后返回 `questionIds`，前端弹归类向导。

## 分片清单

| 分片 | 标题 | 主要内容 | 验收标准 | 依赖 |
| --- | --- | --- | --- | --- |
| S1 | 数据模型与迁移 | 新增 `KnowledgePointType`、`QuestionLevel`；`KnowledgePoint.typeId`；`Question.externalQuestionCode` 全局唯一；回填/查重脚本 | `prisma validate` 通过；迁移可执行；冲突预检脚本输出清单 | 无 |
| S2 | 字母类维护 | `Level` 维护 API/UI：新增/编辑/停用，支持 A/B/C/K 等 | 可创建 K 类并出现在列表；停用后不在向导/练习出现 | S1 |
| S3 | 知识点类型维护 | `KnowledgePointType` CRUD + 知识点树维护（大类/小类动态增删改） | 可创建类型、在类型下建树、停用类型 | S1 |
| S4 | 知识点服务升级 | `ensureKnowledgePoint` 支持 typeId、动态插入、放开分类号格式 | 单测覆盖父节点复用、部分子树插入、非数字分类号 | S1,S3 |
| S5 | 领域类型与重复检测 | `Question.levelIds`；导入去掉字母类；去重身份键全局；移除默认 A | 单测覆盖全局重复、无字母类导入、动态类别 | S1 |
| S6 | 导入解析与提交 | 多 sheet 以 sheet 名建类型；单 sheet/Word 接收向导类型参数；提交只写题目+知识点，不写字母类；commit 返回 `questionIds` | 集成测试：多 sheet 类型、单 sheet 向导、导入后未归类 | S1,S4,S5 |
| S7 | 归类 API | 拉取/取消/批量 `QuestionLevel`，审计 | API 测试：多类、批量、未归类 | S1,S5 |
| S8 | 题目编辑 API/UI | 字母类多选、知识点按类型树选择 | 组件/API 测试通过 | S1,S3,S5,S7 |
| S9 | 导入向导 UI | 多 sheet 自动识别、单 sheet 问大类+小类、提交后字母类归类向导 | 组件/E2E 测试通过 | S2,S3,S6,S7,S8 |
| S10 | 练习抽题与快照 | 按 `QuestionLevel` 过滤；启动器动态取字母类；快照注入当前字母类；规则不写死深度 | 集成测试：K 类可抽题；旧会话回归通过 | S1,S5 |
| S11 | 全量回归与文档 | 更新 README/CONTEXT/领域文档；完整单测/lint/build | 全量测试通过；文档与实现一致 | S6-S10 |

## 建议执行顺序

1. S1 先行（所有模型依赖它）。
2. S2/S3/S4 可并行，只依赖 S1。
3. S5 在 S1 后开始；S6/S7/S10 在 S5 后并行。
4. S8/S9 依赖前面接口；S11 最后收口。

## 每个分片的完成定义

- 代码通过 `tsc --noEmit`、`eslint`、相关 vitest。
- 涉及 Prisma 的分片通过 `prisma validate` 与迁移测试。
- S5 之后不允许继续依赖 `Question.levelId` 单值字段，也不允许出现写死的 A/B/C 默认字母类。

## 关键文件（当前项目）

- 规格：`docs/question-bank-abc-flexibility-spec.md`
- 分片：`docs/question-bank-abc-flexibility-slices.md`（本文件）
- 当前导入逻辑：`lib/domain/question-import.ts`、`lib/server/import-service.ts`
- 当前练习逻辑：`lib/domain/practice-engine.ts`、`lib/server/practice-service.ts`
- 当前题目管理：`components/question-manager.tsx`、`app/teacher/questions/page.tsx`
- 当前导入 UI：`components/import-preview.tsx`、`app/teacher/import/page.tsx`
- 数据模型：`prisma/schema.prisma`

## 新对话开工建议

1. 先读 `docs/question-bank-abc-flexibility-spec.md` 全文。
2. 从 S1 开始：改 Prisma schema、生成迁移、写回填/查重脚本。
3. 每个分片独立提交，保持可回滚。
