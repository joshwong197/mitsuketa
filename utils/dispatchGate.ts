// Conservative pacing; these settings are not MBIE's unpublished quota.
// Every attempt re-enters the queue. Separate browsers still have separate queues.
const START_INTERVAL = 125;
const GLOBAL_INTERVAL = 65; // At most ~923 attempts/minute across services in this browser.
let globalNext = 0;
let globalCooldown = 0;
const MAX_INTERVAL = 4000;
const MAX_RETRIES = 4;
const MAX_IN_FLIGHT = 2;
interface Bucket { interval: number; next: number; cooldown: number; active: number; limit: number; }
interface DispatchStats { attempts: number; throttled: number; failed: number; queueMs: number; networkMs: number; peak: number; }
const stats = new Map<string, DispatchStats>();
export function dispatchStats() { return Object.fromEntries([...stats].map(([key, value]) => [key, { ...value }])); }
const buckets = new Map<string, Bucket>();
interface Waiter {
    bucket: Bucket;
    signal?: AbortSignal | null;
    resolve: () => void;
    reject: (reason: unknown) => void;
    abort?: () => void;
}
const waiters: Waiter[] = [];
let wakeTimer: ReturnType<typeof setTimeout> | undefined;
export function retryAfterMs(value: string | null, now = Date.now()): number {
    if (!value) return 0;
    if (/^\d+(\.\d+)?$/.test(value.trim())) return Number(value) * 1000;
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}
function abortError() { return new DOMException('Request cancelled', 'AbortError'); }
function eligibleAt(waiter: Waiter): number | null {
    const bucket = waiter.bucket;
    if (bucket.active >= bucket.limit) return null;
    return Math.max(bucket.next, bucket.cooldown, globalNext, globalCooldown);
}
function removeWaiter(waiter: Waiter) {
    const index = waiters.indexOf(waiter);
    if (index >= 0) waiters.splice(index, 1);
    if (waiter.abort) waiter.signal?.removeEventListener('abort', waiter.abort);
}
function schedulePump() {
    if (wakeTimer !== undefined) { clearTimeout(wakeTimer); wakeTimer = undefined; }
    const now = Date.now();
    let earliest = Number.POSITIVE_INFINITY;
    for (const waiter of waiters) {
        const at = eligibleAt(waiter);
        if (at !== null) earliest = Math.min(earliest, at);
    }
    if (Number.isFinite(earliest)) {
        wakeTimer = setTimeout(() => { wakeTimer = undefined; pump(); }, Math.max(0, earliest - now));
    }
}
function pump() {
    if (wakeTimer !== undefined) { clearTimeout(wakeTimer); wakeTimer = undefined; }
    const now = Date.now();
    // Scan in enqueue order, but skip a service in cooldown or at its in-flight
    // cap. That gives the oldest eligible request the next global slot without
    // making a blocked service hold up unrelated work.
    const waiter = waiters.find(candidate => {
        const at = eligibleAt(candidate);
        return at !== null && at <= now;
    });
    if (waiter) {
        removeWaiter(waiter);
        waiter.bucket.active++;
        waiter.bucket.next = now + waiter.bucket.interval;
        globalNext = now + GLOBAL_INTERVAL;
        waiter.resolve();
    }
    schedulePump();
}
function acquire(bucket: Bucket, signal?: AbortSignal | null): Promise<void> {
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
        const waiter: Waiter = { bucket, signal, resolve, reject };
        waiter.abort = () => {
            removeWaiter(waiter);
            reject(abortError());
            pump();
        };
        signal?.addEventListener('abort', waiter.abort, { once: true });
        waiters.push(waiter);
        pump();
    });
}
export async function gatedFetch(url: string, init?: RequestInit): Promise<Response> {
    const service = new Headers(init?.headers).get('x-api-type') || 'default';
    let b = buckets.get(service);
    // Overlap slow company lookups without increasing the dispatch rate. Keep
    // tighter bounds on the person registers where throttling was observed.
    if (!b) { b = { interval: START_INTERVAL, next: 0, cooldown: 0, active: 0, limit: service === 'nzbn' || service === 'companies' ? 12 : service === 'insolvency' || service === 'disqualified' ? 6 : MAX_IN_FLIGHT }; buckets.set(service, b); }
    let metric = stats.get(service);
    if (!metric) { metric = { attempts: 0, throttled: 0, failed: 0, queueMs: 0, networkMs: 0, peak: 0 }; stats.set(service, metric); }
    for (let attempt = 0; ; attempt++) {
        const queued = Date.now();
        await acquire(b, init?.signal);
        const started = Date.now(); metric.queueMs += started - queued; metric.attempts++; metric.peak = Math.max(metric.peak, b.active);
        let response: Response;
        try {
            response = await fetch(url, init);
            if (response.status === 429) {
                metric.throttled++;
                b.interval = Math.min(MAX_INTERVAL, b.interval * 2);
                const backoff = Math.min(30000, 1000 * 2 ** attempt) + Math.random() * 250;
                b.cooldown = Math.max(b.cooldown, Date.now() + Math.max(backoff, retryAfterMs(response.headers.get('Retry-After'))));
                if (response.headers.get('X-RateLimit-Scope') === 'proxy') globalCooldown = Math.max(globalCooldown, b.cooldown);
            } else if (response.ok) {
                b.interval = Math.max(START_INTERVAL, b.interval - 10);
            }
            if (!response.ok) metric.failed++;
        } finally { metric.networkMs += Date.now() - started; b.active--; pump(); }
        if (response.status !== 429 || attempt >= MAX_RETRIES) return response;
        await response.body?.cancel();
    }
}
