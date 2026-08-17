# 01 — 模型网关（云 API）

**What to build:** 新增统一 AI Provider 网关，让服务端可以调用 OpenAI 兼容的云 LLM API（DeepSeek / Qwen / GLM / Kimi），支持普通补全和流式补全，并提供超时、重试、错误标准化和测试用的 Mock Provider。

**Blocked by:** None — can start immediately.

**Status:** done

- [ ] 新增 `lib/server/ai/provider.ts`，定义 `AiProvider` 接口：
  - `complete(messages, options): Promise<AiCompletion>`
  - `stream(messages, options): AsyncIterable<AiDelta>`
- [ ] 支持环境变量：
  - `AI_PROVIDER=cloud`
  - `AI_BASE_URL`
  - `AI_API_KEY`
  - `AI_MODEL`
- [ ] 实现 `CloudProvider`：使用 `fetch` 调用 OpenAI 兼容 `/chat/completions`。
- [ ] 实现流式解析：支持 SSE 格式的 delta 输出。
- [ ] 实现超时、重试（例如 2~3 次）和错误标准化。
- [ ] 实现 `MockProvider`：测试时返回固定内容，不依赖外网。
- [ ] 所有 AI 调用只能发生在 server-only 模块中，禁止客户端访问 API Key。
- [ ] 单元测试覆盖：普通补全、流式补全、超时、重试、错误格式。

**验收标准：**
- 使用 MockProvider 可跑通完整调用链路。
- 使用真实云 API 时只需配置环境变量即可切换。
- 客户端代码中不出现 `AI_API_KEY`。
