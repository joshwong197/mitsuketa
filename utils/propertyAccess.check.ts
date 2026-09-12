import assert from 'node:assert/strict';
import { createPropertyHandler } from '../api/property';
import { createAccountHandler } from '../api/property-account';
import { AccessError, NOTICE_VERSION, type Member } from './propertyAccount';
import { sandboxStripe } from './propertyBilling';

process.env.PROPERTY_AUTH_MODE = 'clerk';
process.env.PROPERTY_BILLING_MODE = 'sandbox';
process.env.DATABASE_URL = 'postgresql://example:example@localhost/example';
process.env.LINZ_API_KEY = 'test-only';
process.env.CLERK_AUTHORIZED_PARTIES = 'http://localhost:3000';
let member: Member = { id: '00000000-0000-4000-8000-000000000001', subject: 'user_approved', issuer: 'https://example.clerk.accounts.dev',
    searcher: 'example@example.test', status: 'pending', accepted_notice_version: NOTICE_VERSION, canAudit: false };
let identityFails = false, upstream = 0, debits = 0, balance = 1, audits = 0, upstreamFails = false, titleExists = true, debitSucceeds = true;
const resolve = async () => { if (identityFails) throw new AccessError(401, 'unauthorised', 'Sign in.'); return member; };
const property = createPropertyHandler({ member: resolve, balance: async () => balance,
    add: async event => { audits++; assert.equal(event.accountId, member.id); assert.match(event.actor!, /^clerk:/); return 'synthetic-reference'; },
    titleReport: async () => { upstream++; if (upstreamFails) throw new Error('synthetic upstream failure'); return {
        title: titleExists ? { title_no: 'SAMPLE' } : null, owners: [], memorials: [], estates: [], address: null, geometry: null, bbox: null,
    }; },
    consume: async () => { debits++; return debitSucceeds; },
});
async function request(handler: any, mode: string, body?: object, origin = 'http://localhost:3000') {
    const res: any = { code: 200, setHeader() {}, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
    await handler({ method: body ? 'POST' : 'GET', headers: { origin }, cookies: {}, body,
        query: { mode, title_no: 'SAMPLE', ref: 'MATTER-TEST', accountId: 'spoofed', canAudit: 'true' } }, res);
    return res;
}
for (const status of ['pending', 'rejected', 'suspended'] as const) {
    member.status = status;
    for (const mode of ['address', 'owner', 'title', 'tile']) assert.equal((await request(property, mode)).code, 403);
}
assert.equal(upstream, 0); assert.equal(audits, 0);
identityFails = true;
assert.equal((await request(property, 'title')).code, 401);
identityFails = false; member.status = 'approved';
member.accepted_notice_version = null;
assert.equal((await request(property, 'title')).code, 403);
member.accepted_notice_version = NOTICE_VERSION;
balance = 0;
assert.equal((await request(property, 'title')).code, 402);
assert.equal(upstream, 0);
balance = 1; upstreamFails = true;
assert.equal((await request(property, 'title')).code, 502); assert.equal(debits, 0);
upstreamFails = false; titleExists = false;
assert.equal((await request(property, 'title')).code, 200); assert.equal(debits, 0);
titleExists = true; debitSucceeds = false;
const raced = await request(property, 'title');
assert.equal(raced.code, 402); assert.ok(!raced.body.title);
debitSucceeds = true;
assert.equal((await request(property, 'title')).code, 200);
assert.equal((await request(property, 'audit')).code, 403);

let writes = 0, checkouts = 0;
const account = createAccountHandler({ member: resolve, balance: async () => 0,
    query: async () => { writes++; return [{ id: 'synthetic' }]; },
    checkout: async () => { checkouts++; return 'https://checkout.stripe.com/test'; },
});
assert.equal((await request(account, 'review', { accountId: member.id, status: 'approved', canAudit: true })).code, 403);
assert.equal(writes, 0);
assert.equal((await request(account, 'apply', { purpose: 'testing', organisation: '', noticeVersion: NOTICE_VERSION }, 'https://evil.example')).code, 403);
assert.equal(writes, 0);
member.status = 'pending';
assert.equal((await request(account, 'checkout', { offer: 'payg', requestId: crypto.randomUUID() })).code, 403);
assert.equal(checkouts, 0);
assert.equal((await request(account, 'apply', { purpose: 'testing', organisation: '', noticeVersion: 'old' })).code, 400);
assert.equal((await request(account, 'apply', { purpose: 'testing', organisation: '', noticeVersion: NOTICE_VERSION })).code, 200);
assert.equal(member.status, 'pending');
member.canAudit = true;
assert.equal((await request(account, 'review', { accountId: member.id, status: 'approved' })).code, 200);
member.canAudit = false;
assert.equal((await request(account, 'members')).code, 403);
process.env.STRIPE_SECRET_KEY = 'sk_live_synthetic';
assert.throws(sandboxStripe, AccessError);
process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic';
process.env.VERCEL_ENV = 'production';
assert.throws(sandboxStripe, AccessError);
process.env.VERCEL_ENV = 'preview';
process.env.PROPERTY_BILLING_MODE = 'live';
assert.throws(sandboxStripe, AccessError);
console.log('PASS: approval, identity, notice, admin and origin gates; no charge on failure; last-pass race withholding; live Stripe refused');
