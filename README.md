# 波段研习 · 知练无线电题库

一套面向学校、培训机构和家庭学习场景的移动优先刷题系统。系统支持按照 **等级** 与 **树形知识点** 两种维度随机抽题，教师可以分别配置单选题、多选题数量，学生完成练习后会自动生成历史记录、正确率和错题数据。

当前版本已将生产增强、认证更新、无线电训练 UI 与正式美术资源统一到 `main` 主线。项目采用 Next.js 模块化单体架构，前后端、权限、业务接口和教师管理页面位于同一代码仓库，使用 MySQL 8.0.46 持久化数据，并提供本地与生产两套 Docker Compose 部署方案。当前版本已经完成练习快照、错题闭环、服务端导入批次、会话失效、登录限流、审计日志、分页、教学统计、移动端完整导航、CI 和 HTTPS 反向代理等基础能力。

## 当前版本组成

- **生产增强**：会话版本、登录限流、审计日志、练习快照、服务端 Excel 批次、分页、教学统计、健康检查、CI、备份恢复和生产部署。
- **认证与视觉**：浏览器会话检查、登录体验、无线电主题视觉资源和统一页面风格。
- **训练 UI 重构**：题目导航、草稿选择状态、频谱进度、即时判题、完成摘要，以及教师移动端“更多”功能面板。
- **兼容修复**：导航配置拆出 Client Component 边界，现有视觉资源替代缺失插画，端到端测试同步新版交互文案。

## 功能概览

### 学生端

- 用户名和密码登录。
- 按 A、B、C 等等级进行综合练习。
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
- 错题练习答对后自动标记掌握，再次答错会继续累计错误次数。
- 管理员重置密码后，下一次访问学生端会强制修改密码。
- 新版无线电训练界面支持题目导航、未提交草稿状态、即时正误反馈和训练完成摘要。

### 教师端

- 查看题库、知识点、学生和近期练习概览。
- 新增和编辑题目。
- 设置题目等级、知识点、题库编号、题目编号、选项和答案。
- 自动根据有效选项和答案生成 `4选1`、`4选2` 等选项规格。
- 启用、停用或归档题目。
- 创建树形知识点，缺失的父级知识点自动补齐。
- 修改知识点名称、排序和启用状态。
- 停用父级知识点时同步停用全部后代节点。
- 创建学生账号、修改学生姓名、停用账号。
- 为学生生成一次性临时密码。
- 查看按日期、等级、学生和知识点筛选的练习次数、实际答题量、正确率和活跃学生统计。
- 配置每个等级综合练习的单选、多选题量。
- 配置每个“知识点 + 等级”专项练习的单选、多选题量。
- 保存规则时校验实际题库库存，防止配置无法生成的练习。
- 查看题目、知识点、学生和练习的真实数据库数据。
- 题库、学生、练习历史、错题和导入批次使用服务端分页，默认每页 20 条、最大 100 条。
- 移动端底部导航保留常用教师入口，其余功能通过“更多”面板访问，避免入口被三列布局截断。

### Excel 题库导入

- 上传并解析 `.xlsx` 文件。
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
- 相同等级下题目编号重复时跳过重复题目。
- 支持分页查看批次问题报告和状态。
- 撤销批次时删除未被练习引用的题目，已被引用的题目改为 `ARCHIVED`；已撤销批次不能重复提交或撤销。

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

## 技术架构

```mermaid
flowchart LR
    Student[学生浏览器 / PWA] --> Next[Next.js 16 应用]
    Teacher[教师浏览器] --> Next
    Next --> Auth[Cookie + JWT 权限层]
    Next --> API[Route Handlers 业务接口]
    Next --> RSC[React Server Components 页面]
    API --> Service[练习 / 导入 / 知识点服务]
    RSC --> Prisma[Prisma 7]
    Service --> Prisma
    Prisma --> MySQL[(MySQL 8.0.46)]
    Excel[Excel 题库文件] --> Import[ExcelJS 解析与校验]
    Import --> API
```

### 技术栈

| 分类 | 技术 | 用途 |
| --- | --- | --- |
| 全栈框架 | Next.js 16 | 页面、服务端组件、API Route Handlers |
| 前端 | React 19、TypeScript 6 | 页面与交互组件 |
| 样式 | Tailwind CSS 4 | 响应式界面和移动端布局 |
| 数据库 | MySQL 8.0.46 | 题库、练习、答案、错题和账号数据 |
| ORM | Prisma 7、`@prisma/adapter-mariadb` | 类型安全查询、关系和迁移 |
| 身份认证 | jose、HTTP-only Cookie | HS256 JWT、会话版本和角色权限 |
| Excel | ExcelJS | Excel 读取、表头映射和导入预览 |
| 参数校验 | Zod 4 | API 请求和导入数据校验 |
| 图标 | Lucide React | 学生端和教师端界面图标 |
| 测试 | Vitest、Playwright | 单元、MySQL 集成和浏览器端到端测试 |
| 部署 | Docker、Docker Compose、Caddy | 应用、迁移任务、MySQL 和自动 HTTPS |

## 数据模型

| 模型 | 说明 |
| --- | --- |
| `User` | 学生和教师账号、密码摘要、角色、启用、强制改密和会话版本 |
| `Level` | A、B、C 等等级定义 |
| `KnowledgePoint` | 使用分类号、父级 ID、路径和深度组成的树形知识点 |
| `LevelPracticeRule` | 每个等级的综合练习题量配置 |
| `KnowledgePracticeRule` | 每个“知识点 + 等级”的专项题量配置 |
| `Question` | 题干、选项、答案、等级、知识点、规格和状态 |
| `PracticeSession` | 学生练习、模式、题量快照和完成状态 |
| `PracticeSessionQuestion` | 练习中固定的题目顺序和完整题目快照 |
| `PracticeAnswer` | 学生提交答案、正确性和提交时间 |
| `WrongQuestion` | 学生错题次数、掌握状态和最近错误时间 |
| `ImportBatch` | Excel 导入批次和导入统计 |
| `ImportBatchRow` | 服务端保存的逐行预检内容、规范化结果和错误信息 |
| `LoginAttempt` | 登录用户名哈希、IP 哈希、成功状态和时间 |
| `AuditLog` | 学生、题目、知识点、规则和导入等管理操作日志 |

## 项目结构

```text
app/
├── api/health/             # 存活与就绪健康检查
├── api/v1/                 # 登录、练习、导入和教师管理接口
├── change-password/        # 强制修改密码页面
├── login/                  # 登录页面
├── student/                # 学生首页、练习、历史和错题本
└── teacher/                # 教师概览、题库、知识点、规则、导入、学生和统计
components/
├── training/               # 答题选项、题目导航和完成摘要
├── visual/                 # 无线电主题背景、插画降级和频谱进度
├── ui/                     # 基础 UI 组件
├── app-shell.tsx           # 桌面侧栏、身份信息和统一页面框架
├── mobile-navigation.tsx   # 学生底栏与教师“更多”功能面板
├── practice-runner.tsx     # 单题练习、草稿选择、即时判题与恢复
├── question-manager.tsx    # 题库管理交互
├── knowledge-manager.tsx   # 知识点管理交互
├── rule-editor.tsx         # 抽题规则和库存校验
├── import-preview.tsx      # Excel 预检、提交和批次反馈
└── student-manager.tsx     # 学生账号管理交互
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
```

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
| `APP_SEED_PASSWORD` | `ChangeMe123!` | 演示账号种子密码 |
| `AUTH_SECRET` | 至少 32 字符随机字符串 | JWT 签名密钥 |
| `COOKIE_SECURE` | `false` | 本地 HTTP 为 `false`，正式 HTTPS 为 `true` |
| `MYSQL_PASSWORD` | 高熵随机密码 | 生产 MySQL 应用账号密码；保持原始值，不做 URL 编码 |
| `MYSQL_ROOT_PASSWORD` | 独立高熵随机密码 | 生产 MySQL root 密码，仅用于容器初始化与健康检查 |
| `APP_DOMAIN` | `practice.example.com` | Caddy 申请 HTTPS 证书使用的公网域名 |

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

> `docker compose down -v` 会永久删除 Docker 中的开发数据库，只应在确认数据可丢弃时使用。Windows 本机 `MySQL80` 与 Docker MySQL 都会占用 `3306`，两者不要同时启动。

## 服务器 Docker 部署

生产服务器只需安装 Docker Engine 和 Docker Compose v2，不需要安装项目依赖对应版本的 Node.js、MySQL、Prisma 或 Caddy。

首次部署时复制生产代码并创建 `.env`：

```dotenv
DATABASE_URL="mysql://practice:URL编码后的MYSQL_PASSWORD@db:3306/practice"
MYSQL_PASSWORD="数据库应用账号原始密码"
MYSQL_ROOT_PASSWORD="独立的MySQL管理员密码"
AUTH_SECRET="至少32字符的随机字符串"
APP_DOMAIN="practice.example.com"
```

注意生产 `DATABASE_URL` 的主机名必须为 `db`，其中的密码需要 URL 编码；`MYSQL_PASSWORD` 保持原始值。真实 `.env` 不得提交到 GitHub。

启动或升级：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Compose 会自动启动 MySQL 8.0.46、执行 Prisma `migrate deploy`、启动 Next.js 和 Caddy，并通过 Caddy 为 `APP_DOMAIN` 申请和续期 HTTPS 证书。MySQL 不暴露宿主机端口，正式数据保存在 `practice-mysql` Docker Volume 中。

查看状态和日志：

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

生产环境不会自动执行演示数据 seed。仅部署演示环境时，在首次迁移成功后执行一次：

```bash
docker compose -f docker-compose.prod.yml run --rm migrate npm run db:seed
```

## 演示账号

种子数据默认创建：

| 角色 | 用户名 | 默认密码 |
| --- | --- | --- |
| 教师 | `teacher` | `ChangeMe123!` |
| 学生 | `student` | `ChangeMe123!` |

如果修改了 `APP_SEED_PASSWORD`，密码以环境变量为准。Seed 按等级代码和知识点分类号等业务唯一键对齐数据，可以在同一开发数据库中重复执行。

演示账号为了便于本地验收不会强制修改密码。教师新建学生或重置学生密码时，新账号会被标记为“待修改密码”。

## Excel 模板

推荐表头：

```text
等级 | 题库编号 | 分类号 | 知识点名称 | 题目编号 | 问题 | 答案 | 选项规格 | A | B | C | D | E | F | 是否启用
```

### 字段说明

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| 等级 | 是 | 必须对应系统中已启用的等级，例如 `A` |
| 题库编号 | 否 | 题目来源或题库批次编号 |
| 分类号 | 是 | 例如 `4.1.1`，用于生成知识点树 |
| 知识点名称 | 否 | 末级知识点名称，未填写时暂用分类号 |
| 题目编号 | 否 | 相同等级内用于重复检查 |
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

- 等级为空、不存在或已停用。
- 分类号为空或知识点已停用。
- 选项少于两个。
- 选项编号不连续。
- 答案包含不存在的选项。
- 答案数量与填写的选项规格不一致。
- 所有选项都被设置成正确答案。

## API 概览

### 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/v1/auth/login` | 用户名密码登录 |
| `POST` | `/api/v1/auth/logout` | 清除登录 Cookie |
| `POST` | `/api/v1/auth/change-password` | 修改当前账号密码 |

### 学生练习

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/v1/practice-sessions` | 创建等级综合、知识点专项或最多 20 道错题巩固练习 |
| `POST` | `/api/v1/practice-sessions/:id/answers` | 提交一道题的答案 |

### 教师管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/v1/admin/questions` | 新增题目 |
| `PUT` | `/api/v1/admin/questions/:id` | 编辑题目和状态 |
| `POST` | `/api/v1/admin/knowledge-points` | 新增知识点 |
| `PUT` | `/api/v1/admin/knowledge-points/:id` | 编辑、排序或停用知识点 |
| `PUT` | `/api/v1/admin/practice-rules` | 保存综合或专项抽题规则 |
| `POST` | `/api/v1/admin/students` | 创建学生账号 |
| `PUT` | `/api/v1/admin/students/:id` | 编辑学生或重置密码 |

### Excel 导入

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/v1/imports/preview` | 解析 Excel，保存服务端批次并返回 `batchId`、统计和分页预览 |
| `POST` | `/api/v1/imports/commit` | 接收 `{batchId}`，重新校验服务端保存的全部行并提交 |
| `GET` | `/api/v1/admin/import-batches` | 分页查询导入批次 |
| `GET` | `/api/v1/admin/import-batches/:id` | 分页查询批次预检行或问题报告 |
| `POST` | `/api/v1/admin/import-batches/:id/revert` | 撤销已提交导入批次 |

所有教师管理接口都会在服务端验证当前登录用户角色，不能只依赖前端页面限制。

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

```powershell
npx playwright install chromium
npm.cmd run test:e2e
```

运行 ESLint：

```powershell
npm.cmd run lint
```

运行生产构建和 TypeScript 检查：

```powershell
npm.cmd run build
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
- 选项规格与实际答案数量校验。
- `MC2`、`MC3` 等编码冲突警告。
- 5000 行预检数据能够完整提交，并正确统计重复题。
- 导入批次问题报告分页、过期限制和安全撤销。
- 数据库唯一约束阻止并发重复题号写入。
- 教师题目编辑选项连续性校验。
- 分类号格式和空段校验。
- 教师创建学生、重置密码和学生首次强制改密。
- 等级练习即时判题、刷新恢复、历史记录、错题产生、错题组卷和掌握状态更新。
- 教师移动端“更多”面板可访问全部管理入口，练习题目导航、草稿选择和完成摘要可独立渲染测试。
- Excel 预检、警告报告、101 行完整提交和撤销。

当前版本验证基线：

- Vitest 单元、UI 与仓库规则测试：55 项，覆盖 12 个测试文件。
- MySQL 集成测试：覆盖 JSON 答案数组、长题干、练习、导入、错题和模拟考试。
- Playwright 端到端测试套件：包含 3 条完整业务流程。
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
npm.cmd audit
```

GitHub Actions 使用 MySQL 8.0.46 服务容器，并为集成测试和端到端测试创建独立数据库，自动执行依赖安装、Prisma Generate、数据库迁移、Seed、单元测试、集成测试、ESLint、生产构建和 Playwright E2E。

## 数据备份与恢复

### 备份

```powershell
.\scripts\backup.ps1
```

### 恢复

恢复前应停止应用写入，并确认目标数据库可以被覆盖：

```powershell
.\scripts\restore.ps1 -BackupFile .\backups\practice-YYYYMMDD-HHMMSS.sql
```

脚本在 MySQL 容器内使用 `mysqldump` / `mysql`，并通过 `docker compose cp` 传输 SQL 文件，避免 Windows PowerShell 文本管道造成编码损坏。

生产环境建议使用云数据库自动备份，并定期验证备份文件可以正常恢复。

## 安全说明

当前版本已经提供：

- Scrypt 密码摘要。
- 10～128 位且同时包含字母和数字的密码策略。
- HS256 JWT 会话和 `sessionVersion` 版本校验。
- HTTP-only Cookie。
- `SameSite=Lax` Cookie。
- 生产环境强制 `COOKIE_SECURE=true`。
- 学生和教师服务端角色校验。
- 停用账号后旧会话自动失效。
- 管理员重置密码后的强制改密。
- 学生题目接口不会提前返回标准答案。
- 登录失败按用户名和 IP 进行 15 分钟窗口限流。
- 密码修改、密码重置和账号停用会使旧会话立即失效。
- 所有写接口执行同源校验，敏感教师操作写入审计日志。
- JSON 请求体默认限制为 256 KiB，Excel 文件限制为 20 MiB，并在解析 Multipart 前检查总请求大小。
- 安全响应头包含 `X-Content-Type-Options`、`X-Frame-Options`、Referrer Policy、Permissions Policy 和 CSP。
- 生产环境不会向客户端返回数据库内部异常细节。

## 生产部署

生产环境使用独立 Compose 文件，并通过 Caddy 自动申请和续期 HTTPS 证书：

```powershell
Copy-Item .env.example .env
docker compose -f docker-compose.prod.yml up -d --build
```

生产环境必须设置完整且密码已 URL 编码的 `DATABASE_URL`、随机的 `MYSQL_PASSWORD` 与 `MYSQL_ROOT_PASSWORD`、至少 32 字符的 `AUTH_SECRET` 和真实 `APP_DOMAIN`。数据库不暴露宿主机端口，应用会在迁移任务成功后启动。

健康检查：

```text
/api/health/live
/api/health/ready
```

备份和恢复：

```powershell
.\scripts\backup.ps1
.\scripts\restore.ps1 -BackupFile .\backups\practice-YYYYMMDD-HHMMSS.sql
```

升级步骤：

1. 执行 `scripts/backup.ps1` 并在独立环境验证备份可恢复。
2. 拉取新代码后运行 `docker compose -f docker-compose.prod.yml build`。
3. 运行 `docker compose -f docker-compose.prod.yml up -d`；迁移任务成功后应用才会启动。
4. 检查 `/api/health/live`、`/api/health/ready` 和关键登录、练习流程。

回滚步骤：

1. 若仅应用代码异常且迁移向后兼容，切回上一版本镜像并重新运行生产 Compose。
2. 若数据库迁移不兼容，停止应用，使用升级前 `.sql` 文件执行 `scripts/restore.ps1`，再启动上一版本镜像。
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

检查 `3000` 或 `3306` 端口：

```powershell
Get-NetTCPConnection -LocalPort 3000,3306 -ErrorAction SilentlyContinue
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
- 增加题库 Excel 导出和学生批量导入。
- 增加更复杂的题库批量编辑和批量状态维护。
- 继续优化超大规模题库下的索引、查询计划和后台任务队列。
- 增加更细粒度的掌握度复习策略。
- 增加学生薄弱知识点趋势和报表导出。
- 增加 AI 解析草稿、教师审核和学生查看流程。
- 增加正式考试、限时、防作弊和试卷发布能力。

## GitHub

仓库地址：`https://github.com/ThreeBOOdy/Test`

当前统一主线：`main`。

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
