import "server-only";
import { ServerConfigurationError } from "@/lib/server/env";

export type AiRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface AiUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiCompletion {
  content: string;
  model: string;
  usage?: AiUsage;
}

export interface AiDelta {
  content: string;
  finishReason?: string | null;
}

export interface AiProviderOptions {
  /** External cancellation signal. */
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  /** Overrides the provider default timeout for this call. */
  timeoutMs?: number;
}

export interface AiProvider {
  readonly name: string;
  complete(messages: readonly AiMessage[], options?: AiProviderOptions): Promise<AiCompletion>;
  stream(messages: readonly AiMessage[], options?: AiProviderOptions): AsyncIterable<AiDelta>;
}

export type AiProviderErrorCode =
  | "CONFIG"
  | "AUTH"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "SERVER"
  | "NETWORK"
  | "TIMEOUT"
  | "CANCELLED"
  | "BAD_RESPONSE"
  | "STREAM"
  | "UNKNOWN";

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly code: AiProviderErrorCode,
    public readonly status?: number,
    public readonly retryable = false,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export type CloudProviderConfig = {
  baseUrl: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
};

const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException) return error.name === "AbortError" || error.name === "TimeoutError";
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

function isTimeoutError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "TimeoutError"
    : error instanceof Error && error.name === "TimeoutError";
}

function parseUsage(value: unknown): AiUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  const promptTokens = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined;
  const completionTokens = typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined;
  const totalTokens = typeof usage.total_tokens === "number" ? usage.total_tokens : undefined;
  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) return undefined;
  return { promptTokens, completionTokens, totalTokens };
}

export class CloudProvider implements AiProvider {
  readonly name = "cloud";
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CloudProviderConfig) {
    if (!config.baseUrl.trim()) throw new ServerConfigurationError("AI_BASE_URL is required for CloudProvider");
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey?.trim() ?? "";
    this.model = config.model?.trim() || DEFAULT_MODEL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async complete(messages: readonly AiMessage[], options?: AiProviderOptions): Promise<AiCompletion> {
    const response = await this.request("/chat/completions", {
      model: options?.model ?? this.model,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      stream: false,
    }, options);

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      throw new AiProviderError("AI 响应不是有效的 JSON", "BAD_RESPONSE", undefined, false, error);
    }
    const payload = data as { choices?: Array<{ message?: { content?: unknown } }>; model?: unknown; usage?: unknown };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new AiProviderError("AI 响应缺少 message.content", "BAD_RESPONSE", undefined, false, data);
    }
    return {
      content,
      model: typeof payload.model === "string" ? payload.model : options?.model ?? this.model,
      usage: parseUsage(payload.usage),
    };
  }

  async *stream(messages: readonly AiMessage[], options?: AiProviderOptions): AsyncIterable<AiDelta> {
    const response = await this.request("/chat/completions", {
      model: options?.model ?? this.model,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      stream: true,
    }, options);

    if (!response.body) {
      throw new AiProviderError("AI 流式响应缺少 body", "STREAM", undefined, false);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;
          let json: unknown;
          try {
            json = JSON.parse(payload);
          } catch {
            continue;
          }
          const chunk = json as { choices?: Array<{ delta?: { content?: unknown }; finish_reason?: string | null }> };
          const content = chunk.choices?.[0]?.delta?.content;
          if (typeof content === "string" && content.length > 0) {
            yield { content, finishReason: chunk.choices?.[0]?.finish_reason ?? null };
          }
        }
      }
    } catch (error) {
      throw new AiProviderError(`AI 流式读取失败: ${errorMessage(error)}`, "STREAM", undefined, false, error);
    } finally {
      reader.releaseLock();
    }
  }

  private async request(path: string, body: Record<string, unknown>, options?: AiProviderOptions): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return this.fetchWithRetry(path, {
      method: "POST",
      headers,
      body: JSON.stringify(this.compactBody(body)),
    }, options);
  }

  private compactBody(body: Record<string, unknown>) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) result[key] = value;
    }
    return result;
  }

  private async fetchWithRetry(path: string, init: RequestInit, options?: AiProviderOptions): Promise<Response> {
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
    const maxRetries = this.maxRetries;

    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort(new DOMException("AI 请求超时", "TimeoutError"));
      }, timeoutMs);
      const onExternalAbort = () => controller.abort(options?.signal?.reason);

      if (options?.signal) {
        if (options.signal.aborted) controller.abort(options.signal.reason);
        else options.signal.addEventListener("abort", onExternalAbort, { once: true });
      }

      try {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
        if (!response.ok) {
          const bodyText = await response.text();
          const error = this.normalizeHttpError(response.status, bodyText);
          if (error.retryable && attempt < maxRetries) {
            await delay(this.backoffMs(attempt));
            continue;
          }
          throw error;
        }
        return response;
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        if (isAbortError(error)) {
          const timedOut = isTimeoutError(error);
          const code: AiProviderErrorCode = timedOut ? "TIMEOUT" : "CANCELLED";
          const retryable = timedOut && attempt < maxRetries;
          const providerError = new AiProviderError(
            timedOut ? `AI 请求超时（${timeoutMs}ms）` : "AI 请求已取消",
            code,
            undefined,
            retryable,
            error,
          );
          if (retryable) {
            await delay(this.backoffMs(attempt));
            continue;
          }
          throw providerError;
        }
        const providerError = new AiProviderError(
          `AI 网络请求失败: ${errorMessage(error)}`,
          "NETWORK",
          undefined,
          true,
          error,
        );
        if (attempt < maxRetries) {
          await delay(this.backoffMs(attempt));
          continue;
        }
        throw providerError;
      } finally {
        clearTimeout(timer);
        options?.signal?.removeEventListener("abort", onExternalAbort);
      }
    }
  }

  private backoffMs(attempt: number) {
    return Math.min(250 * 2 ** attempt, 2_000);
  }

  private normalizeHttpError(status: number, bodyText: string): AiProviderError {
    let message = bodyText;
    try {
      const data = JSON.parse(bodyText) as { error?: { message?: unknown } | string };
      if (data.error) {
        message = typeof data.error === "string" ? data.error : typeof data.error?.message === "string" ? data.error.message : bodyText;
      }
    } catch {
      // keep raw body as the message
    }
    const code: AiProviderErrorCode =
      status === 401 || status === 403 ? "AUTH" :
      status === 429 ? "RATE_LIMITED" :
      status >= 500 ? "SERVER" : "BAD_REQUEST";
    return new AiProviderError(message || `AI 请求失败（HTTP ${status}）`, code, status, RETRYABLE_STATUS.has(status));
  }
}

export class MockProvider implements AiProvider {
  readonly name = "mock";
  private readonly content: string;
  private readonly chunks: readonly string[];
  private readonly model: string;
  private readonly usage: AiUsage | undefined;

  constructor(config: { content?: string; chunks?: readonly string[]; model?: string; usage?: AiUsage } = {}) {
    this.content = config.content ?? "Mock AI 响应";
    this.chunks = config.chunks ?? ["Mock ", "AI ", "响应"];
    this.model = config.model ?? "mock-model";
    this.usage = config.usage;
  }

  async complete(messages: readonly AiMessage[], options?: AiProviderOptions): Promise<AiCompletion> {
    void messages;
    return {
      content: this.content,
      model: options?.model ?? this.model,
      usage: this.usage,
    };
  }

  async *stream(messages: readonly AiMessage[], options?: AiProviderOptions): AsyncIterable<AiDelta> {
    void messages;
    void options;
    for (const chunk of this.chunks) {
      yield { content: chunk, finishReason: null };
    }
    yield { content: "", finishReason: "stop" };
  }
}

export function getAiProvider(env: Record<string, string | undefined> = process.env): AiProvider {
  const provider = env.AI_PROVIDER?.trim().toLowerCase() || "cloud";
  if (provider === "mock") return new MockProvider();
  if (provider === "cloud" || provider === "ollama") {
    const baseUrl = env.AI_BASE_URL?.trim();
    if (!baseUrl) {
      throw new ServerConfigurationError("AI_BASE_URL is required when AI_PROVIDER=cloud|ollama");
    }
    const apiKey = env.AI_API_KEY?.trim() ?? "";
    if (provider === "cloud" && !apiKey) {
      throw new ServerConfigurationError("AI_API_KEY is required when AI_PROVIDER=cloud");
    }
    return new CloudProvider({
      baseUrl,
      apiKey,
      model: env.AI_MODEL?.trim() || DEFAULT_MODEL,
      timeoutMs: parsePositiveInteger(env.AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
      maxRetries: parsePositiveInteger(env.AI_MAX_RETRIES, DEFAULT_MAX_RETRIES),
    });
  }
  throw new ServerConfigurationError(`Unsupported AI_PROVIDER: ${provider}`);
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}
