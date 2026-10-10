/**
 * Token-bucket rate limiter for Supabase Edge Functions.
 *
 * Per-key (typically per-JWT/user-id) token bucket held in module memory.
 * Resets on cold start — adequate for abuse-mitigation, not for billing.
 *
 * Usage:
 *   import { rateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
 *   const rl = rateLimit(userId, { capacity: 20, refillPerSec: 20/60 });
 *   if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);
 */

export interface BucketConfig {
  /** Max tokens the bucket can hold (burst size). */
  capacity: number;
  /** Tokens added per second. */
  refillPerSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the next token is available (only meaningful when !allowed). */
  retryAfterSec: number;
  limit: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

/** Consume 1 token from the bucket identified by `key`. */
export function rateLimit(key: string, cfg: BucketConfig): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: cfg.capacity, updatedAt: now };

  const elapsedSec = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(cfg.capacity, b.tokens + elapsedSec * cfg.refillPerSec);
  b.updatedAt = now;

  if (b.tokens >= 1) {
    b.tokens -= 1;
    buckets.set(key, b);
    return {
      allowed: true,
      remaining: Math.floor(b.tokens),
      retryAfterSec: 0,
      limit: cfg.capacity,
    };
  }

  buckets.set(key, b);
  const retryAfterSec = Math.ceil((1 - b.tokens) / cfg.refillPerSec);
  return { allowed: false, remaining: 0, retryAfterSec, limit: cfg.capacity };
}

/** Build a standard 429 Response from a RateLimitResult. */
export function rateLimitResponse(
  rl: RateLimitResult,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: "Too many requests. Slow down.",
      retry_after_seconds: rl.retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rl.retryAfterSec),
        "X-RateLimit-Limit": String(rl.limit),
        "X-RateLimit-Remaining": "0",
        ...extraHeaders,
      },
    },
  );
}

/** Test-only: reset all buckets. */
export function __resetBucketsForTests(): void {
  buckets.clear();
}

/**
 * Derive a stable rate-limit key from a Request. Prefers an explicit `userId`,
 * falls back to bearer-token suffix, then `x-forwarded-for` first hop, then
 * a literal "anonymous" bucket (which means all unauth callers share a bucket
 * — use sparingly).
 */
export function rateLimitKey(req: Request, userId?: string | null): string {
  if (userId) return `u:${userId}`;
  const auth = req.headers.get("Authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    const t = auth.slice(7);
    return `t:${t.slice(-32)}`;
  }
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return `ip:${xff.split(",")[0].trim()}`;
  return "anonymous";
}

