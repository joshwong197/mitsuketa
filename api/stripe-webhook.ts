import type { VercelRequest, VercelResponse } from '@vercel/node';
import { accountQuery } from '../utils/propertyAccount.js';
import { sandboxStripe, fulfillSession } from '../utils/propertyBilling.js';

export const config = { api: { bodyParser: false } };
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST_required' });
    let stripe;
    try {
        stripe = sandboxStripe();
        if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('Missing webhook secret');
    } catch { return res.status(503).json({ error: 'billing_disabled' }); }
    let event;
    try {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += bytes.length;
            if (size > 1_000_000) return res.status(413).json({ error: 'too_large' });
            chunks.push(bytes);
        }
        const signature = req.headers['stripe-signature'];
        if (typeof signature !== 'string') throw new Error('No signature');
        event = stripe.webhooks.constructEvent(Buffer.concat(chunks), signature, process.env.STRIPE_WEBHOOK_SECRET!);
        if (event.livemode) throw new Error('Live event refused');
    } catch { return res.status(400).json({ error: 'invalid_webhook' }); }
    try {
        if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
            // Retrieve canonical provider state rather than trust a redirect or stale event.
            await fulfillSession(await stripe.checkout.sessions.retrieve(event.data.object.id));
        } else if (event.type === 'charge.refunded') {
            const charge = await stripe.charges.retrieve(event.data.object.id);
            if (charge.livemode || typeof charge.payment_intent !== 'string') throw new Error('Invalid charge');
            const sessions = await stripe.checkout.sessions.list({ payment_intent: charge.payment_intent, limit: 1 });
            if (sessions.data[0]?.metadata?.purpose === 'mitsuketa_sandbox_passes') {
                await fulfillSession(sessions.data[0]);
                await accountQuery('SELECT sandbox_refund($1,$2)', [charge.payment_intent, charge.amount_refunded]);
            }
        }
        return res.status(200).json({ received: true });
    } catch { return res.status(503).json({ error: 'webhook_retry_required' }); }
}
