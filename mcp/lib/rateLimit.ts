// In-memory per-IP rate limiter, shared by /api/proxy, /api/mcp,
// /api/documents and /api/consent-forms. State is per Vercel function
// instance — fine for a soft anti-abuse limit, not a hard SLA.
//
// Limits are deliberately GENEROUS. The govt-register keys these endpoints
// spend are free and the app is meant to be usable without sign-in; the
// point is to stop scripted harvesting (thousands of requests a minute),
// not to slow down a team running intensive investigations — often several
// people behind one office IP, each building graphs that fan out to
// hundreds of proxy calls. Tune per endpoint at the call site.

const buckets = new Map<string, { count: number; reset: number }>();
const DEFAULT_LIMIT = 200;
const WINDOW_MS = 60_000;

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetMs: number;
    /** The limit that applied, for use in 429 messages. */
    limit: number;
}

/**
 * @param scope  Names the endpoint ("proxy", "mcp", ...) so endpoints don't
 *               share budgets when handlers run in one process (dev server).
 * @param limit  Max requests per minute for this scope.
 */
export function checkRateLimit(clientIp: string, scope = 'default', limit = DEFAULT_LIMIT): RateLimitResult {
    const now = Date.now();
    const key = `${scope}:${clientIp}`;
    let bucket = buckets.get(key);
    if (!bucket || now > bucket.reset) {
        bucket = { count: 0, reset: now + WINDOW_MS };
    }
    bucket.count++;
    buckets.set(key, bucket);
    // Opportunistic sweep so the map doesn't grow without bound under a
    // many-IP scan (each entry expires after its window anyway).
    if (buckets.size > 2000) {
        for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
    }
    return {
        allowed: bucket.count <= limit,
        remaining: Math.max(0, limit - bucket.count),
        resetMs: bucket.reset - now,
        limit,
    };
}
