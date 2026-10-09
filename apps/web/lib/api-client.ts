/** Default bound on how long a participant-facing request waits before giving up and letting the UI show a retry. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export class ApiTimeoutError extends Error {
  constructor() {
    super("request_timed_out");
    this.name = "ApiTimeoutError";
  }
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) throw new ApiTimeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiPost<T>(url: string, body: unknown, timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS): Promise<T> {
  return withTimeout(async (signal) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json?.error ?? "request_failed") as Error & { status?: number; details?: unknown };
      err.status = res.status;
      err.details = json?.details;
      throw err;
    }
    return json as T;
  }, timeoutMs);
}

export async function apiGet<T>(url: string, timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS): Promise<T> {
  return withTimeout(async (signal) => {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error("request_failed");
    return res.json();
  }, timeoutMs);
}
