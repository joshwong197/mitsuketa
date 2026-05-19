// In-memory per-IP rate limiter, shared between /api/proxy and /api/mcp.
// Same semantics as the original proxy.ts limiter (200 req/min). State is
// per Vercel function instance — fine for a soft limit, not a hard SLA.

const buckets = new Map<string, { count: number; reset: number }>();
const MAX_REQUESTS_PER_MINUTE = 200;
const WINDOW_MS = 60_000;

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetMs: number;
}

export function checkRateLimit(clientIp: string): RateLimitResult {
    const now = Date.now();
    let bucket = buckets.get(clientIp);
    if (!bucket || now > bucket.reset) {
        bucket = { count: 0, reset: now + WINDOW_MS };
    }
    bucket.count++;
    buckets.set(clientIp, bucket);
    return {
        allowed: bucket.count <= MAX_REQUESTS_PER_MINUTE,
        remaining: Math.max(0, MAX_REQUESTS_PER_MINUTE - bucket.count),
        resetMs: bucket.reset - now,
    };
}
