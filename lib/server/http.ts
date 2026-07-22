import "server-only";
import { ApiError } from "@/lib/domain/api-error";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    if (process.env.NODE_ENV === "production") throw new ApiError("请求来源无效", 403);
    return;
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  if (!host || new URL(origin).origin !== `${protocol}://${host}`) throw new ApiError("请求来源无效", 403);
}
