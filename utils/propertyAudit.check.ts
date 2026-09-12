import assert from 'node:assert/strict';
import { recordSearch, normalizeIp, canReadAudit, recentSearches, AuditUnavailableError } from './propertyAudit';
import { createPropertyHandler } from '../api/property';

const calls: { sql: string; params: unknown[] }[] = [];
const sql = async (text: string, params: unknown[]) => {
    calls.push({ sql: text, params }); return [{ audit_reference: '18ae328b-966c-4371-aa48-ad5c73694462' }];
};
assert.equal(await recordSearch({ mode: 'address', query: 'Example road', searcher: 'operator',
    reference: "CASE-'123", ip: '127.0.0.1, 10.0.0.1', owners: ['must never be stored'] } as any, sql), '18ae328b-966c-4371-aa48-ad5c73694462');
assert.deepEqual(calls[0].params, ['address', 'Example road', null, 'password:operator', "CASE-'123", '127.0.0.1']);
assert.ok(!calls[0].sql.includes("CASE-'123"));
assert.equal(normalizeIp('testclient'), null);
assert.equal(normalizeIp('::1'), '::1');
await assert.rejects(recordSearch({ mode: 'title', query: 'EXAMPLE', searcher: 'operator' },
    async () => { throw new Error('sensitive database detail'); }), AuditUnavailableError);
await recentSearches(' Operator ', sql);
assert.deepEqual(calls[1].params, ['password:operator']);
assert.match(calls[1].sql, /LIMIT 200/);

process.env.PROPERTY_PW_OPERATOR = 'test-only-operator';
process.env.PROPERTY_PW_ADMIN = 'test-only-admin';
process.env.PROPERTY_AUDIT_ADMINS = 'admin';
process.env.LINZ_API_KEY = 'test-only';
process.env.DATABASE_URL = 'postgresql://example:example@localhost/example';
assert.ok(canReadAudit('ADMIN'));
assert.ok(!canReadAudit('operator'));

const events: any[] = [];
let upstream = 0;
let failAudit = false;
let reads = 0;
const handler = createPropertyHandler({
    add: async event => {
        events.push(event);
        if (failAudit) throw new AuditUnavailableError();
        return 'AUD-123';
    },
    searchAddress: async (_client, query) => { upstream++; return { resolution_status: 'not_found', query }; },
    titleReport: async () => { upstream++; return { title: null, owners: [], memorials: [], estates: [], address: null, geometry: null, bbox: null }; },
    recentSearches: async () => { reads++; return []; },
});
async function request(query: Record<string, string>, cookie?: string, body?: object) {
    const headers: Record<string, any> = {};
    const response: any = { statusCode: 200,
        setHeader(key: string, value: any) { headers[key.toLowerCase()] = value; },
        status(code: number) { this.statusCode = code; return this; },
        json(value: any) { this.body = value; return this; },
    };
    await handler({ query, method: body ? 'POST' : 'GET', body,
        headers: { 'x-forwarded-proto': 'http' }, cookies: cookie ? { mitsuketa_property: cookie } : {} } as any, response);
    return { status: response.statusCode, body: response.body, headers };
}
assert.equal((await request({ mode: 'title', title_no: 'EXAMPLE' })).status, 401);
assert.equal(upstream, 0);
const login = await request({ mode: 'login' }, undefined, { searcher: 'operator', password: 'test-only-operator' });
assert.equal(login.status, 200);
assert.equal(login.body.canAudit, false);
const cookie = login.headers['set-cookie'].split(';')[0].split('=')[1];
assert.equal((await request({ mode: 'audit', searcher: 'admin' }, cookie)).status, 403);
assert.equal(reads, 0);
assert.equal((await request({ mode: 'address', q: 'Example', ref: 'x'.repeat(101) }, cookie)).status, 400);
assert.equal(upstream, 0);
const search = await request({ mode: 'address', q: 'Example', ref: 'CASE-123', searcher: 'admin' }, cookie);
assert.equal(search.status, 200);
assert.equal(search.body.audit_reference, 'AUD-123');
assert.equal(search.body.matter_reference, 'CASE-123');
assert.equal(search.headers['cache-control'], 'no-store');
assert.equal(events.at(-1).searcher, 'operator');
assert.equal(events.at(-1).reference, 'CASE-123');
assert.equal(upstream, 1);
for (const mode of ['address', 'owner', 'title']) {
    for (const ref of [undefined, '', '   ']) {
        const before = events.length;
        const result = await request({ mode, q: 'Example', title_no: 'EXAMPLE', ...(ref === undefined ? {} : { ref }) }, cookie);
        assert.equal(result.status, 400);
        assert.equal(result.body.error, 'reference_required');
        assert.equal(events.length, before, 'Missing matter must not create a search audit');
        assert.equal(upstream, 1, 'Missing matter must stop LINZ');
    }
}
failAudit = true;
assert.equal((await request({ mode: 'title', title_no: 'EXAMPLE', ref: 'CASE-123' }, cookie)).status, 503);
assert.equal(upstream, 1, 'Audit failure must stop the LINZ request');
failAudit = false;
const admin = await request({ mode: 'login' }, undefined, { searcher: 'admin', password: 'test-only-admin' });
const adminCookie = admin.headers['set-cookie'].split(';')[0].split('=')[1];
assert.equal((await request({ mode: 'audit' }, adminCookie)).status, 200);
assert.equal(reads, 1);
process.env.PROPERTY_AUDIT_ADMINS = '';
assert.equal((await request({ mode: 'audit' }, adminCookie)).status, 403, 'Revoking admin permission takes effect immediately');
delete process.env.DATABASE_URL;
assert.equal((await request({ mode: 'address', q: 'Example' }, cookie)).status, 503);
assert.equal(upstream, 1);
console.log('PASS: durable reference, input-only SQL, credential attribution, admin isolation, fail-closed audit');
