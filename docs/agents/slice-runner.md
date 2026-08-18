# 分票顺序执行器（Slice Runner）

为 `docs/question-bank-abc-flexibility-slices.md` 的 S1..S11 提供“每个分票一个独立对话、按顺序自动推进”的可复用工具。

## 背景

- 每个分票应该在一个**新对话**中执行，开场必须包含：
  1. 使用 J-space 技能；
  2. 项目地址：`/mnt/d/Tests/Test`；
  3. 分票地址：`docs/question-bank-abc-flexibility-slices.md#Sx`。
- 分票之间有依赖/顺序关系，只有上一个分票**实施成功并提交**后，才允许开启下一个分票。
- 本工具负责状态记录、顺序判断、开场提示词生成和基础质量门禁校验。

## 状态文件

- `.jspace/slice-runner.json`：记录每个分票的 `pending / in_progress / done`、commit hash、验证时间。
- 该文件应随项目提交，保证跨对话/跨会话可恢复。

## 命令

```bash
# 查看当前所有分票状态和下一个可执行分票
npm run slice:status

# 打印下一个可执行分票的完整“独立对话开场提示词”
npm run slice:next

# 为指定分票生成开场提示词
npm run slice:prompt -- S4

# 标记某个分票完成（commit 必须存在于 git）
npm run slice:mark -- S2 <commit-hash>

# 校验某个分票的基础质量门禁：tsc / prisma validate（加 --full 再跑 eslint）
npm run slice:verify -- S2 [commit-hash] [--full]

# 重置某个分票为 pending
npm run slice:reset -- S2
```

## 每个分票对话的固定开场模板

由 `npm run slice:next` 或 `npm run slice:prompt -- Sx` 生成，形如：

```text
使用 J-space 技能；项目地址：/mnt/d/Tests/Test；分票地址：docs/question-bank-abc-flexibility-slices.md#S4

请实现分票 S4：知识点服务升级。

分票内容：...
验收标准：...
依赖：...

要求：
1. 先完整阅读 docs/question-bank-abc-flexibility-spec.md 与 docs/question-bank-abc-flexibility-slices.md。
2. 只做 S4 范围内的改动；不要夹带其它分票或无关重构。
3. 完成定义：通过 npx tsc --noEmit、npm run lint、相关 vitest；涉及 Prisma 的通过 npx prisma validate。
4. 全部通过后，用 git add -A 提交（提交信息含 S4），例如：feat(question-bank): S4 知识点服务升级。
5. 提交后运行：npm run slice:mark -- S4 <commit-hash>，并返回 JSON：{"commitHash":"...","summary":"..."}
```

## 自动顺序执行（Agent/Workflow 模式）

在支持子代理编排的 Agent 环境中，可用以下逻辑自动串联：

1. 运行 `npm run slice:status` 确认当前进度。
2. 读取 `npm run slice:next` 的输出作为下一个子对话的完整 prompt。
3. 启动一个**全新子代理/对话**，只给它该 prompt，等待它完成并返回 `{commitHash, summary}`。
4. 子代理内部在提交后调用 `npm run slice:mark -- Sx <commit-hash>` 更新状态。
5. 若返回成功且 commit 存在，回到第 2 步继续下一个分票；若失败则停下并报告。
6. 直到 `npm run slice:status` 显示全部分票 `done`。

> 注意：子代理不应继承父对话的上下文；每个分票必须是独立对话，只依赖仓库里的文档、代码和 `.jspace/slice-runner.json` 状态。
