# 知练 · 分等级与知识点刷题系统

面向学生与教师的移动优先刷题 MVP。支持按等级综合练习、按知识点专项练习、服务端即时判题、错题记录、树形知识目录、双层抽题规则，以及兼容现有题库格式的 Excel 预检。

## 当前功能

- 学生端：等级综合练习、知识点专项练习、单题即时反馈、练习历史、错题本。
- 教师端：题库概览、题目列表、知识点树、等级/知识点抽题规则、学生列表。
- Excel：读取 `.xlsx`，兼容 `AB`、`A,B`、`A、B` 等答案格式，校验 `4选2` 和 `MC2` 编码。
- 数据层：PostgreSQL 18、Prisma 7 模型、初始迁移和演示种子数据。
- 工程化：Next.js 16、TypeScript、Tailwind CSS、Vitest、Docker Compose、PWA manifest。

## 本地开发

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run db:generate
npm.cmd run dev
```

浏览：

- 首页：`http://localhost:3000`
- 学生端：`http://localhost:3000/student`
- 教师端：`http://localhost:3000/teacher`

当前 UI 使用演示数据即可直接浏览，不依赖数据库启动。

## PostgreSQL 与迁移

```powershell
docker compose up -d db
npm.cmd run db:migrate -- --name init
npm.cmd run db:seed
```

演示账号种子：

- 教师：`teacher`
- 学生：`student`
- 初始密码来自 `.env` 中的 `APP_SEED_PASSWORD`，首次登录应强制修改。

容器基础镜像使用 AWS Public ECR 的 Docker Official Images 镜像路径，避免部分网络环境无法直连 Docker Hub。PostgreSQL 端口仅绑定到本机 `127.0.0.1`。

## 完整容器启动

```powershell
docker compose up -d --build
```

服务默认使用：

- Web：`3000`
- PostgreSQL：`5432`

## Excel 表头

推荐表头：

```text
等级 | 题库编号 | 分类号 | 知识点名称 | 题目编号 | 问题 | 答案 | 选项规格 | A | B | C | D | E | F | 是否启用
```

- 单选示例：答案 `A`，规格 `4选1`。
- 多选示例：答案 `AC`，规格 `4选2`。
- 分类号自动形成 `4 > 4.1 > 4.1.1` 树形关系。

## 质量检查

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

当前核心测试覆盖随机抽题、等级/知识点范围、库存不足、多选精确计分、答案标准化和选项规格校验。

## 后续重点

- 将演示会话仓库替换为 Prisma 持久化仓库。
- 接入正式用户名/密码认证和教师权限中间件。
- 完成 Excel 确认入库、批次撤销和错误报告下载。
- 增加学习统计与教师审核后的 AI 解析。
