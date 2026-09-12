import Stripe from 'stripe';
import { AccessError, accountQuery, type Member, requireApproved } from './propertyAccount.js';

export const SANDBOX_OFFERS = {
    payg: { passes: 1, amount: 500, name: '1 report pass' },
    passes10: { passes: 10, amount: 3000, name: '10 report passes' },
    passes100: { passes: 100, amount: 20000, name: '100 report passes' },
} as const;
export function billingEnabled() {
    const mode = process.env.PROPERTY_BILLING_MODE || 'off';
    if (!['off', 'sandbox'].includes(mode)) throw new AccessError(503, 'not_configured', 'Billing is not configured.');
    return mode === 'sandbox';
}
export function sandboxStripe() {
    if (!billingEnabled() || process.env.VERCEL_ENV === 'production'
        || !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
        throw new AccessError(503, 'billing_disabled', 'Sandbox checkout is not enabled.');
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY);
}
export async function createCheckout(member: Member, offerKey: string, requestId: string) {
    requireApproved(member);
    const offer = Object.hasOwn(SANDBOX_OFFERS, offerKey) ? SANDBOX_OFFERS[offerKey as keyof typeof SANDBOX_OFFERS] : undefined;
    if (!offer || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new AccessError(400, 'bad_checkout', 'Choose a report-pass offer.');
    const stripe = sandboxStripe();
    const origin = process.env.PROPERTY_APP_ORIGIN || '';
    if (!/^https?:\/\//.test(origin) || new URL(origin).origin !== origin) throw new AccessError(503, 'not_configured', 'Checkout return address is not configured.');
    let customerId = (await accountQuery('SELECT customer_id FROM sandbox_customer WHERE account_id=$1', [member.id]))[0]?.customer_id;
    if (!customerId) {
        const customer = await stripe.customers.create({ metadata: { account_id: member.id, purpose: 'mitsuketa_sandbox' } },
            { idempotencyKey: `mitsuketa-customer:${member.id}` });
        customerId = (await accountQuery('INSERT INTO sandbox_customer(account_id,customer_id) VALUES($1,$2) '
            + 'ON CONFLICT(account_id) DO UPDATE SET account_id=EXCLUDED.account_id RETURNING customer_id', [member.id, customer.id]))[0].customer_id;
    }
    // No matter references or LINZ inputs are supplied to Stripe.
    const session = await stripe.checkout.sessions.create({
        mode: 'payment', payment_method_types: ['card'],
        client_reference_id: member.id,
        customer: customerId,
        metadata: { account_id: member.id, offer: offerKey, purpose: 'mitsuketa_sandbox_passes' },
        line_items: [{ price_data: { currency: 'nzd', unit_amount: offer.amount,
            product_data: { name: `Mitsuketa sandbox — ${offer.name}` } }, quantity: 1 }],
        success_url: origin + '/?checkout=complete#/app', cancel_url: origin + '/?checkout=cancelled#/app',
    }, { idempotencyKey: `mitsuketa:${member.id}:${offerKey}:${requestId}` });
    if (session.livemode || !session.url) throw new Error('Invalid sandbox session');
    return session.url;
}
export async function fulfillSession(session: Stripe.Checkout.Session, execute = accountQuery) {
    if (session.livemode || session.metadata?.purpose !== 'mitsuketa_sandbox_passes') return;
    const offer = Object.hasOwn(SANDBOX_OFFERS, session.metadata.offer) ? SANDBOX_OFFERS[session.metadata.offer as keyof typeof SANDBOX_OFFERS] : undefined;
    if (session.payment_status !== 'paid' || session.status !== 'complete') return;
    if (!offer || session.mode !== 'payment' || session.currency !== 'nzd' || session.amount_total !== offer.amount
        || session.client_reference_id !== session.metadata.account_id || typeof session.payment_intent !== 'string') {
        throw new Error('Unexpected checkout');
    }
    await execute('SELECT sandbox_fulfill($1,$2,$3,$4,$5)',
        [session.id, session.metadata.account_id, session.payment_intent, offer.passes, offer.amount]);
}
