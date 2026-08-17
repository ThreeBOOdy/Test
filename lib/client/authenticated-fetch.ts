export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, { ...init, credentials: "include", cache: "no-store" });
}