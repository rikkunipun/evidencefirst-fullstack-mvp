export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error ?? "request_failed") as Error & { status?: number; details?: unknown };
    err.status = res.status;
    err.details = json?.details;
    throw err;
  }
  return json as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("request_failed");
  return res.json();
}
