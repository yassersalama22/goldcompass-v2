import "server-only";

/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * The app runs as a single standalone Node instance (one EC2 box), so a process-
 * local Map is sufficient — no Redis/DB needed. If we ever scale horizontally,
 * swap this for a shared store behind the same `rateLimit()` signature.
 *
 * Note: keys are derived from client IP (see `getClientIp`). Because the origin
 * is reachable directly (not only via Cloudflare), a determined attacker can
 * spoof `X-Forwarded-For`; `CF-Connecting-IP` is preferred when present. For
 * hard guarantees, restrict the origin security group to Cloudflare IP ranges.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets (for a Retry-After header). */
  retryAfterSec: number;
};

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  existing.count += 1;
  const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
  if (existing.count > limit) {
    return { ok: false, remaining: 0, retryAfterSec };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSec };
}

// Opportunistic cleanup so the Map can't grow unbounded from one-off IPs.
// Runs at most once a minute, on request, and does not keep the process alive.
let lastSweep = 0;
export function sweepExpired(now = Date.now()): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Best-effort client IP from proxy headers. Prefers Cloudflare's
 * `CF-Connecting-IP`, then the first hop of `X-Forwarded-For`.
 */
export function getClientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
