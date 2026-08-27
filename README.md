# 波段研习 · 知练无线电题库

一套面向学校、培训机构和家庭学习场景的移动优先刷题系统。系统支持按照 **等级** 与 **树形知识点** 两种维度随机抽题，教师可以分别配置单选题、多选题数量，学生完成练习后会自动生成历史记录、正确率和错题数据。

当前版本已将生产增强、学生账号注册审核、认证更新、无线电训练 UI 与正式美术资源统一到同一主线。项目采用 Next.js 模块化单体架构，前后端、权限、业务接口和管理页面位于同一代码仓库，使用 MySQL 8.0.46 持久化数据，并提供本地与生产两套 Docker Compose 部署方案。当前版本已经完成学生自主注册、管理员审核、账号有效期、学生 Excel 批量导入、Word 题库导入（仅选择题）、真实无线电人物身份目录、练习快照、错题闭环、服务端导入批次、会话失效、登录限流、审计日志、分页、教学统计、移动端完整导航、CI 和 HTTPS 反向代理等基础能力。

2026-07-29 的源码完整审视已按目标设计全部落地：`RADIO` 单课程数据隔离、管理员与教师严格分离、数据库有状态会话、学生人物用户名与一次性激活、题目修订与公共题库只归档生命周期、模拟考试服务器计时与自动交卷、加密备份与隔离恢复演练。对应 26 张分票全部完成并通过全系统验收。

2026-08-02 新增 Word 题库导入能力（仅接受选择题，判断题/填空/简答/材料题一律报错不入库），按 6 张分票完成并验收，设计文档与 ADR 见 `docs/word-question-import-design.md` 与 `docs/adr/0001-word-import-choice-only-boundary.md`。

2026-08-13 移除单课程硬编码边界：删除 `Course` 模型与所有表的 `courseId` 列、复合外键和复合唯一键，系统回归单一领域（等级 + 知识点直接承载题库数据）。多课程/课程切换能力暂不建设，后续需要时再重新设计。
2026-08-18 完成奖项级前端动效层与正式美术资源扩展：参考 webdesignclip / reeoo 等获奖作品集语言，为首页与核心训练页面叠加扰码调谐文本、磁吸按钮、跟随光标、滚动进度、全宽跑马灯带、逐行遮罩标题、巨型描边序号、数字滚动与胶片噪点等动效；新增 `scramble-text`、`magnetic`、`cursor-glow`、`count-up` 四个交互组件与配套 CSS 基元；新增 6 张 GPT-Image2 风格库生成的正式美术资源，并接入首页 Hero、训练频道区、信号数据带、模拟考试入口与结算页。
2026-08-17 完成 AI 扩展与激励体系：模型网关（云 / Ollama）、AI 解析生成与教师审核、AI Socratic 答疑、学生周报与班级报告、专注打卡与连续记录、RPG 等级 / 每日任务 / 学习地图 / 副本 / Boss 战。
2026-08-19 完成题库导入灵活化：字母类可扩展（A/B/C/K……），导入不再直接归属字母类，题目先进公共题池；新增 `KnowledgePointType` 知识点类型字典，多 sheet 以 sheet 名建类型，单 sheet / Word 由向导选择或新建大类；练习抽题按 `QuestionLevel` 过滤，快照保留当前字母类。对应分片 S1–S11 落地，规格见 `docs/question-bank-abc-flexibility-spec.md` 与 `docs/question-bank-abc-flexibility-slices.md`。
2026-08-21 完成练习引擎与学习状态重构：学生入口收敛为顺序、随机、错题、收藏、模拟测试五种模式；新增 `StudentLevelQuestionState` FSRS 逐题学习状态、首页掌握概览、今日复习计划；教师可维护多套模拟测试蓝图并给学生分配当前字母类；练习中支持收藏 / 忽略、顺序刷题断点续做与学习 / 练习模式切换；错题与模拟考试均写入 FSRS 状态。
2026-08-22 完成 issue #26 端到端回归与 23 分片证据矩阵落盘，并修复登录在未迁移列 / 环境变量加载场景下的容错。

## 界面展示

以下截图来自当前分支的演示环境，覆盖学生端、教师端与管理员端的主要功能设计。

### 学生端

<p align="center"><img src="./public/screenshots/01-login.png" alt="登录入口" width="860" /></p>

- **登录入口**：无线电主题品牌页，登录界面不暴露演示账号；测试账号仅保留在本地种子数据中。

<p align="center"><img src="./public/screenshots/02-student-home.png" alt="学生首页" width="860" /></p>

- **学生首页**：欢迎台、当前字母类掌握概览、专注打卡、RPG 每日任务、今日复习计划、训练频道与 AI 周报。

<p align="center"><img src="./public/screenshots/03-student-launcher.png" alt="统一练习启动器" width="860" /></p>

- **统一练习启动器**：顺序训练、智能随机、错题模式、收藏列表、模拟测试五种入口统一管理。

<p align="center"><img src="./public/screenshots/04-student-practice.png" alt="练习答题页" width="860" /></p>

- **练习答题页**：题目快照、即时判题、题目导航、学习 / 练习模式切换、收藏与忽略按钮、顺序刷题断点续做。

<p align="center"><img src="./public/screenshots/05-student-wrong.png" alt="错题本" width="860" /></p>

- **错题本**：待巩固 / 已掌握分组、按知识点聚合、错误次数、随机巩固入口。

<p align="center"><img src="./public/screenshots/06-student-favorites.png" alt="收藏列表" width="860" /></p>

- **收藏列表**：练习中一键收藏，收藏题目可按知识点聚合查看并直接组卷训练。

<p align="center"><img src="./public/screenshots/07-student-focus.png" alt="专注打卡" width="860" /></p>

- **专注打卡**：设定目标时长 / 题量，完成后计入连续打卡与今日专注。

<p align="center"><img src="./public/screenshots/08-student-map.png" alt="学习地图" width="860" /></p>

- **学习地图与副本**：知识点点亮进度、薄弱节点专项练习副本。

### 教师端

<p align="center"><img src="./public/screenshots/10-teacher-dashboard.png" alt="教师控制台" width="860" /></p>

- **教师控制台**：题库库存、知识点覆盖、学生账号、近 7 日正确率与教学统计。

<p align="center"><img src="./public/screenshots/11-teacher-questions.png" alt="题库管理" width="860" /></p>

- **题库管理**：按字母类、题型、状态筛选，编辑题目、查看修订历史、新增题目。

<p align="center"><img src="./public/screenshots/12-teacher-blueprints.png" alt="模拟测试蓝图" width="860" /></p>

- **模拟测试蓝图**：为每个字母类维护多套命名蓝图，按知识点配置题量、时长与合格线。

<p align="center"><img src="./public/screenshots/13-teacher-students.png" alt="学生管理" width="860" /></p>

- **学生管理**：教师为学生设置当前字母类（A/B/C/未分配），并可一键清除错题。

<p align="center"><img src="./public/screenshots/14-teacher-import.png" alt="题库导入" width="860" /></p>

- **题库导入**：Excel / Word 多 sheet 解析、预检、批次提交与撤销，题目可归类到字母类。

<p align="center"><img src="./public/screenshots/15-teacher-reports.png" alt="教学统计" width="860" /></p>

- **教学统计**：按日期、等级、学生、知识点查看练习次数、答题量、正确率与活跃学生。

<p align="center"><img src="./public/screenshots/16-teacher-ai-explanations.png" alt="AI 解析审核" width="860" /></p>

- **AI 解析审核**：查看 / 采纳 / 拒绝 AI 生成的题目解析，审核通过后学生端可见。

### 管理员端

<p align="center"><img src="./public/screenshots/19-admin-students.png" alt="管理员学生管理" width="860" /></p>

- **管理员学生管理**：学生账号审核、有效期、启停、重置密码、敏感资料脱敏与 Excel 批量导入。

<p align="center"><img src="./public/screenshots/20-admin-registrations.png" alt="自主注册审核" width="860" /></p>

- **自主注册审核**：审核 / 拒绝 / 批量通过学生注册申请，并记录审计。

## 当前版本组成

- **生产增强**：会话版本、登录限流、审计日志、练习快照、服务端 Excel 批次、分页、教学统计、健康检查、CI、备份恢复和生产部署。
- **认证与视觉**：浏览器会话检查、登录体验、无线电主题视觉资源和统一页面风格。
- **奖项级动效层（Award Layer）**：参考获奖作品集站点动效语言，新增扰码调谐文本、磁吸按钮、跟随光标、滚动进度、全宽跑马灯带、逐行遮罩标题、巨型描边序号、数字滚动与胶片噪点；新增 `scramble-text` / `magnetic` / `cursor-glow` / `count-up` 四个交互组件，首页 Hero、训练频道区、信号数据带、模拟考试入口与结算页接入 6 张新正式美术资源。
- **训练 UI 重构**：题目导航、草稿选择状态、频谱进度、即时判题、完成摘要，以及教师移动端“更多”功能面板。
- **统一练习启动器（五模式）**：顺序训练、智能随机、错题模式、收藏列表、模拟测试统一入口，支持继续上次练习与断点续做。
- **FSRS 学习状态与今日复习**：逐题维护 `StudentLevelQuestionState`，答题按 FSRS 更新状态；首页掌握概览、今日复习计划（错题巩固 + 薄弱专项）均来自规则引擎。
- **模拟考试蓝图**：教师按字母类和知识点层级维护多套命名蓝图，配置单选/多选数量、时长与合格线；学生模拟测试按蓝图抽题。
- **收藏 / 忽略**：练习中即时收藏或忽略题目，收藏列表可直接组卷练习。
- **AI 学习教练**：模型网关（云 / Ollama）、AI 解析生成与教师审核、AI Socratic 答疑、学生周报与班级薄弱点报告、AI 今日鼓励。
- **专注与游戏化激励**：专注目标、连续打卡、RPG 等级 / XP / 每日任务、学习地图与副本、Boss 战。
- **学生账号体系**：自主注册、管理员审核、拒绝修改与重新提交、一年默认有效期、长期账号、敏感资料加密和 Excel 批量导入。
- **兼容修复**：导航配置拆出 Client Component 边界，现有视觉资源替代缺失插画，端到端测试同步新版交互文案。
- **角色边界**：管理员、教师、学生页面/API/服务层严格分离；种子账号角色修正。
- **账号与认证**：数据库有状态会话、分角色空闲与绝对时限、分角色密码策略、教师由管理员创建、学生人物用户名永久绑定、一次性激活码。
- **题库与练习**：题目修订与乐观并发、教师批次所有权、公共题库只归档、选项随机化冻结、唯一进行中练习、答题幂等、错题三刷掌握与 FSRS 状态写入。
- **题库导入与字母类归类**：按 Excel / Word 模板解析题目，支持多 sheet 以 sheet 名建立知识点类型、单 sheet / Word 向导选择大类并填写小类分类号；导入成功后题目先进公共题池，可批量拉取到 A/B/C/K…… 字母类；Word 含图题目支持解析、入库与预览。
- **人物身份目录**：120 位真实无线电贡献者目录，学生注册与激活时按页选择身份，确认后永久绑定。
- **模拟考试**：服务器计时、服务端版本化草稿、断网恢复、worker 到时自动交卷、交卷后统一展示结果，并按蓝图抽题。
- **运维与安全**：敏感数据脱敏与 5 分钟再次验证、密钥轮换、加密备份、离线副本、隔离恢复演练、分级数据保留。

## 全系统验收（2026-08-01）

当前分支已实现并验收 26 张分票（`.scratch/current-source-complete-review/issues/`），全部票据状态为 `completed`。`npm.cmd run acceptance` 在全新隔离数据库上返回退出码 0，10 项门禁全部通过：

- Prisma Schema 校验、ESLint、领域/API/UI 测试（61 个测试文件，358 通过、1 跳过）。
- `practice_ci_integration` / `practice_acceptance_e2e` 全新迁移（20 个迁移）与种子。
- MySQL 集成测试（6 个文件，58 项通过）。
- Playwright 端到端测试（3/3 通过）。
- 生产构建与 TypeScript 检查。
- 隔离恢复演练：加密备份认证解密、清单校验、数据库核验（迁移版本、关键表计数、敏感字段解密）与登录-练习-交卷 smoke 链路全部通过。

报告与记录：

- 验收报告：`docs/operations/full-system-acceptance-report.md`
- 分票清单：`.scratch/current-source-complete-review/issues/`
- 验收与阻断修复记录：`docs/operations/final-acceptance-repair-runbook.md`

重跑验收需要显式提供两套隔离数据库（集成库如 `practice_ci_integration` / `practice_acceptance_integration`，E2E 库如 `practice_ci_e2e` / `practice_acceptance_e2e`）以及恢复演练的 `BACKUP_*` 环境变量，完整步骤见 `docs/operations/final-acceptance-repair-runbook.md`。

### Word 题库导入分票（2026-08-02）

Word 题库导入（仅选择题）按 6 张分票落地（`.scratch/word-question-import/issues/`），全部状态为 `completed`：`.docx` 文本抽取层、解析器（题号/选项/答案/解析/定位）、不支持题型与材料题整块报错、预检接口按扩展名分流并透传 Word 定位、导入页 Word 整份表单与导航改名、端到端验收（上传→预检→确认导入→题库可见→撤销）。后续又完成 Word 含图导入：题目图片可解析、入库、预览与练习端渲染；公式 / 复杂多模态仍保留为后续扩展点。

## 功能概览

### 学生端

- 用户名和密码登录。
- 可从登录页自主注册，填写姓名、身份证号、学校、年级、手机号和密码。
- 自主注册后进入申请状态页，只有管理员审核通过后才能进入练习系统。
- 审核拒绝时可查看原因、修改资料并主动重新提交。
- 普通账号默认从审核日期起有效一年；长期账号不受日期限制，直到管理员关闭长期开关或停用账号。
- 按已启用的字母类（A/B/C/K……）进行综合练习。
- 按“知识点 + 等级”进行专项练习。
- 只展示教师已经配置且库存充足的练习入口。
- 单选题和多选题分开随机抽取，同一次练习不会重复出题。
- 多选题按照 `4选2`、`4选3` 等规格限制选择数量。
- 多选题必须与标准答案集合完全一致才判定正确。
- 单题提交后即时显示结果和标准答案。
- 最后一题提交后仍先展示即时判题，再由学生进入练习结果页。
- 练习题目、顺序和已提交答案持久化，刷新或退出后可以继续。
- 恢复练习时自动定位到第一道未答题。
- 查看真实累计正确率、近 7 日练习量、待巩固错题和薄弱知识点。
- 查看等级综合与知识点专项练习历史。
- 错题本支持掌握状态更新。
- 支持从待巩固错题中随机抽取最多 20 道重新练习。
- 错题必须在三个不同已结算练习会话中连续答对才标记为已掌握；同会话重复答对只计一次，中途答错会重置连续进度。
- 管理员重置密码后，下一次访问学生端会强制修改密码。
- 新版无线电训练界面支持题目导航、未提交草稿状态、即时正误反馈和训练完成摘要。
- 自主注册时从 120 位真实无线电贡献者目录（分页选择）选择独立登录用户名；人物身份确认后永久绑定，管理员不能修改。
- Excel 导入学生使用“初始密码＋一次性激活码”完成首次激活：改密＋选择人物身份，完成前不能开始练习。
- 可进行模拟考试：服务器计时、草稿实时保存、断网可恢复、到点自动交卷、交卷后统一查看结果。
- 普通练习与考试默认随机打乱选项顺序，特殊锁定题保持原顺序，同一会话内顺序冻结。
- 教师可为学生分配当前字母类（A/B/C/未分配）；未分配或停用时学生端不显示练习入口。
- 顺序刷题按当前字母类全量题目、题号递增，保存上次位置、轮次计数，支持学习 / 练习模式切换。
- 随机刷题不限题量，未做优先 → 到期复习 → 低掌握 / 收藏补强；全部掌握且间隔达标时提示阶段性完成。
- 错题模式由 `StudentLevelQuestionState` 派生，待巩固错题按收藏优先、到期时间、错误次数排序。
- 练习中可收藏 / 忽略当前题目；收藏列表支持查看与直接组卷练习。
- 首页展示当前字母类掌握概览（未做 / 待复习 / 学习中 / 已掌握）与今日复习计划。
- 支持专注打卡与连续记录、RPG 等级 / 每日任务 / XP、学习地图与副本 / Boss 战。
- 支持 AI 解析查看、AI Socratic 答疑、AI 今日鼓励与学生周报（AI 不可用时主流程不受影响）。

### 教师端

- 查看题库、知识点和近期练习概览。
- 新增和编辑题目。
- 设置字母类（可多选、可留空）、知识点、题库编号、题目编号、选项和答案。
- 自动根据有效选项和答案生成 `4选1`、`4选2` 等选项规格。
- 启用、停用或归档题目。
- 维护知识点类型字典与树形知识点，缺失的父级知识点自动补齐。
- 修改知识点名称、排序和启用状态。
- 停用父级知识点时同步停用全部后代节点。
- 查看按日期、等级、学生和知识点筛选的练习次数、实际答题量、正确率和活跃学生统计。
- 配置每个等级综合练习的单选、多选题量。
- 配置每个“知识点 + 等级”专项练习的单选、多选题量。
- 保存规则时校验实际题库库存，防止配置无法生成的练习。
- 查看题目、知识点、学生和练习的真实数据库数据。
- 题库、学生、练习历史、错题和导入批次使用服务端分页，默认每页 20 条、最大 100 条。
- 移动端底部导航保留常用教师入口，其余功能通过“更多”面板访问，避免入口被三列布局截断。
- 只能查看和管理本人创建的题库导入批次；已提交题目进入 `RADIO` 公共题库，其他教师可按权限查看和修订但不能管理原批次。
- 管理多套模拟测试蓝图：按字母类、知识点层级配置单选 / 多选数量、时长与合格线，支持复制与删除，保存时校验库存。
- 在学生管理页为每个学生设置当前字母类，并支持一键清除错题（按年级开关控制）。
- 维护年级级游戏化开关与学生自主清除错题开关，审计记录每次变更。
- 查看 AI 解析审核队列：采纳 / 拒绝 / 修改 AI 生成解析，发布后学生端可见。

### 管理员端

- 管理员只负责账号与安全管理，不承担题库、规则和教学统计等教师教学能力（管理员与教师完全分离）。
- 审核学生自主注册申请，支持通过、拒绝、填写拒绝原因和批量通过。
- 管理年级代码、名称、排序和启用状态；已被学生引用的年级不能删除。
- 查看和编辑学生姓名、身份证号、学校、年级、手机号、启停状态、有效期和长期账号开关。
- 重置学生密码；重置后的学生必须在首次登录时修改密码。
- 上传学生账号 Excel，多工作表预检后可逐行编辑全部账号字段、重新校验并原子提交。
- Excel 导入的学生账号直接生效，无需再次审核，但首次登录必须修改密码。
- 创建、启用、停用和重置教师账号；教师不能自主注册，临时密码首次登录必须修改。
- 学生敏感资料（身份证号、手机号）默认脱敏；查看原文需 5 分钟内重新验证管理员密码并记录审计。
- 重新生成学生一次性激活码；高风险操作（原文查看、改密、启停、批量审核等）均要求再次验证。

### 题库导入（Excel 与 Word）

- 上传并解析 `.xlsx` 文件。
- 上传并解析 `.docx` 文件（小鹅通 Word 批量导入模板格式），自动跳过首个题号前的模板说明文字。
- 支持 `1.`、`1、`、`（1）` 三种题号格式与题干末尾括号内答案；`[不定项选择题]`、`[不定项选项题]`、`[不定项]` 三种标注均兼容。
- 仅接受选择题：单选、多选与不定项按答案个数沿用同一判定规则；判断题、填空题、简答/论述题逐题报错，材料题整块拒绝。
- 题号只用于定位（`第 N 题`）不写入题库；解析内容识别后保留在批次行数据供追溯。
- 单 sheet / Word 导入向导选择或新建“大类知识点（类型）”，并填写“小类知识点（分类号/叶子节点）”；多 sheet 以每个 sheet 名作为知识点类型。
- 导入成功后题目先进入公共题池，不自动归属字母类；提交后可弹字母类归类向导，也可在题目管理“未归类”筛选中批量拉取。
- Word 与 Excel 共用 20MB 文件上限、5000 行上限与服务端复检。
- 支持自定义或确认表头映射。
- 支持 `AB`、`A,B`、`A、B`、`A B`、`A|B` 等答案格式。
- 自动识别有效选项数量、正确答案数量和题型。
- 校验填写的 `4选2` 等规格是否与实际数据一致。
- 使用 `MC1`、`MC2`、`MC3` 等编号进行辅助异常提示。
- 单次最多预检 5000 行，默认保留 24 小时。
- 导入前分别统计有效行、警告行和错误行，页面只展示有限预览，完整数据保存在服务器。
- 服务端再次校验后才允许正式写入数据库。
- 自动创建缺失的知识点父级目录。
- 提交接口只接收 `batchId`，客户端不能修改预检后的题目内容。
- 记录导入批次、文件名、有效行、写入行、重复行、警告行和错误行数量。
- 批内重复为阻断错误；与公共题库完全一致标记为已存在、不重复创建，内容冲突或无编号疑似重复进入人工处理，提交时重新复检，不再静默跳过。
- 支持分页查看批次问题报告和状态。
- 撤销批次时统一归档该批次已提交题目，不物理删除任何公开题目（公共题库只归档生命周期）；已撤销批次不能重复提交或撤销。

## 核心业务规则

### 等级综合练习

教师可以为每个等级配置独立题量，例如：

```text
A级：单选 40，多选 20
B级：单选 50，多选 30
C级：单选 60，多选 40
```

抽题范围为该等级下所有启用知识点中的启用题目。单选和多选分别随机抽取，不保证各知识点平均分布。

### 知识点专项练习

教师可以为每个“知识点 + 等级”组合配置题量，例如：

```text
4.1.1 + A级：单选 20，多选 10
4.1.1 + B级：单选 30，多选 15
4.1   + A级：单选 25，多选 10
```

学生选择父级知识点时，题目池包含该知识点及其全部后代节点。父级规则和子级规则相互独立，不会累加。

### 库存不足

系统不会自动降低题量，也不会从其他等级或知识点补题。当配置所需题量大于可用库存时：

- 教师保存抽题规则时会收到库存不足提示。
- 学生端不会展示库存不足的练习入口。
- 即使题库在配置后发生变化，创建练习时仍会再次校验库存。

### 练习快照

创建练习时，系统立即保存：

- 练习模式。
- 等级和知识点。
- 单选、多选题量快照。
- 实际抽取的题目 ID。
- 固定的题目顺序。
- 题干、选项、标准答案、题型、等级代码和知识点名称快照。

显示题目和服务端判题都只使用快照。因此教师后续修改规则、题干、选项、答案或题目状态，不会改变进行中的练习和历史记录。

### 模拟考试

- 计时、草稿、交卷与判题完全以服务器状态为准，客户端倒计时只作展示。
- 独立 worker 每 15 秒扫描并自动结算过期考试；主动交卷、worker 自动交卷与访问时兜底共用同一幂等事务，最多结算一次。
- 考试草稿（答案、当前题号、版本）实时保存到服务器，支持断网恢复；旧版本写入返回 `409`。
- 考试过程中任何接口不返回正确答案或判题结果；交卷后统一展示答对数量与合格/未合格。
- 未作答题按错误结算，并以“未作答”原因进入错题本；主动放弃不判分、不更新错题本、不计完成统计。
- 不限重考次数，每次重新抽题并永久独立留档；题序与选项顺序在会话内冻结。

### 错题三刷掌握

错题只有在三个不同的已结算练习会话中连续答对三次才标记为已掌握；同一会话内重复答对或请求重试最多计数一次，连续进度内任一有效答错都会重置进度。

### 选项随机化

普通题目默认将选项内容随机重排到 A–H 标签下并同步重映射标准答案，界面展示仍保持 A–H 顺序；`preserveOptionOrder` 标记的题目保持原顺序并在导入时提示题干依赖字母或位置的风险；题目与选项内容在会话创建时写入快照并冻结。

## 技术架构

```mermaid
flowchart LR
    Student[学生浏览器 / PWA] --> Next[Next.js 16 应用]
    Teacher[教师浏览器] --> Next
    Next --> Auth[Cookie + 数据库有状态会话]
    Next --> API[Route Handlers 业务接口]
    Next --> RSC[React Server Components 页面]
    API --> Service[练习 / 导入 / 知识点服务]
    RSC --> Prisma[Prisma 7]
    Service --> Prisma
    Prisma --> MySQL[(MySQL 8.0.46)]
    File[Excel / Word 题库文件] --> Import[ExcelJS / docx 解析与校验]
    Import --> API
```

### 技术栈

| 分类 | 技术 | 用途 |
| --- | --- | --- |
| 全栈框架 | Next.js 16 | 页面、服务端组件、API Route Handlers |
| 前端 | React 19、TypeScript 6 | 页面与交互组件 |
| 动效 | Three.js、CSS Keyframes、IntersectionObserver、requestAnimationFrame | 信号粒子场、扰码调谐、磁吸按钮、跟随光标与滚动数字 |
| 样式 | Tailwind CSS 4 | 响应式界面和移动端布局 |
| 数据库 | MySQL 8.0.46 | 题库、练习、答案、错题和账号数据 |
| ORM | Prisma 7、`@prisma/adapter-mariadb` | 类型安全查询、关系和迁移 |
| 身份认证 | jose、HTTP-only Cookie | 数据库有状态会话、分角色时限、服务端撤销和角色权限 |
| Excel | ExcelJS | Excel 读取、表头映射和导入预览 |
| 参数校验 | Zod 4 | API 请求和导入数据校验 |
| Word | JSZip | `.docx` 解压与正文文本抽取 |
| 图标 | Lucide React | 学生端和教师端界面图标 |
| 测试 | Vitest、Playwright | 单元、MySQL 集成和浏览器端到端测试 |
| 部署 | Docker、Docker Compose、Caddy | 应用、迁移任务、MySQL 和自动 HTTPS |

## 数据模型

| 模型 | 说明 |
| --- | --- |
| `User` | 学生、教师和管理员账号，登录用户名与真实姓名分离、密码摘要、角色、启停和强制改密 |
| `RadioPerson` | 无线电贡献人物身份目录与永久占用状态 |
| `StudentActivation` | 一次性激活码哈希、有效期、版本与使用时间 |
| `AuthSession` | 数据库有状态会话：令牌哈希、用户、角色、空闲与绝对到期、撤销时间 |
| `Level` | 可扩展字母类（A/B/C/K……）定义，练习抽题和规则按字母类过滤 |
| `KnowledgePointType` | 知识点类型字典，题目/知识点按类型组织，可新增、编辑、停用 |
| `KnowledgePoint` | 挂接到 `KnowledgePointType` 的树形知识点，使用分类号、父级 ID、路径和深度；同一类型内 `code` 唯一 |
| `QuestionLevel` | 题目与字母类的多对多关联，支持一题多类或未归类 |
| `LevelPracticeRule` | 每个字母类的综合练习题量配置 |
| `KnowledgePracticeRule` | 每个“知识点 + 字母类”的专项题量配置 |
| `Question` | 题干、选项、答案、知识点、字母类关联（`QuestionLevel`）、规格、选项顺序锁定和状态（只归档不物理删除） |
| `QuestionRevision` | 题目完整内容快照、版本号、操作者和变更来源 |
| `PracticeSession` | 学生练习、模式、题量快照和完成状态 |
| `PracticeSessionQuestion` | 练习中固定的题目顺序和完整题目快照 |
| `PracticeAnswer` | 学生提交答案、正确性和提交时间 |
| `ExamDraft` | 模拟考试服务端草稿：答案、当前题号和版本 |
| `WrongQuestion` | 学生错题次数、错误原因、三会话连续掌握进度和最近计数会话 |
| `StudentLevelQuestionState` | 每个学生 + 字母类 + 题目的 FSRS 学习状态：状态、到期时间、稳定性、难度、复习次数、错误次数、收藏 / 忽略 |
| `StudentLevelProgress` | 顺序刷题进度：上次位置、完成轮数 |
| `ExamBlueprint` | 每个字母类的多套命名模拟测试蓝图：题量、时长、合格线、默认与启用状态 |
| `ExamBlueprintItem` | 蓝图条目：按知识点固定单选 / 多选数量 |
| `ReviewPlan` | 学生每日复习 / 考前冲刺计划 |
| `ReviewCard` | 复习计划卡片：错题巩固或薄弱专项、优先级与完成状态 |
| `FocusSession` | 专注刷题会话：目标时长 / 题量、实际完成、结束时间 |
| `PlayerProfile` | 学生游戏化档案：XP、等级、称号、功能开关 |
| `PlayerLevel` | RPG 等级表：等级、称号与升级所需 XP |
| `QuestLog` | 每日任务：刷题、复习、错题清零、专注，进度与奖励 |
| `XpLog` | 经验值发放流水 |
| `ImportBatch` | Excel 导入批次和导入统计 |
| `ImportBatchRow` | 服务端保存的逐行预检内容、规范化结果和错误信息 |
| `LoginAttempt` | 登录用户名哈希、IP 哈希、成功状态和时间 |
| `SensitiveDataReauthenticationAttempt` | 管理员查看敏感原文或执行高风险操作的再次验证记录 |
| `AuditLog` | 学生、题目、知识点、规则、导入、敏感访问和高风险操作日志 |

## 项目结构

```text
app/
├── api/health/             # 存活与就绪健康检查
├── api/v1/                 # 登录、练习、导入、考试蓝图、复习、专注、RPG、AI 接口
├── change-password/        # 强制修改密码页面
├── login/                  # 登录页面
├── register/               # 学生自主注册
├── student/                # 学生首页、启动器、练习、错题、收藏、历史、专注、地图
│   ├── favorites/          # 收藏列表
│   ├── focus/              # 专注打卡
│   ├── history/            # 练习记录
│   ├── map/                # 学习地图与副本
│   ├── practice/           # 练习答题页
│   ├── practice/start/     # 统一练习启动器
│   └── wrong/              # 错题本
├── teacher/                # 教师概览、题库、知识点、规则、蓝图、导入、学生、统计、AI 审核
│   ├── ai-explanations/    # AI 解析审核
│   ├── knowledge-types/    # 知识点类型维护
│   ├── reports/            # 教学统计
│   └── students/           # 学生管理与 activeLevel 分配
└── admin/                  # 管理员账号、审核、学生、教师、年级
components/
├── training/               # 答题选项、题目导航、完成摘要、AI 答疑、Boss 战
├── visual/                 # 无线电主题背景、插画降级、频谱进度与奖项级动效组件
├── ui/                     # 基础 UI 组件
├── app-shell.tsx           # 桌面侧栏、身份信息和统一页面框架
├── mobile-navigation.tsx   # 学生底栏与教师“更多”功能面板
├── practice-runner.tsx     # 单题练习、草稿选择、即时判题、学习模式与收藏/忽略
├── review-plan-today.tsx   # 今日复习计划
├── student-mastery-overview.tsx # 当前字母类掌握概览
├── focus-session-panel.tsx # 专注打卡面板
├── rpg-panel.tsx           # RPG 等级与每日任务
├── knowledge-map-view.tsx  # 学习地图与副本
├── exam-blueprint-manager.tsx # 模拟测试蓝图管理
├── grade-gamification-settings.tsx # 年级游戏化开关
├── grade-wrong-clear-settings.tsx # 年级错题清除开关
├── ai-*                    # AI 解析审核、学生周报、班级报告、每日鼓励
├── question-manager.tsx    # 题库管理交互
├── knowledge-manager.tsx   # 知识点管理交互
├── level-manager.tsx       # 字母类维护交互
├── knowledge-point-type-manager.tsx # 知识点类型维护交互
├── rule-editor.tsx         # 抽题规则和库存校验
├── radio-person-picker.tsx # 人物身份分页选择器
├── import-preview.tsx      # Excel / Word 预检、提交和批次反馈
├── teacher-student-manager.tsx # 教师学生管理与 activeLevel 分配
└── student-manager.tsx     # 管理员学生账号管理交互
lib/
├── domain/                 # 无数据库依赖的业务规则、快照和 UI 状态
├── server/                 # 认证安全、练习、导入和知识点服务
├── client/                 # 浏览器请求封装
└── db.ts                   # Prisma 数据库客户端
prisma/
├── migrations/             # MySQL 迁移
├── schema.prisma           # 数据库模型
└── seed.ts                 # 演示账号、等级、知识点和题目数据
tests/
├── integration/            # MySQL 集成测试
├── e2e/                    # Playwright 完整业务流程
└── *.test.{ts,tsx}         # 领域规则与 React UI 单元测试
scripts/                    # MySQL 初始化、备份和恢复脚本
docker-compose.prod.yml     # 应用、迁移、数据库和 Caddy 生产编排
Caddyfile                   # HTTPS 反向代理配置
.github/workflows/ci.yml    # GitHub Actions 全量质量门禁
art-prompts/                # GPT-Image2 风格库生成的全部美术提示词
```

### 视觉与美术资产

- **动效基元**：`components/visual/` 除既有 `signal-field`（Three.js 信号粒子场）、`reveal`、`tilt-card` 等外，新增 `scramble-text`（扰码调谐文本）、`magnetic`（磁吸按钮）、`cursor-glow`（跟随光标与滚动进度）、`count-up`（数字滚动）。
- **样式层**：`app/globals.css` 的 AWARD LAYER 追加奖项级动效基元（胶片噪点、逐行遮罩标题、全宽跑马灯带、巨型描边序号、竖排装饰字、滚动提示、磁吸、跟随光标、扫描分隔线），全部尊重 `prefers-reduced-motion`。
- **正式美术资源**：`public/art/` 现有 15 张 webp；最新 6 张由 GPT-Image2 生成——`home-spectrum-observatory(.alt)`（首页 Hero）、`channels-ionosphere-banner(.alt)`（训练频道区/信号数据带）、`exam-countdown-console`（模拟考试入口）、`exam-countdown-result`（模拟考试结算页）。
- **提示词仓库**：`art-prompts/` 保存全部美术资源的 GPT-Image2 风格库提示词（模板 `illustration-art-style`），可复现或迭代生成。

### 关键调用链

```mermaid
flowchart LR
    Browser[学生或教师浏览器] --> Pages[Next.js 页面与 RSC]
    Browser --> Routes[Route Handlers]
    Pages --> Session[会话与角色校验]
    Routes --> Session
    Routes --> Domain[领域校验与抽题规则]
    Pages --> Prisma[Prisma Client]
    Routes --> Services[服务端业务服务]
    Services --> Domain
    Services --> Prisma
    Prisma --> MySQL[(MySQL 8.0.46)]
    Excel[Excel 文件] --> ExcelJS[ExcelJS 解析]
    ExcelJS --> Domain
```

### 分层职责

- `lib/domain` 不依赖数据库，负责答案标准化、题目编辑校验、知识点树、随机抽题、练习快照和题目 UI 状态。
- `lib/server` 负责数据库事务、JWT、会话版本、登录限流、审计日志、密码摘要、导入批次和业务编排。
- `app/api/v1` 负责请求解析、Zod 校验、同源检查、角色授权和 HTTP 响应。
- `app/student` 与 `app/teacher` 主要使用 React Server Components 读取数据库，交互密集区域拆为 Client Components。
- `components/training` 将练习界面拆分为答题选项、题目导航与完成摘要，便于独立测试和移动端适配。
- `components/mobile-navigation.tsx` 在教师移动端保留常用入口，并通过“更多”面板暴露全部管理功能，包括教学统计。
- 项目没有全局认证中间件；受保护页面和 API 均在服务端独立执行会话与角色校验。

## 环境要求

本机源码开发推荐使用：

- Windows 10/11、macOS 或 Linux。
- Node.js 24。
- npm 11 或兼容版本。
- Git。
- MySQL 8.0.46，可以使用本机服务或 Docker 容器。

生产服务器不需要单独安装 Node.js、npm、Prisma、MySQL 或 Caddy，只需要安装 Docker Engine 与 Docker Compose v2；这些运行环境及其版本均由镜像和 Compose 固定。

## 环境变量

复制模板：

```powershell
Copy-Item .env.example .env
```

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `mysql://practice:URL编码后的密码@127.0.0.1:3306/practice_dev` | Prisma 使用的 MySQL 地址；密码中的特殊字符必须进行 URL 编码 |
| `SHADOW_DATABASE_URL` | `mysql://practice:URL编码后的密码@127.0.0.1:3306/practice_shadow` | `prisma migrate dev` 使用的独立 shadow database |
| `APP_SEED_PASSWORD` | `123456` | 演示账号种子密码 |
| `AUTH_SECRET` | 至少 32 字符随机字符串 | JWT 签名密钥 |
| `COOKIE_SECURE` | `false` | 本地 HTTP 为 `false`，正式 HTTPS 为 `true` |
| `MYSQL_PASSWORD` | 高熵随机密码 | 生产 MySQL 应用账号密码；保持原始值，不做 URL 编码 |
| `MYSQL_ROOT_PASSWORD` | 独立高熵随机密码 | 生产 MySQL root 密码，仅用于容器初始化与健康检查 |
| `APP_BIND_IP` | `192.168.50.10` | 生产服务器固定教室内网 IPv4；缺少或不是 RFC1918 地址时拒绝启动 |
| `APP_ALLOWED_CIDRS` | `192.168.50.0/24` | 允许访问应用的私有教室网段；多个 CIDR 使用空格分隔 |

PowerShell 生成随机 `AUTH_SECRET`：

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

> `.env` 已加入 `.gitignore`，不要将真实密钥提交到 GitHub。

## Windows 本机 MySQL 开发

首次初始化：

```powershell
cd D:\Tests\Test
npm.cmd install
Copy-Item .env.example .env
```

在 MySQL Workbench 中打开 `scripts/mysql-bootstrap.sql`，将 `CHANGE_ME_PRACTICE_PASSWORD` 替换为高强度密码后执行。然后把同一密码经过 URL 编码后写入 `.env`：

```dotenv
DATABASE_URL="mysql://practice:URL编码后的密码@127.0.0.1:3306/practice_dev"
SHADOW_DATABASE_URL="mysql://practice:URL编码后的密码@127.0.0.1:3306/practice_shadow"
```

完成首次迁移和演示数据写入：

```powershell
npm.cmd exec prisma migrate deploy
npm.cmd run db:seed
```

日常启动只需要：

```powershell
cd D:\Tests\Test
Start-Service MySQL80
npm.cmd run dev
```

如果 `MySQL80` 已经运行，可以省略 `Start-Service MySQL80`。Next.js 页面和 API 后端会由同一个开发服务器启动，默认访问 `http://localhost:3000`。

拉取包含新迁移的代码后执行：

```powershell
npm.cmd exec prisma migrate deploy
```

修改 `prisma/schema.prisma` 并创建开发迁移时使用：

```powershell
npm.cmd run db:migrate -- --name your_migration_name
```

> 当前 MySQL 初始迁移为 `20260724180000_mysql_init`。旧 PostgreSQL 迁移不能应用到 MySQL；现有 PostgreSQL 开发数据应舍弃并在空 MySQL 数据库中重新迁移和 seed。

## Docker 开发模式

如果本机没有安装 MySQL，也可以让 Docker 启动开发数据库和应用：

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

访问 `http://localhost:3000`。查看状态和日志：

```powershell
docker compose ps
docker compose logs -f app
```

停止容器但保留数据库：

```powershell
docker compose down
```

删除容器及数据库卷：

```powershell
docker compose down -v
```

> `docker compose down -v` 会永久删除 Docker 中的开发数据库，只应在确认数据可丢弃时使用。Windows 本机 `MySQL80`（`3306`）与 Docker MySQL（宿主机映射 `127.0.0.1:3307`）端口不同，可以同时运行；Docker 开发数据库在宿主机上通过 `127.0.0.1:3307` 访问。

## 服务器 Docker 部署

应用容器运行只需 Docker Engine 和 Docker Compose v2，不需要在宿主机安装 MySQL、Prisma 或 Caddy。若在宿主机或 Windows 任务计划程序运行仓库内的备份 PowerShell 工具，还必须安装 Node.js 24、执行 `npm ci`，并允许该运维账号调用 Docker Compose；脚本会自动切换到项目根目录。

### 一键部署（推荐）

服务器上只需一条命令即可完成全部功能的完整部署：自动生成 `.env` 与随机密钥（MySQL 密码、`AUTH_SECRET`、学生数据加密密钥）、构建镜像，并依次启动 MySQL、Prisma 迁移、基础数据 seed（管理员账号、级别、知识点、题目）、Next.js 应用、定时结算 Worker 和 Caddy HTTPS 代理，最后等待健康检查通过。

Linux 服务器：

```bash
./scripts/deploy-prod.sh 192.168.50.10 "192.168.50.0/24"
```

Windows 服务器：

```powershell
.\scripts\deploy-prod.ps1 -ServerIp 192.168.50.10 -AllowedCidrs "192.168.50.0/24"
```

首次运行会打印管理员初始账号 `admin` 和密码（来自生成的 `APP_SEED_PASSWORD`，登录后请立即修改）。不带参数运行则只生成 `.env`，手动填写网络地址后再运行一次。之后每次运行都会用最新代码重建并完整启动。

### 手动配置方式

首次部署时复制生产代码并创建 `.env`：

```dotenv
DATABASE_URL="mysql://practice:URL编码后的MYSQL_PASSWORD@db:3306/practice"
MYSQL_PASSWORD="数据库应用账号原始密码"
MYSQL_ROOT_PASSWORD="独立的MySQL管理员密码"
AUTH_SECRET="至少32字符的随机字符串"
APP_BIND_IP="192.168.50.10"
APP_ALLOWED_CIDRS="192.168.50.0/24"
```

注意生产 `DATABASE_URL` 的主机名必须为 `db`，其中的密码需要 URL 编码；`MYSQL_PASSWORD` 保持原始值。真实 `.env` 不得提交到 GitHub。

启动或升级：

```bash
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

Compose 会自动启动 MySQL 8.0.46、执行 Prisma `migrate deploy`、执行基础数据 seed（幂等，可重复运行）、启动 Next.js 和 Caddy。Caddy 只绑定 `APP_BIND_IP`，使用内部 CA 为该 IP 提供 HTTPS，并拒绝 `APP_ALLOWED_CIDRS` 之外的来源。MySQL 不发布宿主机端口，且位于代理无法加入的内部 Docker 网络。完整部署、证书、防火墙与验收流程见 `docs/operations/lan-https-deployment.md`。

查看状态和日志：

```bash
docker compose --env-file .env -f docker-compose.prod.yml ps
docker compose --env-file .env -f docker-compose.prod.yml logs -f
```

生产环境不会自动执行演示数据 seed。仅部署演示环境时，在首次迁移成功后执行一次：

```bash
docker compose -f docker-compose.prod.yml run --rm migrate npm run db:seed
```

## 演示账号

种子数据默认创建：

| 角色 | 用户名 | 默认密码 |
| --- | --- | --- |
| 管理员 | `admin` | `123456` |
| 教师 | `teacher` | `123456` |
| 学生 | `student` | `123456` |

如果修改了 `APP_SEED_PASSWORD`，密码以环境变量为准。Seed 按等级代码和知识点分类号等业务唯一键对齐数据，可以在同一开发数据库中重复执行。

演示账号为了便于本地验收不会强制修改密码。管理员通过 Excel 导入学生或重置学生密码时，账号会被标记为“待修改密码”。

## Excel 模板

### 题库模板

推荐表头：

```text
题库编号 | 分类号 | 知识点名称 | 题目编号 | 问题 | 答案 | 选项规格 | A | B | C | D | E | F | 是否启用
```

### 字段说明

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| 题库编号 | 否 | 题目来源或题库批次编号 |
| 知识点类型 / 大类 | 否* | 多 sheet 以工作表名作为类型；单 sheet / Word 由导入向导选择或新建，不需要在表格中填写 |
| 分类号 | 是 | 例如 `4.1.1`，在该类型下用于生成知识点树 |
| 知识点名称 | 否 | 末级知识点名称，未填写时暂用分类号 |
| 题目编号 | 否 | 全局唯一业务编号，用于重复检查；可空，无编号时用内容指纹做疑似重复 |
| 问题 | 是 | 题干文本 |
| 答案 | 是 | 例如 `A`、`AC`、`A,C` |
| 选项规格 | 建议 | 例如 `4选1`、`4选2`、`5选3` |
| A～F | 至少两个 | 题目选项，必须从 A 开始连续填写 |
| 是否启用 | 否 | 未填写时默认启用 |

### 导入校验示例

```text
填写规格：4选2
有效选项：A、B、C、D
标准答案：A、C
识别结果：4选2，多选题，通过
```

以下情况会阻止导入：

- 单 sheet / Word 未选择或未新建知识点类型；多 sheet 导入时同时为整份文件指定单一知识点类型。
- 分类号为空或知识点已停用。
- 选项少于两个。
- 选项编号不连续。
- 答案包含不存在的选项。
- 答案数量与填写的选项规格不一致。
- 所有选项都被设置成正确答案。

### 学生账号模板

管理员学生账号导入推荐表头：

```text
用户名 | 姓名 | 身份证号 | 学校 | 年级 | 手机号 | 初始密码 | 启用 | 开始日期 | 结束日期 | 长期
```

字段规则：

- 用户名、身份证号和手机号必须在数据库及整个工作簿内保持唯一。
- 身份证号必须是有效的 18 位中国大陆居民身份证号，性别由证件号自动推导。
- 年级可以填写启用年级的代码或名称。
- 开始日期和结束日期使用 `YYYY-MM-DD`；两者均未填写时默认从导入日期起一年。
- `启用` 和 `长期` 支持“是/否”、`true/false`、`1/0` 等常用写法。
- 初始密码必须满足系统密码策略；提交成功后不会继续保留导入草稿中的密码密文。
- 导入账号直接进入 `ACTIVE` 状态，无需审核，但首次登录必须修改密码。

## API 概览

### 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/v1/auth/login` | 用户名密码登录 |
| `POST` | `/api/v1/auth/register` | 提交学生自主注册申请并创建受限会话 |
| `POST` | `/api/v1/auth/logout` | 清除登录 Cookie |
| `POST` | `/api/v1/auth/change-password` | 修改当前账号密码 |
| `GET` | `/api/v1/registration` | 查看学生申请状态或本人可编辑资料 |
| `PATCH` | `/api/v1/registration` | 修改待审核或被拒绝的申请资料 |
| `POST` | `/api/v1/registration/resubmit` | 被拒绝学生主动重新提交审核 |

### 学生练习

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/v1/practice-sessions` | 创建等级综合、知识点专项或最多 20 道错题巩固练习 |
| `POST` | `/api/v1/practice-sessions/:id/answers` | 提交一道题的答案 |

### 教师与管理员管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/teacher/levels` | 查询字母类（Level） |
| `POST` | `/api/v1/teacher/levels` | 新增字母类 |
| `PUT` | `/api/v1/teacher/levels/:id` | 编辑字母类 |
| `POST` | `/api/v1/teacher/levels/:id/disable` | 停用字母类 |
| `GET` | `/api/v1/teacher/knowledge-point-types` | 查询知识点类型 |
| `POST` | `/api/v1/teacher/knowledge-point-types` | 新增知识点类型 |
| `PUT` | `/api/v1/teacher/knowledge-point-types/:id` | 编辑知识点类型 |
| `POST` | `/api/v1/teacher/knowledge-point-types/:id/disable` | 停用知识点类型 |
| `GET` | `/api/v1/teacher/knowledge-points?typeId=...` | 查询指定类型下的知识点树 |
| `POST` | `/api/v1/teacher/knowledge-points` | 在类型下新增知识点 |
| `PUT` | `/api/v1/teacher/knowledge-points/:id` | 编辑、排序或停用知识点 |
| `POST` | `/api/v1/teacher/questions` | 新增题目 |
| `PUT` | `/api/v1/teacher/questions/:id` | 编辑题目和状态 |
| `PUT` | `/api/v1/teacher/practice-rules` | 保存综合或专项抽题规则 |
| `GET` | `/api/v1/admin/registrations` | 管理员查询学生注册申请 |
| `POST` | `/api/v1/admin/registrations/:id/approve` | 管理员审核通过注册申请 |
| `POST` | `/api/v1/admin/registrations/:id/reject` | 管理员填写原因并拒绝注册申请 |
| `POST` | `/api/v1/admin/registrations/bulk-approve` | 管理员批量通过待审核申请 |
| `GET` | `/api/v1/admin/students` | 管理员查询学生账号列表 |
| `GET` | `/api/v1/admin/students/:id` | 管理员读取学生完整可编辑资料 |
| `PUT` | `/api/v1/admin/students/:id` | 管理员编辑学生资料、状态和有效期 |
| `POST` | `/api/v1/admin/students/:id/reset-password` | 管理员重置学生密码 |
| `GET` | `/api/v1/admin/grades` | 管理员查询年级 |
| `POST` | `/api/v1/admin/grades` | 管理员创建年级 |
| `PUT` | `/api/v1/admin/grades/:id` | 管理员编辑年级 |

### 题库导入与学生导入

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/v1/teacher/imports/preview` | 解析 Excel / Word，保存服务端批次并返回 `batchId`、统计和分页预览 |
| `POST` | `/api/v1/teacher/imports/commit` | 接收 `{batchId}`，重新校验服务端保存的全部行并提交，返回 `inserted`、`skipped` 与 `questionIds` |
| `GET` | `/api/v1/teacher/import-batches` | 分页查询题库导入批次 |
| `GET` | `/api/v1/teacher/import-batches/:id` | 分页查询批次预检行或问题报告 |
| `POST` | `/api/v1/teacher/import-batches/:id/revert` | 撤销已提交导入批次 |
| `POST` | `/api/v1/teacher/questions/levels/batch` | 批量拉取题目到字母类（追加幂等） |
| `POST` | `/api/v1/teacher/questions/levels/remove` | 批量取消题目字母类 |
| `POST` | `/api/v1/teacher/questions/:id/levels` | 单题拉取到字母类 |
| `POST` | `/api/v1/teacher/questions/:id/levels/remove` | 单题取消字母类 |
| `POST` | `/api/v1/admin/student-imports/preview` | 管理员预检学生账号 Excel |
| `GET` | `/api/v1/admin/student-imports/:id` | 读取本人创建且未过期的学生导入草稿 |
| `PUT` | `/api/v1/admin/student-imports/:id/rows/:rowId` | 编辑学生导入行并重新执行整批校验 |
| `POST` | `/api/v1/admin/student-imports/:id/validate` | 重新校验全部学生导入行 |
| `POST` | `/api/v1/admin/student-imports/:id/commit` | 原子提交并直接启用全部学生账号 |

所有管理接口都会在服务端验证能力。管理员可以使用教师教学接口；普通教师不能访问学生审核、账号管理、年级管理或学生 Excel 导入接口。

## 质量检查

运行全部测试：

```powershell
npm.cmd test
```

运行 MySQL 集成测试：

```powershell
npm.cmd run test:integration
```

运行 Playwright 端到端测试：

先确保本地数据库已迁移并重置开发测试账号密码：

```powershell
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run db:reset-passwords
```

安装浏览器并运行测试：

```powershell
npm.cmd run test:e2e:install
npm.cmd run test:e2e
```

默认使用 Playwright 自带的 Chromium，跨平台一致。若希望使用本机已安装的 Chrome，可设置环境变量后再运行：

```powershell
$env:PLAYWRIGHT_CHANNEL="chrome"
npm.cmd run test:e2e
```

Windows 下如果 Playwright 托管的 Next dev server 不稳定，建议先手动启动：

```powershell
npm.cmd run dev -- --port 3100
```

再另开终端运行：

```powershell
$env:PLAYWRIGHT_REUSE_SERVER="true"
npm.cmd run test:e2e
```

如果仍遇到 `ERR_ADDRESS_IN_USE` 或页面 JS 未加载，建议改用生产模式服务器：

```powershell
npm.cmd run build
npm.cmd run start -- --port 3100
```

再另开终端运行：

```powershell
$env:PLAYWRIGHT_REUSE_SERVER="true"
npm.cmd run test:e2e
```

注意：3100 端口只能有一个服务占用；切换模式前先停掉旧的 dev server。

运行 ESLint：

```powershell
npm.cmd run lint
```

运行生产构建和 TypeScript 检查：

```powershell
npm.cmd run build
```

运行全系统验收（需要显式提供两套隔离数据库与恢复演练环境，见 `docs/operations/final-acceptance-repair-runbook.md`）：

```powershell
npm.cmd run acceptance
```

当前自动化测试覆盖：

- 等级综合练习精确抽题数量。
- 知识点专项范围限制。
- 同一次练习题目不重复。
- 库存不足时拒绝创建练习。
- 多选题答案集合精确判定。
- 教师修改题目后，旧练习显示和判题仍使用不可变快照。
- 练习创建、恢复、提交和完成事务。
- 会话版本递增后旧 JWT 立即失效。
- 最多随机抽取 20 道错题，答对更新掌握状态，答错累计错误次数。
- Excel 常见答案格式标准化。
- Word 解析三种题号、大小写选项、答案行与括号内答案、解析行、不定项标注与模板说明跳过。
- Word 判断题/填空题/简答题逐题报错、材料题整块拒绝、选项超限、缺分类号/大类类型与超限行数。
- 选项规格与实际答案数量校验。
- `MC2`、`MC3` 等编码冲突警告。
- 5000 行预检数据能够完整提交，并正确统计重复题。
- 导入批次问题报告分页、过期限制和安全撤销。
- 数据库唯一约束阻止并发重复题号写入。
- 教师题目编辑选项连续性校验。
- 分类号格式和空段校验。
- 学生自主注册、拒绝修改、重新提交、管理员审核和默认一年有效期。
- 管理员学生账号编辑、启停、长期账号、重置密码和会话失效。
- 学生 Excel 多工作表预检、全字段编辑、整批重复校验、原子提交和首次强制改密。
- 等级练习即时判题、刷新恢复、历史记录、错题产生、错题组卷和掌握状态更新。
- 教师移动端“更多”面板可访问全部管理入口，练习题目导航、草稿选择和完成摘要可独立渲染测试。
- Excel 预检、警告报告、101 行完整提交和撤销。
- 管理员、教师、学生角色越权矩阵统一返回 `403`。
- 数据库有状态会话的到期、撤销、退出、改密和重置失效。
- 题目修订、乐观并发 `409`、公共题库只归档与批次撤销不物理删除。
- 选项随机化与冻结、唯一进行中练习、答题幂等、错题三刷状态机。
- 模拟考试草稿版本冲突、到期自动结算、未作答与主动放弃。
- 加密备份、保留清理、离线副本与隔离恢复演练。
- 奖项级动效层：扰码调谐文本、磁吸按钮、跟随光标、滚动进度、数字滚动与首页/启动器/结算页美术接入的视觉契约。

当前版本验证基线：

- Vitest 单元、UI 与仓库规则测试：101 个测试文件（最近一次全量运行在并行高负载下 7 个文件出现 vitest worker 启动超时；已抽验 2 个文件单独重跑通过）。
- MySQL 集成测试：11 个测试文件，覆盖学生注册、导入、审核、敏感数据、题库、练习、考试与清理（需 MySQL 8.0.46，MariaDB 无法执行本项目迁移）。
- Playwright 端到端测试：5/5 通过（管理员导入并激活学生、练习断网恢复与错题三会话掌握、教师 Excel 批次预检/报告/提交/撤销、Word 题库导入闭环、含图题目渲染）。
- 奖项级视觉契约：`visual-system-contract`、`core-visual-journeys`、`radio-design-system` 等测试锁定首页/启动器/结算页的动效组件与美术接入。
- ESLint、Prisma Schema 校验和 Next.js 生产构建。
- `npm audit`：当前报告 1 个高危依赖告警；尚未执行可能引入破坏性升级的 `npm audit fix --force`。

完整发布前检查：

```powershell
npm.cmd test
npm.cmd run test:integration
npm.cmd run db:seed
npm.cmd run test:e2e
npm.cmd run lint
npm.cmd run build
npx.cmd prisma validate
npm.cmd run acceptance
npm.cmd audit
```

本机运行 `npm.cmd run test:integration` 前，确认 `.env` 中的 `DATABASE_URL` 指向由 `scripts/mysql-bootstrap.sql` 创建的 `practice_ci_integration`。该测试会清空并重建该数据库中的表，切勿指向开发或生产数据库。

GitHub Actions 使用 MySQL 8.0.46 服务容器，并为集成测试和端到端测试创建独立数据库，自动执行依赖安装、Prisma Generate、数据库迁移、Seed、单元测试、集成测试、ESLint、生产构建和 Playwright E2E。

## 数据备份与恢复

生产备份使用流式 AES-256-GCM 认证加密。`mysqldump` 的标准输出直接进入加密流，脚本不会在主机或数据库容器中生成明文 SQL 文件。每份备份包含：

- `*.backup`：加密数据库转储。
- `*.backup.manifest.json`：数据库版本、应用提交、最新 Prisma 迁移、UTC 创建时间、加密文件 SHA-256、密钥标识和恢复服务信息；清单使用独立的 `BACKUP_MANIFEST_AUTH_KEY` 执行 HMAC-SHA-256 认证。
- `logs/backup-operations.jsonl`：成功或失败结果；失败命令返回非零退出码，日志行可直接由日志采集或告警系统解析。

### 密钥准备

备份密钥必须由密钥管理系统、密码保险库或受保护的调度器注入，不得写入仓库、部署目录中的 `.env`、备份目录或日志。密钥必须是独立的 32 字节随机值，并使用 Base64 编码：

```powershell
$env:BACKUP_ENCRYPTION_KEY = <从外部密钥管理系统读取的 Base64 值>
$env:BACKUP_ENCRYPTION_KEY_ID = "production-backup-2026"
$env:BACKUP_MANIFEST_AUTH_KEY = <从外部密钥管理系统读取的另一份 Base64 值>
```

密钥保险库中必须保留可恢复副本，并由生产服务器之外的受控主体持有；不能只保存在生产服务器。轮换备份加密密钥时保留旧密钥及其 `BACKUP_ENCRYPTION_KEY_ID`，直到对应备份全部过期；恢复旧备份时注入对应旧密钥。`BACKUP_MANIFEST_AUTH_KEY` 是独立且稳定的清单认证密钥，应覆盖完整保留窗口并按单独计划轮换，因此新旧加密密钥生成的清单可以共存和统一清理。

### 创建、保留与离线复制

```powershell
.\scripts\backup.ps1 -BackupDirectory E:\PracticeBackups -OfflineDirectory F:\PracticeOffline
```

默认保留最近 `14` 个日层级、`8` 个周层级和 `12` 个月层级。层级选择以清单内的 UTC `createdAt` 为准；清理前会解析真实路径并拒绝删除备份根目录之外（包括通过符号链接跳出目录）的目标。可单独执行清理：

```powershell
.\scripts\backup-retention.ps1 -BackupDirectory E:\PracticeBackups -Daily 14 -Weekly 8 -Monthly 12
```

离线介质不应长期挂载在生产服务器上。介质临时挂载后，可复制指定备份；脚本会在复制前校验源 SHA-256，并在复制后再次计算目标 SHA-256。同名代际已存在时脚本拒绝覆盖，防止旧清单与新文件错配：

```powershell
.\scripts\backup-offline-copy.ps1 `
  -ManifestFile E:\PracticeBackups\practice-YYYYMMDDTHHMMSSZ.backup.manifest.json `
  -BackupDirectory E:\PracticeBackups `
  -OfflineDirectory F:\PracticeOffline
```

Windows 任务计划程序或其他调度器应每日运行 `backup.ps1`，保留其非零退出码，并采集 `logs/backup-operations.jsonl`。若离线介质并非每天挂载，可省略 `-OfflineDirectory`，并在介质接入窗口单独运行离线复制脚本。

### 临时数据清理

Windows 任务计划程序还应每天运行 `.\scripts\data-retention.ps1`，保留 JSON 输出和非零退出码。该任务会分别清理过期会话、激活凭据、学生和题库导入预检，以及已结算考试草稿；每个类别都会写入成功或失败审计，单类失败不会阻断其他类别或下次重试。具体保留期限、审计字段和禁止清理的永久数据见 `docs/operations/data-retention.md`。

### 恢复

恢复前确认目标数据库可以被覆盖，并先在隔离环境执行。`restore.ps1` 和 `restore-drill.ps1` 共用相同的隔离目标保护与演练记录，不能在普通部署上执行恢复。恢复脚本先验证清单 HMAC、SHA-256 和 AES-GCM 认证标签，将认证完成的明文暂存在数据库容器的受限内存文件系统 `/dev/shm`，并预留至少加密文件大小加 16 MiB 的可用空间，然后才停止应用并导入 MySQL；恢复结束即删除暂存文件，不会把明文写入持久存储。可通过 `BACKUP_RESTORE_TMP_DIRECTORY` 指定其他受保护的容器内临时文件系统：

```powershell
.\scripts\restore.ps1 `
  -ManifestFile E:\PracticeBackups\practice-YYYYMMDDTHHMMSSZ.backup.manifest.json `
  -BackupDirectory E:\PracticeBackups
```

恢复成功还要求清单迁移版本与数据库一致、关键表计数合理、至少存在一个可登录账号、至少存在一个启用的等级，并在存在学生敏感字段时完成 AES-GCM 解密抽样。导入或数据库核验失败时应用保持停止，等待人工处置。

恢复演练必须在隔离环境设置 `BACKUP_RESTORE_BASE_URL`、`BACKUP_RESTORE_SMOKE_USERNAME` 和 `BACKUP_RESTORE_SMOKE_PASSWORD`；可用 `BACKUP_RESTORE_SMOKE_LEVEL_CODE` 指定等级，默认 `A`。脚本重启应用后会强制完成就绪检查、真实学生登录、创建一轮练习并提交第一道题的答案，任一步失败均返回非零退出且不会记录为恢复成功。冒烟学生应为专用测试账号，凭据由外部密码保险库注入，不得写入仓库或日志。

部署目录没有 Git 元数据时，调度器必须注入 `APP_COMMIT`。也可通过 `BACKUP_DIRECTORY`、`BACKUP_OFFLINE_DIRECTORY`、`BACKUP_LOG_FILE`、`BACKUP_RETENTION_DAILY`、`BACKUP_RETENTION_WEEKLY` 和 `BACKUP_RETENTION_MONTHLY` 设置默认值。

至少每月在隔离环境执行恢复演练，核对清单中的迁移版本、关键表数量、敏感字段解密抽样以及登录和练习核心链路，并将演练时间、备份文件、耗时和结果写入运维记录。加密文件生成成功不等于已经验证可恢复。

### 自动化隔离恢复演练

使用 `restore-drill.ps1` 执行演练。该命令只接受明确标识为隔离环境的目标：运行前必须由受控调度器注入 `BACKUP_RESTORE_ISOLATED=true`、`BACKUP_RESTORE_ENVIRONMENT=isolated` 和唯一的 `BACKUP_RESTORE_TARGET_ID`；`-IsolationRoot` 必须是隔离部署目录，`-ComposeFile` 必须位于该目录中，`-ComposeProject` 与 `-DatabaseName` 都必须含有 `restore`、`drill` 或 `isolated` 标识。任何一项不符都会在启动容器、停止应用或导入数据库之前失败。

```powershell
$env:BACKUP_RESTORE_ISOLATED = "true"
$env:BACKUP_RESTORE_ENVIRONMENT = "isolated"
$env:BACKUP_RESTORE_TARGET_ID = "monthly-restore-drill-01"
.\scripts\restore-drill.ps1 `
  -ManifestFile E:\PracticeBackups\practice-YYYYMMDDTHHMMSSZ.backup.manifest.json `
  -BackupDirectory E:\PracticeBackups `
  -IsolationRoot E:\PracticeRestoreDrill `
  -ComposeFile E:\PracticeRestoreDrill\docker-compose.restore.yml `
  -ComposeProject practice-restore-drill `
  -DatabaseName practice_restore_drill
```

演练会启动隔离编排目标，然后认证并导入备份，验证迁移版本、核心表计数、登录账号、启用等级和敏感字段解密；应用通过就绪检查后，使用专用冒烟学生真实登录、读取练习题目、开启模拟考试并提交答案完成交卷。每次执行都会将备份标识、开始/结束时间、耗时、隔离目标、校验结果、失败原因和发现的问题写入 `logs/restore-drills.jsonl`（或 `BACKUP_RESTORE_DRILL_LOG_FILE`）。最近一次成功演练可由运维记录系统查询该 JSONL 中最后一条 `status=succeeded` 的记录。

平台运维负责人至少每月检查最近成功记录；演练失败时，当班运维负责隔离目标和容器日志，数据库管理员负责备份、迁移和数据核验，应用负责人负责登录或练习链路故障。失败记录不得被改写为成功；修复后使用同一份或更新备份重新演练，并保留失败记录供复盘。

## 安全说明

当前版本已经提供：

- Scrypt 密码摘要。
- 分角色密码策略：学生至少 8 位，教师和管理员至少 12 位，不强制复杂字符组合，禁止与用户名相同或已知弱口令。
- 数据库有状态会话：Cookie 只保存令牌摘要，按角色执行空闲与绝对时限，退出、改密、停用和重置后服务端立即撤销全部会话。
- HTTP-only Cookie。
- `SameSite=Lax` Cookie。
- 生产环境强制 `COOKIE_SECURE=true`。
- 管理员、教师、正式学生和注册受限学生的服务端能力校验。
- 学生账号停用、审核状态、有效期、长期账号或管理员资料更新后旧会话自动失效。
- 管理员重置密码后的强制改密。
- 身份证号和手机号严格校验、HMAC 唯一索引、AES-256-GCM 加密和脱敏展示。
- 生产启动时强制要求两把不同的 32 字节 Base64 学生数据密钥。
- 学生题目接口不会提前返回标准答案。
- 登录失败按用户名和 IP 进行 15 分钟窗口限流。
- 密码修改、密码重置和账号停用会使旧会话立即失效。
- 管理员高风险操作（查看敏感原文、重置密码、重发激活码、启停账号、批量审核等）要求 5 分钟内再次验证并记录审计。
- 敏感数据密钥带密钥 ID，支持服务器脚本分批轮换；旧密钥保留只读解密能力。
- 已提交公共题目只停用或归档，不物理删除；撤销导入批次统一归档。
- 所有写接口执行同源校验，敏感教师操作写入审计日志。
- JSON 请求体默认限制为 256 KiB，Excel 文件限制为 20 MiB，并在解析 Multipart 前检查总请求大小。
- 安全响应头包含 `X-Content-Type-Options`、`X-Frame-Options`、Referrer Policy、Permissions Policy 和 CSP。
- 生产环境不会向客户端返回数据库内部异常细节。

## 生产部署

生产环境使用独立 Compose 文件，只允许通过固定教室内网 IPv4 和 Caddy 内部 CA HTTPS 访问：

```powershell
Copy-Item .env.example .env
docker compose -f docker-compose.prod.yml up -d --build
```

### 一键部署（全流程）

Windows 服务器可一次完成环境检查、防火墙配置（可选）、密钥生成、构建启动、健康等待、根证书导出和授权端验收：

```powershell
.\scripts\deploy-lan-all.ps1 -ServerIp 192.168.50.10 -AllowedCidrs "192.168.50.0/24" -ConfigureFirewall
```

脚本串接 `deploy-prod.ps1`、`configure-lan-firewall.ps1`、`export-internal-ca.ps1` 与 `test-lan-deployment.ps1`（授权模式）。受管设备根证书安装、未授权网段/公网验收、admin 初始改密和备份计划任务仍需按 `docs/operations/lan-https-deployment.md` 人工完成。

脚本末尾会逐项提问上述人工事项并等待填写（直接回车表示未完成），确认结果写入 `test-results\lan-acceptance\deployment-checklist.json` 与 `.md` 供归档；自动化场景可加 `-SkipChecklist` 跳过提问。

生产环境必须设置完整且密码已 URL 编码的 `DATABASE_URL`、随机的 `MYSQL_PASSWORD` 与 `MYSQL_ROOT_PASSWORD`、至少 32 字符的 `AUTH_SECRET`、固定的 `APP_BIND_IP`、批准的 `APP_ALLOWED_CIDRS`，以及两个不同的学生敏感数据密钥。`APP_TIME_ZONE` 未设置时默认使用 `Asia/Taipei`。数据库不暴露宿主机端口，应用会在网络配置校验和迁移任务成功后启动。详细步骤见 `docs/operations/lan-https-deployment.md`。

`STUDENT_DATA_ENCRYPTION_KEY` 与 `STUDENT_DATA_HASH_KEY` 都必须是精确 32 个随机字节的 Base64 编码，并分别生成。可在 PowerShell 中运行以下函数两次，将两次输出分别写入 `.env`；不要将密钥打印到应用日志或提交到版本库：

```powershell
function New-StudentDataKey {
  $bytes = New-Object byte[] 32
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
    [Convert]::ToBase64String($bytes)
  } finally {
    $generator.Dispose()
  }
}

New-StudentDataKey
New-StudentDataKey
```

健康检查：

```text
/api/health/live
/api/health/ready
```

备份和恢复：

```powershell
.\scripts\backup.ps1
.\scripts\restore.ps1 `
  -ManifestFile .\backups\practice-YYYYMMDDTHHMMSSZ.backup.manifest.json `
  -BackupDirectory .\backups
```

升级步骤：

1. 执行 `scripts/backup.ps1` 并在独立环境验证备份可恢复。
2. 拉取新代码后运行 `docker compose -f docker-compose.prod.yml build`。
3. 运行 `docker compose -f docker-compose.prod.yml up -d`；迁移任务成功后应用才会启动。
4. 检查 `/api/health/live`、`/api/health/ready` 和关键登录、练习流程。

回滚步骤：

1. 若仅应用代码异常且迁移向后兼容，切回上一版本镜像并重新运行生产 Compose。
2. 若数据库迁移不兼容，使用升级前的 `.backup.manifest.json` 清单执行 `scripts/restore.ps1`，再启动上一版本镜像。
3. Prisma 生产迁移不自动执行向下迁移；任何破坏性 Schema 变更都必须先验证备份恢复。

正式公网部署后仍建议接入外部监控、集中日志、异常告警和异地备份。

## 常见问题

### 页面无法连接数据库

确认 MySQL 容器健康：

```powershell
docker compose ps
docker compose logs db
```

本地开发使用 `127.0.0.1:3306`，应用容器内部使用主机名 `db:3306`，不要混用两个地址。

### 登录返回 500 或“登录失败”

先检查数据库迁移状态：

```powershell
npx.cmd prisma migrate status
npx.cmd prisma migrate deploy
```

当前版本必须包含 `20260724180000_mysql_init`。该迁移创建完整 MySQL 数据结构；如果数据库仍保存旧 PostgreSQL 迁移记录，应新建空 MySQL 数据库后执行迁移和 seed。

### `AUTH_SECRET` 报错

`AUTH_SECRET` 必须至少 32 个字符。修改 `.env` 后需要重新创建应用容器：

```powershell
docker compose up -d --force-recreate app
```

### 端口被占用

检查 `3000`、`3306`（本机 MySQL）或 `3307`（Docker MySQL）端口：

```powershell
Get-NetTCPConnection -LocalPort 3000,3306,3307 -ErrorAction SilentlyContinue
```

### Docker Hub 无法访问

Node.js 和 Caddy 使用 AWS Public ECR，MySQL 8.0.46 使用 Docker Official Image：

```text
public.ecr.aws/docker/library/node:24-alpine
mysql:8.0.46
```

如果网络无法访问 Docker Hub，需要在可联网环境预先拉取并导入 `mysql:8.0.46`，或将 Compose 中的 MySQL 镜像替换为组织内部镜像仓库地址。

## 当前限制与后续规划

- 增加知识点分类号重命名和批量调整。
- 增加题库 Excel 导出和学生导入历史导出。
- 增加更复杂的题库批量编辑和批量状态维护。
- 继续优化超大规模题库下的索引、查询计划和后台任务队列。
- 增加更细粒度的掌握度复习策略（当前为 FSRS + 规则引擎今日复习）。
- 增加学生薄弱知识点趋势和报表导出。
- AI 解析、教师审核、学生查看和 AI 答疑已可用；后续可继续扩展模型网关与批量生成。
- Word 公式 / 复杂多模态导入暂不支持，图片导入已支持。
- 增加班级模型与按班级限定教师数据范围（当前设计明确不建设）。
- 多课程与课程切换能力暂不建设，后续需要时再重新设计课程隔离与切换界面。

## GitHub

仓库地址：`https://github.com/ThreeBOOdy/Test`

当前统一主线：`main`；本轮分票实现与验收位于 `codex/unified-practice-and-multisheet-import` 分支（已推送）。Word 题库导入 6 张分票与验收结果也已落盘在该分支的 `.scratch/word-question-import/issues/`。

CI 为集成测试与端到端测试使用独立 MySQL 数据库，并在端到端测试前单独执行迁移和演示数据写入，避免测试数据互相污染。

提交代码前建议执行完整质量门禁：

```powershell
npm.cmd test
npm.cmd run test:integration
npm.cmd run test:e2e
npm.cmd run lint
npm.cmd run build
npx.cmd prisma validate
npm.cmd audit
```
