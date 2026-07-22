import { ApiError } from "./api-error";

export const DEFAULT_JSON_BODY_LIMIT = 256 * 1024;

export function assertRequestBodySize(request: Request, maxBytes: number) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new ApiError("请求体过大", 413);
}

export async function readJsonBody(request: Request, maxBytes = DEFAULT_JSON_BODY_LIMIT): Promise<unknown> {
  assertRequestBodySize(request, maxBytes);

  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new ApiError("请求体过大", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("请求体不是有效 JSON", 400);
  }
}
