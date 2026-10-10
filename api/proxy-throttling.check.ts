import assert from 'node:assert/strict';
import handler from './proxy';

const originalFetch = globalThis.fetch;
try {
    for (const retryAfter of ['7', 'Wed, 21 Oct 2037 07:28:00 GMT']) {
        globalThis.fetch = async () => new Response(JSON.stringify({ error: 'fixture throttled' }), {
            status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter },
        });
        const headers = new Map<string, string>();
        let status = 0;
        const response = {
            setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); return this; },
            status(value: number) { status = value; return this; },
            json(value: unknown) { return value; }, send(value: unknown) { return value; },
        };
        await handler({ method: 'GET', headers: { 'x-user-api-key': 'fixture-only', 'x-api-type': 'insolvency', 'x-forwarded-for': 'fixture' }, query: { path: '/fixture' } } as any, response as any);
        assert.equal(status, 429);
        assert.equal(headers.get('retry-after'), retryAfter);
        assert.equal(headers.get('cache-control'), 'no-store');
    }
    console.log('Proxy forwards numeric and date cooldown headers: passed (offline)');
} finally { globalThis.fetch = originalFetch; }
