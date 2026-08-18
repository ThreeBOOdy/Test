# 题库导入、自定义归类与知识点类型规格（第四版）

- 日期：2026-08-18（当前工作区，第四版）
- 状态：待评审
- 范围：题库导入、字母类题库归类、知识点类型字典、导入向导、练习抽题与数据模型

## 1. 背景与问题

### 1.1 现状

当前系统存在两类“写死”：

1. **字母类题库写死 A/B/C**
   - `Question.levelId` 单值外键，导入时必须填 `等级`。
   - 代码/UI 默认 `A`、`A级` 等，只能容纳三个字母类。
   - 同一道题要进多个字母类只能重复导入，与“重复题不再重复导入”冲突。

2. **知识点类型与框架写死**
   - 知识点只靠 Excel 里的“分类号”（如 `4.1.1`）自动建树，没有独立的知识点类型字典。
   - 代码里默认“二级知识点”等固定深度，`normalizeKnowledgeCode` 也只允许数字/字母/横线/下划线。
   - 多 sheet 导入时 sheet 名没有被利用为知识点类型；单 sheet 也没有向导询问类型。
   - 无法灵活地把导入内容插入已存在的知识点树，也无法自定义“几点几”框架。

### 1.2 需求方确认的模型

1. **字母类题库可扩展，但不脱离字母类**：类别代码为字母串（A、B、C、K……），可继续新增，不写死为三个。
2. **导入阶段不决定字母类归类**：题目先进公共题池，导入后由老师拉取到 A/B/C/K 等字母类题库。
3. **知识点类型使用独立字典表**，可自定义、可扩展、可动态插入已有知识点树。
4. **多 sheet 导入**：每个 sheet 名作为该 sheet 题目的“知识点类型/大类”标签。
5. **单 sheet 导入**：向导同时询问“大类知识点（类型）”和“小类知识点（分类号/叶子节点）”。
6. **“几点几”框架可自定义扩展**：不写死数字、层级或命名规则。
7. **唯一标识**：有 `externalQuestionCode` 时全局唯一，重复题目不再重复导入。

## 2. 目标与非目标

### 2.1 目标

- 字母类题库可动态维护（A/B/C/K……），归类在导入后完成。
- 新增 `KnowledgePointType` 字典，支持新增/编辑/排序/停用。
- 导入向导支持：
  - 多 sheet：sheet 名自动作为知识点类型；
  - 单 sheet：询问大类（知识点类型）和小类（知识点叶子）；
  - 动态插入已存在的知识点树；
  - 大类/小类清晰划分。
- 练习抽题按题目所属字母类过滤；知识点规则按实际知识点树工作。
- 有 `externalQuestionCode` 时全局唯一；无编号时用内容指纹做疑似重复。

### 2.2 非目标

- 不改变判分规则、练习会话快照语义、权限模型。
- 导入不覆盖/修改已有题目内容；内容变更走题目编辑/修订。
- 不做多课程/多租户。
- 不新增题型；仍只支持单选/多选。

## 3. 术语

| 术语 | 含义 |
| --- | --- |
| 字母类题库 | 由字母代码标识的类题库，如 A、B、C、K；可扩展 |
| 公共题池 | 导入后尚未归入任何字母类的题目集合 |
| 归类 / 拉取 | 把公共题池中的题目关联到一个或多个字母类题库 |
| 知识点类型 / 大类 | 独立字典表 `KnowledgePointType`，例如“电工基础”“通信原理” |
| 小类知识点 | 知识点树中的末级/具体知识点，例如 `4.1.1` |
| 知识点树 | `KnowledgePoint` 的父子层级，可由分类号动态构建 |
| 分类号 | 导入表中标识知识点位置的编号/路径，如 `4.1.1`；格式可自定义 |
| 题目编号（externalQuestionCode） | 唯一业务 Key；有值时全局唯一 |
| 内容指纹 | 无题目编号时，对题干/选项/答案做规范化后的稳定字符串 |
| EXACT / CONFLICT / SUSPECT | 重复检测的三种结果 |

## 4. 目标数据模型

### 4.1 字母类：沿用 `Level`，代码限定为字母串且可扩展

```prisma
model Level {
  id             String                  @id @default(cuid())
  code           String                  @unique // 字母串：A、B、C、K、AA ...
  name           String
  sortOrder      Int                     @default(0)
  enabled        Boolean                 @default(true)
  questions      QuestionLevel[]
  practiceRule   LevelPracticeRule?
  examRule       ExamRule?
  knowledgeRules KnowledgePracticeRule[]
  sessions       PracticeSession[]
  createdAt      DateTime                @default(now())
  updatedAt      DateTime                @updatedAt

  @@index([enabled, sortOrder])
}
```

- 校验规则：`code` 建议 `^[A-Za-z]+$`（可扩展为多字母），不写死 A/B/C 三个。
- 提供类别维护接口，允许新增 K、AA 等。

### 4.2 题目与字母类关联

```prisma
model Question {
  id                   String            @id @default(cuid())
  knowledgePointId     String
  knowledgePoint       KnowledgePoint    @relation(fields: [knowledgePointId], references: [id])
  levels               QuestionLevel[]   // 字母类归类结果
  sourceBankCode       String?
  externalQuestionCode String?           @unique // 全局唯一
  stem                 String            @db.Text
  type                 QuestionType
  optionCount          Int
  correctOptionCount   Int
  selectionSpec        String
  preserveOptionOrder  Boolean           @default(false)
  options              Json
  correctOptionIds     Json
  status               QuestionStatus    @default(ACTIVE)
  version              Int               @default(1)
  importBatchId        String?
  // ...
}

model QuestionLevel {
  id         String   @id @default(cuid())
  questionId String
  levelId    String
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  level      Level    @relation(fields: [levelId], references: [id], onDelete: Restrict)

  @@unique([questionId, levelId])
  @@index([levelId])
}
```

### 4.3 知识点类型字典

```prisma
model KnowledgePointType {
  id          String   @id @default(cuid())
  code        String   @unique // 机器码，如 DG、TX；可自定义
  name        String   // 大类名称，如 电工基础、通信原理
  sortOrder   Int      @default(0)
  enabled     Boolean  @default(true)
  points      KnowledgePoint[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([enabled, sortOrder])
}
```

### 4.4 知识点树挂到类型下

```prisma
model KnowledgePoint {
  id          String               @id @default(cuid())
  typeId      String               // 属于哪个知识点类型/大类
  type        KnowledgePointType   @relation(fields: [typeId], references: [id])
  code        String               // 分类号，如 4.1.1；在同一类型内建议唯一
  name        String
  parentId    String?
  parent      KnowledgePoint?      @relation("KnowledgePointTree", fields: [parentId], references: [id])
  children    KnowledgePoint[]     @relation("KnowledgePointTree")
  path        String
  depth       Int
  sortOrder   Int                  @default(0)
  enabled     Boolean              @default(true)
  questions   Question[]
  rules       KnowledgePracticeRule[]
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  @@unique([typeId, code])
  @@index([parentId])
  @@index([typeId, enabled, depth])
}
```

- `KnowledgePoint.code` 不再要求全局唯一，改为**同一类型内唯一**（`@@unique([typeId, code])`）。
- `path` 可以是 `/{typeCode}/{code path}` 或仅类型内路径，按实现约定；用于查询子树。
- 分类号格式放开：不强制数字，允许字母、数字、中文等自定义片段；`normalizeKnowledgeCode` 相应放宽或改为“同一类型内唯一 + 可配置分隔符”。
- 导入时若父节点已存在，则动态插入/挂接；若不存在则自动创建；支持只导入某棵子树的一部分。

### 4.5 迁移与历史数据

- 新增 `KnowledgePointType` 表，创建默认类型（如 `DEFAULT` / `默认`）。
- 现有 `KnowledgePoint` 全部挂到默认类型下；`typeId` 必填回填。
- 新增 `QuestionLevel`，把现有 `Question.levelId` 回填为字母类关联。
- 回填前做全局题号重复预检；冲突清单人工处理后迁移。
- 删除 `Question.levelId` 旧列。

## 5. 字母类维护

- 支持新增/编辑/停用字母类，代码为字母串。
- 停用后不在归类向导/练习入口出现；已有题目关联保留。
- 接口建议：

```text
GET    /api/v1/teacher/levels
POST   /api/v1/teacher/levels
PUT    /api/v1/teacher/levels/:id
POST   /api/v1/teacher/levels/:id/disable
```

## 6. 知识点类型维护

- 支持新增/编辑/停用 `KnowledgePointType`。
- 支持在类型下维护知识点树（新增父/子节点、重命名、调整顺序、停用）。
- 接口建议：

```text
GET    /api/v1/teacher/knowledge-point-types
POST   /api/v1/teacher/knowledge-point-types
PUT    /api/v1/teacher/knowledge-point-types/:id
POST   /api/v1/teacher/knowledge-point-types/:id/disable

GET    /api/v1/teacher/knowledge-points?typeId=...
POST   /api/v1/teacher/knowledge-points      // 在大类下新增小类/父节点
PUT    /api/v1/teacher/knowledge-points/:id
```

## 7. 导入流程与向导

### 7.1 导入不再处理字母类

- Excel 移除 `等级` 列；Word 移除等级下拉。
- 导入成功后题目进入公共题池，`QuestionLevel` 为空。

### 7.2 知识点类型处理

#### 多 sheet Excel

- 每个 sheet 名作为该 sheet 的“知识点类型/大类”。
- 导入时自动查找/创建 `KnowledgePointType`（name=sheet 名，code 自动生成或由维护规则决定）。
- 行内 `分类号` 仍作为知识点路径，在该类型下动态插入/挂接到知识点树。
- 若同一 `分类号` 已存在于其它类型，由于 `@@unique([typeId, code])`，不同类型可各自存在，互不冲突。

#### 单 sheet Excel / Word

- 导入向导必须询问：
  1. **大类知识点（类型）**：选择已有 `KnowledgePointType` 或新建；
  2. **小类知识点**：输入/选择该类型下的分类号（如 `4.1.1`），或选择已有叶子节点。
- Word 当前已有“分类号/知识点名称”输入，继续保留；新增“大类/类型”选择。

### 7.3 动态插入知识点树

- `ensureKnowledgePoint` 逻辑升级为“在指定 `typeId` 下按分类号逐级 upsert”。
- 如果父节点已存在：
  - 直接挂到该父节点下；
  - 不重复创建父节点。
- 如果父节点不存在：自动创建中间节点。
- 不限制固定层级；`4.1.1`、`模块一/1.1`、`K.1` 等均可。
- 叶子节点必须没有子节点才能挂题；否则报“不是末级知识点”。

### 7.4 导入后归类向导（字母类）

- 提交导入后弹出字母类归类向导：
  - 动态列出当前启用的字母类（A/B/C/K……）；
  - 老师多选拉取本次新题；
  - 可“暂不归类，稍后处理”。
- 题目管理页也支持批量拉取/取消字母类。

### 7.5 字母类拉取的具体实现方案（保证后续省事）

**目标流程**

1. 导入提交成功 → `commit` 接口返回本次新题 ID。
2. 前端立即弹出“字母类归类向导”。
3. 老师勾选字母类 → 调用批量拉取接口 → 完成。
4. 未归类的题目在题目管理“未归类”筛选中集中处理。

**commit 响应**

```json
{
  "batchId": "batch-1",
  "inserted": 10,
  "skipped": 2,
  "questionIds": ["q1", "q2", "q3"]
}
```

实现方式：提交时 `createMany` 后按 `importBatchId` 查回新题 ID（现有代码已有类似逻辑，只需补进响应）。

**批量拉取接口**

```text
POST /api/v1/teacher/questions/levels/batch
body: { questionIds: ["q1", "q2"], levelIds: ["level-a", "level-k"] }
```

- 语义：**追加**（幂等）；重复关联自动跳过。
- 校验：题目存在且非 `ARCHIVED`；字母类存在且启用。
- 事务：`QuestionLevel.createMany({ data, skipDuplicates: true })`。
- 返回：`{ assigned: 4, skippedDuplicates: 0 }`。
- 写审计：`QUESTION_LEVEL_ASSIGN`。

**取消拉取接口**

```text
POST /api/v1/teacher/questions/:id/levels/remove
body: { levelIds: ["level-a"] }
```

需要批量时增加：

```text
POST /api/v1/teacher/questions/levels/remove
body: { questionIds: [...], levelIds: [...] }
```

**题目管理批量归类 UI**

- 列表行增加“字母类”列：显示 `A、C` 或“未归类”。
- 筛选器增加“未归类”：`levels: { none: {} }`。
- 行首复选框 + 表头“全选当前页”。
- 工具栏“批量拉取到字母类” → 弹窗动态列出字母类 → 确认。
- 单题编辑表单中“字母类”为多选 checkbox，可留空。

**省事措施**

1. 提交后立即弹出归类向导，这是最省事的入口。
2. 向导默认勾选“上次使用的字母类”（可用 localStorage 或服务端偏好保存）。
3. 题目管理默认提供“未归类”快捷筛选，方便集中处理。
4. 支持“全选当前筛选结果”，后端 `questionIds` 一次上限建议 500，超出自动分批。
5. 可提供“一键全部拉取到上次字母类”按钮。
6. 长期固定规则的老师，后续可做“导入预设”：按知识点类型自动拉取到指定字母类；本次不做，仅预留扩展点。

## 8. 归类/拉取操作

- 归类 = 创建 `QuestionLevel` 记录。
- 取消归类 = 删除对应 `QuestionLevel` 记录。
- 一道题可同时在多个字母类；也可暂时未归类。
- 接口建议：

```text
POST /api/v1/teacher/questions/:id/levels
POST /api/v1/teacher/questions/levels/batch
POST /api/v1/teacher/questions/:id/levels/remove
```

- 操作写审计日志；不影响历史快照。

## 9. 练习抽题

- 按字母类过滤：`question.levelIds.includes(input.levelId)`。
- 查询：`levels: { some: { levelId } }`。
- 移除默认 `A` 硬编码；无可用字母类时提示配置。
- `QuestionSnapshot` 保留 `levelId/levelCode` 作为“本次练习所属字母类”，由创建会话时注入。
- 知识点规则按实际 `KnowledgePoint` 树工作，不再假设固定深度（现有 `depth === 2` 的规则限制需改为“可配置叶子层级”或至少不写死数字框架）。

## 10. 领域类型与 API 变更

- `ImportQuestionRow`：删除 `levelCode`；`categoryCode` 语义变为“某类型下的小类路径”；可增加 `knowledgePointTypeCode/Name`（多 sheet 自动带出，单 sheet 由向导传入）。
- `Question`：`levelIds: string[]`；`knowledgePointId` 不变。
- `KnowledgePoint`：增加 `typeId`；`code` 在类型内唯一。
- 题目编辑 API：字母类动态多选；知识点选择按类型树展示。

## 11. 影响面清单

| 模块 | 改动 |
| --- | --- |
| `prisma/schema.prisma` | 新增 `KnowledgePointType`、`QuestionLevel`；`KnowledgePoint.typeId`；删除 `Question.levelId`；`externalQuestionCode` 全局唯一 |
| 迁移 SQL | 建表、回填默认类型、回填 `QuestionLevel`、查重、删旧列/旧约束 |
| 知识点服务 | `ensureKnowledgePoint` 支持 typeId、动态插入、放开格式 |
| 导入预览/提交 | 多 sheet 类型、单 sheet 向导参数、不再读字母类 |
| 字母类维护 | `Level` 维护 API/UI |
| 归类 API | 拉取/取消/批量 |
| 题目编辑 API/UI | 字母类多选、知识点按类型树选择 |
| 练习抽题/快照 | 按 `QuestionLevel` 过滤、移除默认 A |
| 导入向导 UI | 多 sheet 自动识别、单 sheet 问大类+小类、提交后字母类归类 |
| 测试 | 单测/集成/E2E |

## 12. 测试策略

- 字母类：可新增 K/AA；导入后未归类；拉取后对应字母类可抽题。
- 知识点类型：多 sheet 按 sheet 名建类型；单 sheet 向导指定类型；同一分类号在不同类型可共存。
- 动态插入：已存在父节点不重复创建；可插入部分子树；分类号支持非纯数字格式。
- 重复检测：全局题号 EXACT/CONFLICT；无编号 SUSPECT。
- 迁移：默认类型回填；跨类型同题号不冲突；跨字母类同题号冲突预检。

## 13. 独立可执行分片

| 分片 | 标题 | 主要内容 | 验收标准 | 依赖 |
| --- | --- | --- | --- | --- |
| S1 | 数据模型与迁移 | 新增 `KnowledgePointType`、`QuestionLevel`；`KnowledgePoint.typeId`；`Question.externalQuestionCode` 全局唯一；回填/查重脚本 | `prisma validate` 通过；迁移可执行；冲突预检脚本输出清单 | 无 |
| S2 | 字母类维护 | `Level` 维护 API/UI：新增/编辑/停用，支持 A/B/C/K 等 | 可创建 K 类并出现在列表；停用后不在向导/练习出现 | S1 |
| S3 | 知识点类型维护 | `KnowledgePointType` CRUD + 知识点树维护（大类/小类动态增删改） | 可创建类型、在类型下建树、停用类型 | S1 |
| S4 | 知识点服务升级 | `ensureKnowledgePoint` 支持 typeId、动态插入、放开分类号格式 | 单测覆盖父节点复用、部分子树插入、非数字分类号 | S1,S3 |
| S5 | 领域类型与重复检测 | `Question.levelIds`；导入去掉字母类；去重身份键全局；移除默认 A | 单测覆盖全局重复、无字母类导入、动态类别 | S1 |
| S6 | 导入解析与提交 | 多 sheet 以 sheet 名建类型；单 sheet/Word 接收向导类型参数；提交只写题目+知识点，不写字母类 | 集成测试：多 sheet 类型、单 sheet 向导、导入后未归类 | S1,S4,S5 |
| S7 | 归类 API | 拉取/取消/批量 `QuestionLevel`，审计 | API 测试：多类、批量、未归类 | S1,S5 |
| S8 | 题目编辑 API/UI | 字母类多选、知识点按类型树选择 | 组件/API 测试通过 | S1,S3,S5,S7 |
| S9 | 导入向导 UI | 多 sheet 自动识别、单 sheet 问大类+小类、提交后字母类归类向导 | 组件/E2E 测试通过 | S2,S3,S6,S7,S8 |
| S10 | 练习抽题与快照 | 按 `QuestionLevel` 过滤；启动器动态取字母类；快照注入当前字母类；规则不写死深度 | 集成测试：K 类可抽题；旧会话回归通过 | S1,S5 |
| S11 | 全量回归与文档 | 更新 README/CONTEXT/领域文档；完整单测/lint/build | 全量测试通过；文档与实现一致 | S6-S10 |

### 执行顺序建议

1. S1 先行：所有模型依赖它。
2. S2/S3/S4 可并行，均只依赖 S1。
3. S5 可在 S1 后开始；S6/S7/S10 在 S5 后并行。
4. S8/S9 依赖前面接口；S11 最后收口。

### 每个分片的完成定义

- 代码通过 `tsc --noEmit`、`eslint`、相关 vitest。
- 涉及 Prisma 的分片通过 `prisma validate` 与迁移测试。
- S5 之后不允许继续依赖 `Question.levelId` 单值字段，也不允许出现写死的 A/B/C 默认字母类。
