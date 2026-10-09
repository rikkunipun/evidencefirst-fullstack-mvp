import "server-only";

/**
 * Basic in-memory sliding-window rate limiter. Deliberately simple for a
 * pilot-day guard against accidental/abusive hammering of the costliest
 * endpoints (session creation, model-calling discovery turns) — NOT a
 * distributed-systems-grade limiter. Each warm serverless instance keeps
 * its own counters, so the real effective limit under multiple concurrent
 * instances is higher than the configured one. Good enough to stop a
 * single runaway client/script; not a substitute for a shared store
 * (e.g. Redis) if this ever needs to hold under real multi-instance load.
 */
const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= maxRequests) {
    const oldestInWindow = timestamps[0];
    buckets.set(key, timestamps);
    return { allowed: false, remaining: 0, retryAfterMs: oldestInWindow + windowMs - now };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { allowed: true, remaining: maxRequests - timestamps.length, retryAfterMs: 0 };
}

/** Best-effort client identifier from standard proxy headers (Vercel sets x-forwarded-for). */
export function clientIpFrom(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
