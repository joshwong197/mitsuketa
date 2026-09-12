import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import Stripe from 'stripe';
import handler from '../api/stripe-webhook';
import { fulfillSession } from './propertyBilling';

process.env.PROPERTY_BILLING_MODE = 'sandbox';
process.env.STRIPE_SECRET_KEY = 'sk_test_synthetic';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_synthetic';
process.env.VERCEL_ENV = 'preview';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
async function send(payload: string, signature?: string) {
    const req: any = Readable.from([Buffer.from(payload)]);
    req.method = 'POST'; req.headers = { 'stripe-signature': signature };
    // A parsed body is deliberately wrong: verification must use original bytes.
    req.body = { forged: true };
    const res: any = { code: 200, setHeader() {}, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
    await handler(req, res); return res;
}
const payload = JSON.stringify({ id: 'evt_synthetic', type: 'customer.created', livemode: false, data: { object: {} } });
const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
assert.equal((await send(payload, signature)).code, 200);
assert.equal((await send(payload)).code, 400);
assert.equal((await send(payload + ' ', signature)).code, 400);
const live = payload.replace('"livemode":false', '"livemode":true');
assert.equal((await send(live, stripe.webhooks.generateTestHeaderString({ payload: live, secret: process.env.STRIPE_WEBHOOK_SECRET }))).code, 400);
process.env.STRIPE_SECRET_KEY = 'sk_live_synthetic';
assert.equal((await send(payload, signature)).code, 503);
let grants = 0;
const execute = async (_sql: string, params: unknown[]) => { grants++; assert.equal(params[3], 10); return []; };
const session: any = { id: 'cs_test', metadata: { purpose: 'mitsuketa_sandbox_passes', offer: 'passes10', account_id: 'account' },
    client_reference_id: 'account', payment_intent: 'pi_test', livemode: false, mode: 'payment', status: 'complete',
    payment_status: 'paid', amount_total: 3000, currency: 'nzd' };
await fulfillSession({ ...session, payment_status: 'unpaid' }, execute);
await fulfillSession({ ...session, livemode: true }, execute);
assert.equal(grants, 0);
await assert.rejects(fulfillSession({ ...session, amount_total: 1 }, execute));
await assert.rejects(fulfillSession({ ...session, client_reference_id: 'someone-else' }, execute));
assert.equal(grants, 0);
await fulfillSession(session, execute); assert.equal(grants, 1);
console.log('PASS: Stripe raw-body signature verification, tamper rejection and test/live isolation');
