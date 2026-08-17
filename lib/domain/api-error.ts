export class ApiError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function mapPublicError(error: unknown, fallback: string, production: boolean) {
  if (error instanceof ApiError) return { message: error.message, status: error.status };
  return {
    message: production ? fallback : error instanceof Error ? error.message : fallback,
    status: 500,
  };
}
