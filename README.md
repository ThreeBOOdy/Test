# 知练 · 分等级与知识点刷题系统

面向学生与教师的移动优先刷题系统。支持按等级综合练习、按知识点专项练习、服务端即时判题、固定题序恢复、练习历史、错题本、树形知识目录、双层抽题规则，以及兼容现有题库格式的 Excel 导入。

## 当前功能

- 账号权限：用户名密码登录、HTTP-only 会话 Cookie、学生与教师角色隔离。
- 学生端：等级综合练习、知识点专项练习、单题即时反馈、退出后继续、练习历史和错题本。
- 教师端：数据库题库概览、题目列表、知识点树、等级/知识点抽题规则、学生列表。
- 抽题规则：教师可保存每个等级及每个“知识点 + 等级”的单选、多选题量，并在保存和开始练习时校验库存。
- Excel：读取 `.xlsx`，兼容 `AB`、`A,B`、`A、B` 等答案格式，预检 `4选2`、`MC2` 等规格并确认写入数据库。
- 数据层：PostgreSQL 18、Prisma 7、持久化练习会话、答案、错题和导入批次。
- 工程化：Next.js 16、React 19、TypeScript、Tailwind CSS、Vitest、Docker Compose、PWA manifest。

## 环境配置

复制环境变量模板：

```powershell
Copy-Item .env.example .env
```

至少需要配置：

- `DATABASE_URL`：PostgreSQL 连接地址。
- `APP_SEED_PASSWORD`：种子账号的初始密码。
- `AUTH_SECRET`：JWT 签名密钥，生产环境必须使用独立随机值。
- `COOKIE_SECURE`：本地 HTTP 使用 `false`，正式 HTTPS 环境使用 `true`。

可在 PowerShell 中生成随机 `AUTH_SECRET`：

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

## 本地开发

```powershell
npm.cmd install
npm.cmd run db:generate
docker compose up -d db
npm.cmd run db:migrate -- --name init
npm.cmd run db:seed
npm.cmd run dev
```

访问地址：

- 首页：`http://localhost:3000`
- 登录：`http://localhost:3000/login`
- 学生端：`http://localhost:3000/student`
- 教师端：`http://localhost:3000/teacher`

种子账号：

- 教师：`teacher / ChangeMe123!`
- 学生：`student / ChangeMe123!`

如果修改了 `APP_SEED_PASSWORD`，种子账号密码以该变量为准。当前版本尚未实现首次登录强制改密，请勿在公网环境继续使用默认密码。

## Docker 启动

```powershell
docker compose up -d --build
```

默认端口：

- Web：`3000`
- PostgreSQL：`127.0.0.1:5432`

容器基础镜像使用 AWS Public ECR 的 Docker Official Images 镜像路径，以兼容当前网络环境。PostgreSQL 端口仅绑定本机。

## Excel 表头

推荐表头：

```text
等级 | 题库编号 | 分类号 | 知识点名称 | 题目编号 | 问题 | 答案 | 选项规格 | A | B | C | D | E | F | 是否启用
```

- 单选示例：答案 `A`，规格 `4选1`。
- 多选示例：答案 `AC`，规格 `4选2`。
- 分类号自动形成 `4 > 4.1 > 4.1.1` 树形关系。
- 导入先执行服务端预检，确认后才写入题目和导入批次。

## 质量检查

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

当前核心测试覆盖随机抽题、等级/知识点范围、库存不足、多选精确计分、答案标准化和选项规格校验。

## 后续重点

- 完成教师新增、编辑、停用题目和知识点的操作接口。
- 完成教师创建学生、重置密码和首次登录改密流程。
- 增加题库筛选、导入批次撤销和错误报告下载。
- 将学生首页演示指标替换为数据库统计。
- 增加登录限流、CSRF 加固和教师审核后的 AI 解析。