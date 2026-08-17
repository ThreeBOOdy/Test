import { describe, expect, it, vi } from "vitest";
import {
  AiProviderError,
  CloudProvider,
  MockProvider,
  getAiProvider,
  type AiMessage,
} from "@/lib/server/ai/provider";

const messages: readonly AiMessage[] = [{ role: "user", content: "你好" }];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("CloudProvider", () => {
  it("completes a chat request with OpenAI-compatible body and returns usage", async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        model: "test-model",
        messages: [{ role: "user", content: "你好" }],
        temperature: 0.5,
        max_tokens: 10,
        stream: false,
      });
      expect(init.headers).toMatchObject({
        "Content-Type": "application/json",
        Authorization: "Bearer sk-test",
      });
      return jsonResponse({
        choices: [{ message: { content: "解析内容" } }],
        model: "test-model",
        usage: { prompt_tokens: 12, completion_tokens: 34, total_tokens: 46 },
      });
    });

    const provider = new CloudProvider({
      baseUrl: "https://api.example.com/v1/",
      apiKey: "sk-test",
      model: "test-model",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const result = await provider.complete(messages, { temperature: 0.5, maxTokens: 10 });

    expect(result).toEqual({
      content: "解析内容",
      model: "test-model",
      usage: { promptTokens: 12, completionTokens: 34, totalTokens: 46 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.example.com/v1/chat/completions");
  });

  it("streams SSE deltas", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      requestBody = JSON.parse(String(init.body)) as Record<string, unknown>;
      return sseResponse([
        'data: {"choices":[{"delta":{"content":"Hel"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":null}]}\n\n',
        "data: [DONE]\n\n",
      ]);
    });

    const provider = new CloudProvider({
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const deltas: string[] = [];
    for await (const delta of provider.stream(messages)) {
      if (delta.content) deltas.push(delta.content);
    }

    expect(deltas).toEqual(["Hel", "lo"]);
    expect(requestBody?.stream).toBe(true);
  });

  it("retries retryable HTTP errors up to the configured count", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "boom" } }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "still boom" } }, 503))
      .mockResolvedValueOnce(jsonResponse({
        choices: [{ message: { content: "ok" } }],
        model: "test-model",
      }));

    const provider = new CloudProvider({
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "test-model",
      maxRetries: 2,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const result = await provider.complete(messages);

    expect(result.content).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("standardizes authentication errors without retrying", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: { message: "invalid api key" } }, 401),
    );

    const provider = new CloudProvider({
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
      maxRetries: 2,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(provider.complete(messages)).rejects.toMatchObject({
      name: "AiProviderError",
      code: "AUTH",
      status: 401,
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws a standardized timeout error", async () => {
    const fetchMock = vi.fn(
      (_url: unknown, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal as AbortSignal;
          signal.addEventListener(
            "abort",
            () => {
              reject(signal.reason);
            },
            { once: true },
          );
        }),
    );

    const provider = new CloudProvider({
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
      timeoutMs: 10,
      maxRetries: 0,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(provider.complete(messages)).rejects.toMatchObject({
      name: "AiProviderError",
      code: "TIMEOUT",
      retryable: false,
    });
  });

  it("retries on network errors and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse({
        choices: [{ message: { content: "recovered" } }],
        model: "test-model",
      }));

    const provider = new CloudProvider({
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
      maxRetries: 1,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    const result = await provider.complete(messages);
    expect(result.content).toBe("recovered");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("MockProvider", () => {
  it("returns fixed content without network access", async () => {
    const provider = new MockProvider({ content: "固定解析" });
    const result = await provider.complete(messages);
    expect(result.content).toBe("固定解析");
    expect(result.model).toBe("mock-model");
  });

  it("streams fixed chunks", async () => {
    const provider = new MockProvider({ chunks: ["a", "b"] });
    const deltas: string[] = [];
    for await (const delta of provider.stream(messages)) {
      if (delta.content) deltas.push(delta.content);
    }
    expect(deltas).toEqual(["a", "b"]);
  });
});

describe("getAiProvider", () => {
  it("returns MockProvider when AI_PROVIDER=mock", () => {
    expect(getAiProvider({ AI_PROVIDER: "mock" })).toBeInstanceOf(MockProvider);
  });

  it("requires base URL and API key for cloud", () => {
    expect(() => getAiProvider({ AI_PROVIDER: "cloud" })).toThrow("AI_BASE_URL");
    expect(() => getAiProvider({ AI_PROVIDER: "cloud", AI_BASE_URL: "https://api.example.com/v1" })).toThrow("AI_API_KEY");
  });

  it("returns CloudProvider for cloud configuration", () => {
    const provider = getAiProvider({
      AI_PROVIDER: "cloud",
      AI_BASE_URL: "https://api.example.com/v1",
      AI_API_KEY: "sk-test",
      AI_MODEL: "qwen-plus",
    });
    expect(provider).toBeInstanceOf(CloudProvider);
  });

  it("allows Ollama without an API key", () => {
    const provider = getAiProvider({
      AI_PROVIDER: "ollama",
      AI_BASE_URL: "http://127.0.0.1:11434/v1",
    });
    expect(provider).toBeInstanceOf(CloudProvider);
  });

  it("rejects unknown providers", () => {
    expect(() => getAiProvider({ AI_PROVIDER: "unknown" })).toThrow("Unsupported AI_PROVIDER");
  });
});

describe("AiProviderError", () => {
  it("is an Error subclass with standardized fields", () => {
    const error = new AiProviderError("bad", "SERVER", 500, true);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ name: "AiProviderError", code: "SERVER", status: 500, retryable: true });
  });
});
