# 知练 · 分等级与知识点刷题系统

一套面向学校、培训机构和家庭学习场景的移动优先刷题系统。系统支持按照 **等级** 与 **树形知识点** 两种维度随机抽题，教师可以分别配置单选题、多选题数量，学生完成练习后会自动生成历史记录、正确率和错题数据。

当前项目采用 Next.js 模块化单体架构，前后端、权限、业务接口和教师管理页面位于同一代码仓库，使用 PostgreSQL 持久化数据，并提供 Docker Compose 本地部署方案。

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
- 练习题目、顺序和已提交答案持久化，刷新或退出后可以继续。
- 查看真实累计正确率、近 7 日练习量、待巩固错题和薄弱知识点。
- 查看等级综合与知识点专项练习历史。
- 错题本支持掌握状态更新。
- 支持从待巩固错题中随机抽取最多 20 道重新练习。
- 管理员重置密码后，下一次访问学生端会强制修改密码。

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
- 配置每个等级综合练习的单选、多选题量。
- 配置每个“知识点 + 等级”专项练习的单选、多选题量。
- 保存规则时校验实际题库库存，防止配置无法生成的练习。
- 查看题目、知识点、学生和练习的真实数据库数据。

### Excel 题库导入

- 上传并解析 `.xlsx` 文件。
- 支持自定义或确认表头映射。
- 支持 `AB`、`A,B`、`A、B`、`A B`、`A|B` 等答案格式。
- 自动识别有效选项数量、正确答案数量和题型。
- 校验填写的 `4选2` 等规格是否与实际数据一致。
- 使用 `MC1`、`MC2`、`MC3` 等编号进行辅助异常提示。
- 导入前展示正确行、警告行和错误行。
- 服务端再次校验后才允许正式写入数据库。
- 自动创建缺失的知识点父级目录。
- 记录导入批次、文件名、有效行数和警告数量。
- 相同等级下题目编号重复时跳过重复题目。
- 预检内容完整保存在服务器，支持导入批次查询和安全撤销。

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

因此教师后续修改规则或题目状态，不会改变已经创建的练习。

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
    Prisma --> PostgreSQL[(PostgreSQL 18)]
    Excel[Excel 题库文件] --> Import[ExcelJS 解析与校验]
    Import --> API
```

### 技术栈

| 分类 | 技术 | 用途 |
| --- | --- | --- |
| 全栈框架 | Next.js 16 | 页面、服务端组件、API Route Handlers |
| 前端 | React 19、TypeScript 6 | 页面与交互组件 |
| 样式 | Tailwind CSS 4 | 响应式界面和移动端布局 |
| 数据库 | PostgreSQL 18 | 题库、练习、答案、错题和账号数据 |
| ORM | Prisma 7、`@prisma/adapter-pg` | 类型安全查询、关系和迁移 |
| 身份认证 | jose、HTTP-only Cookie | HS256 JWT 会话与角色权限 |
| Excel | ExcelJS | Excel 读取、表头映射和导入预览 |
| 参数校验 | Zod 4 | API 请求和导入数据校验 |
| 图标 | Lucide React | 学生端和教师端界面图标 |
| 测试 | Vitest | 业务规则和数据规范化测试 |
| 部署 | Docker、Docker Compose | 应用与 PostgreSQL 容器化 |

## 数据模型

| 模型 | 说明 |
| --- | --- |
| `User` | 学生和教师账号、密码摘要、角色、启用和强制改密状态 |
| `Level` | A、B、C 等等级定义 |
| `KnowledgePoint` | 使用分类号、父级 ID、路径和深度组成的树形知识点 |
| `LevelPracticeRule` | 每个等级的综合练习题量配置 |
| `KnowledgePracticeRule` | 每个“知识点 + 等级”的专项题量配置 |
| `Question` | 题干、选项、答案、等级、知识点、规格和状态 |
| `PracticeSession` | 学生练习、模式、题量快照和完成状态 |
| `PracticeSessionQuestion` | 练习中固定的题目和顺序 |
| `PracticeAnswer` | 学生提交答案、正确性和提交时间 |
| `WrongQuestion` | 学生错题次数、掌握状态和最近错误时间 |
| `ImportBatch` | Excel 导入批次和导入统计 |

## 项目结构

```text
app/
├── api/v1/                 # 登录、练习、导入和教师管理接口
├── change-password/        # 强制修改密码页面
├── login/                  # 登录页面
├── student/                # 学生首页、练习、历史和错题本
└── teacher/                # 教师概览、题库、知识点、规则、导入和学生管理
components/
├── ui/                     # 基础 UI 组件
├── question-manager.tsx    # 题库管理交互
├── knowledge-manager.tsx   # 知识点管理交互
├── student-manager.tsx     # 学生账号管理交互
└── practice-runner.tsx     # 移动端单题练习组件
lib/
├── domain/                 # 无数据库依赖的业务规则和校验
├── server/                 # 服务端认证、练习和知识点服务
└── db.ts                   # Prisma 数据库客户端
prisma/
├── migrations/             # PostgreSQL 迁移
├── schema.prisma           # 数据库模型
└── seed.ts                 # 演示账号、等级、知识点和题目数据
tests/                      # Vitest 自动化测试
```

## 环境要求

推荐使用：

- Windows 10/11、macOS 或 Linux。
- Node.js 24。
- npm 11 或兼容版本。
- Docker Desktop 与 Docker Compose v2。
- Git。
- PostgreSQL 可以使用 Docker 容器，无需单独安装。

## 环境变量

复制模板：

```powershell
Copy-Item .env.example .env
```

| 变量 | 示例 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://practice:practice@localhost:5432/practice?schema=public` | Prisma 使用的 PostgreSQL 地址 |
| `APP_SEED_PASSWORD` | `ChangeMe123!` | 演示账号种子密码 |
| `AUTH_SECRET` | 至少 32 字符随机字符串 | JWT 签名密钥 |
| `COOKIE_SECURE` | `false` | 本地 HTTP 为 `false`，正式 HTTPS 为 `true` |

PowerShell 生成随机 `AUTH_SECRET`：

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

> `.env` 已加入 `.gitignore`，不要将真实密钥提交到 GitHub。

## 快速启动：Docker

### 1. 安装 Node.js 依赖

```powershell
npm.cmd install
```

### 2. 创建环境变量

```powershell
Copy-Item .env.example .env
```

将 `.env` 中的 `AUTH_SECRET` 替换为至少 32 字符的随机值。

### 3. 启动 PostgreSQL

```powershell
docker compose up -d db
```

### 4. 执行数据库迁移

已有迁移应使用：

```powershell
npx.cmd prisma migrate deploy
```

开发数据库需要创建新迁移时使用：

```powershell
npm.cmd run db:migrate -- --name your_migration_name
```

### 5. 写入演示数据

```powershell
npm.cmd run db:seed
```

### 6. 构建并启动应用

```powershell
docker compose up -d --build app
```

访问：

- 首页：`http://localhost:3000`
- 登录页：`http://localhost:3000/login`
- 学生端：`http://localhost:3000/student`
- 教师端：`http://localhost:3000/teacher`

查看容器状态：

```powershell
docker compose ps
```

查看应用日志：

```powershell
docker compose logs -f app
```

停止服务但保留数据库：

```powershell
docker compose down
```

停止服务并删除数据库卷：

```powershell
docker compose down -v
```

> `docker compose down -v` 会永久删除本机容器数据库，使用前必须确认已经备份。

## 本地开发模式

```powershell
npm.cmd install
Copy-Item .env.example .env
docker compose up -d db
npx.cmd prisma migrate deploy
npm.cmd run db:seed
npm.cmd run dev
```

开发服务器默认地址：

```text
http://localhost:3000
```

## 演示账号

种子数据默认创建：

| 角色 | 用户名 | 默认密码 |
| --- | --- | --- |
| 教师 | `teacher` | `ChangeMe123!` |
| 学生 | `student` | `ChangeMe123!` |

如果修改了 `APP_SEED_PASSWORD`，密码以环境变量为准。

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
| `POST` | `/api/v1/practice-sessions` | 创建等级综合或知识点专项练习 |
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
| `POST` | `/api/v1/imports/preview` | 解析 Excel 并返回预检结果 |
| `POST` | `/api/v1/imports/commit` | 再次校验并提交导入批次 |
| `GET` | `/api/v1/admin/import-batches` | 分页查询导入批次 |
| `POST` | `/api/v1/admin/import-batches/:id/revert` | 撤销已提交导入批次 |

所有教师管理接口都会在服务端验证当前登录用户角色，不能只依赖前端页面限制。

## 质量检查

运行全部测试：

```powershell
npm.cmd test
```

运行 PostgreSQL 集成测试：

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
- Excel 常见答案格式标准化。
- 选项规格与实际答案数量校验。
- `MC2`、`MC3` 等编码冲突警告。
- 教师题目编辑选项连续性校验。
- 分类号格式和空段校验。

## 数据备份与恢复

### 备份

```powershell
.\scripts\backup.ps1
```

### 恢复

恢复前应停止应用写入，并确认目标数据库可以被覆盖：

```powershell
.\scripts\restore.ps1 -BackupFile .\backups\practice-YYYYMMDD-HHMMSS.dump
```

脚本使用 PostgreSQL 自定义备份格式，并通过 `docker compose cp` 传输文件，避免 Windows PowerShell 文本管道造成编码损坏。

生产环境建议使用云数据库自动备份，并定期验证备份文件可以正常恢复。

## 安全说明

当前版本已经提供：

- Scrypt 密码摘要。
- HS256 JWT 会话。
- HTTP-only Cookie。
- `SameSite=Lax` Cookie。
- 学生和教师服务端角色校验。
- 停用账号后旧会话自动失效。
- 管理员重置密码后的强制改密。
- 学生题目接口不会提前返回标准答案。
- 登录失败按用户名和 IP 进行 15 分钟窗口限流。
- 密码修改、密码重置和账号停用会使旧会话立即失效。
- 所有写接口执行同源校验，敏感教师操作写入审计日志。

## 生产部署

生产环境使用独立 Compose 文件，并通过 Caddy 自动申请和续期 HTTPS 证书：

```powershell
Copy-Item .env.example .env
docker compose -f docker-compose.prod.yml up -d --build
```

生产环境必须设置随机的 `POSTGRES_PASSWORD`、至少 32 字符的 `AUTH_SECRET` 和真实 `APP_DOMAIN`。数据库不暴露宿主机端口，应用会在迁移任务成功后启动。

健康检查：

```text
/api/health/live
/api/health/ready
```

备份和恢复：

```powershell
.\scripts\backup.ps1
.\scripts\restore.ps1 -BackupFile .\backups\practice-YYYYMMDD-HHMMSS.dump
```

升级步骤：

1. 执行 `scripts/backup.ps1` 并在独立环境验证备份可恢复。
2. 拉取新代码后运行 `docker compose -f docker-compose.prod.yml build`。
3. 运行 `docker compose -f docker-compose.prod.yml up -d`；迁移任务成功后应用才会启动。
4. 检查 `/api/health/live`、`/api/health/ready` 和关键登录、练习流程。

回滚步骤：

1. 若仅应用代码异常且迁移向后兼容，切回上一版本镜像并重新运行生产 Compose。
2. 若数据库迁移不兼容，停止应用，使用升级前 `.dump` 文件执行 `scripts/restore.ps1`，再启动上一版本镜像。
3. Prisma 生产迁移不自动执行向下迁移；任何破坏性 Schema 变更都必须先验证备份恢复。

正式公网部署后仍建议接入外部监控、集中日志、异常告警和异地备份。

## 常见问题

### 页面无法连接数据库

确认 PostgreSQL 容器健康：

```powershell
docker compose ps
docker compose logs db
```

本地开发使用 `localhost:5432`，应用容器内部使用主机名 `db:5432`，不要混用两个地址。

### `AUTH_SECRET` 报错

`AUTH_SECRET` 必须至少 32 个字符。修改 `.env` 后需要重新创建应用容器：

```powershell
docker compose up -d --force-recreate app
```

### 端口被占用

检查 `3000` 或 `5432` 端口：

```powershell
Get-NetTCPConnection -LocalPort 3000,5432 -ErrorAction SilentlyContinue
```

### Docker Hub 无法访问

项目默认使用 AWS Public ECR 中的 Docker Official Images 镜像：

```text
public.ecr.aws/docker/library/node:24-alpine
public.ecr.aws/docker/library/postgres:18-alpine
```

因此不依赖直接访问 Docker Hub。

## 当前限制与后续规划

- 增加知识点分类号重命名和批量调整。
- 增加题库 Excel 导出和学生批量导入。
- 增加分页、服务端组合筛选和大题库性能优化。
- 增加更细粒度的掌握度复习策略。
- 增加学生薄弱知识点趋势和报表导出。
- 增加 AI 解析草稿、教师审核和学生查看流程。
- 增加正式考试、限时、防作弊和试卷发布能力。

## GitHub

仓库地址：`https://github.com/ThreeBOOdy/Test`

提交代码前建议至少执行：

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```
