import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AccessError, accountQuery, getMember, NOTICE_VERSION, passBalance, requireApproved, requireOrigin, sendAccessError } from '../utils/propertyAccount.js';
import { billingEnabled, createCheckout } from '../utils/propertyBilling.js';

const text = (value: unknown, max: number) => {
    if (typeof value !== 'string' || value.trim().length > max || /[\x00-\x1f\x7f]/.test(value)) throw new AccessError(400, 'invalid_input', 'Check the information you entered.');
    return value.trim();
};
export function createAccountHandler(dependencies: {
    member?: typeof getMember; query?: typeof accountQuery; balance?: typeof passBalance; checkout?: typeof createCheckout;
} = {}) {
const resolveMember = dependencies.member || getMember;
const query = dependencies.query || accountQuery;
const balance = dependencies.balance || passBalance;
const checkout = dependencies.checkout || createCheckout;
return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store');
    try {
        if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({ error: 'method_not_allowed' });
        if (req.method === 'POST') requireOrigin(req);
        const member = await resolveMember(req);
        const mode = req.query.mode || 'status';
        if (mode === 'status' && req.method === 'GET') {
            return res.status(200).json({ ...member, billing: billingEnabled() ? 'sandbox' : 'off',
                balance: await balance(member.id), noticeVersion: NOTICE_VERSION });
        }
        if (mode === 'members' && req.method === 'GET') {
            if (!member.canAudit) throw new AccessError(403, 'forbidden', 'Administrator access is required.');
            const rows = await query('SELECT a.id,a.email,p.status,p.organisation,p.purpose,p.requested_at,p.reviewed_at '
                + 'FROM property_access p JOIN account a ON a.id=p.account_id WHERE a.auth_issuer=$1 '
                + 'ORDER BY p.requested_at DESC NULLS LAST,a.created_at DESC LIMIT 200', [member.issuer]);
            return res.status(200).json({ rows });
        }
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST_required' });
        const body = req.body || {};
        if (mode === 'apply') {
            const organisation = text(body.organisation, 160);
            const purpose = text(body.purpose, 1000);
            if (!purpose) throw new AccessError(400, 'purpose_required', 'Tell us how you intend to use property searches.');
            if (body.noticeVersion !== NOTICE_VERSION) throw new AccessError(400, 'notice_required', 'Read and accept the current privacy notice and terms.');
            // Reapplying cannot undo a rejection/suspension or reset approval.
            await query('UPDATE property_access SET organisation=$2,purpose=$3,requested_at=now(),accepted_notice_version=$4 '
                + 'WHERE account_id=$1 AND status=\'pending\'', [member.id, organisation, purpose, NOTICE_VERSION]);
            return res.status(200).json({ ok: true });
        }
        if (mode === 'review') {
            if (!member.canAudit) throw new AccessError(403, 'forbidden', 'Administrator access is required.');
            const id = text(body.accountId, 36);
            const status = text(body.status, 20);
            if (!['approved', 'rejected', 'suspended'].includes(status)) throw new AccessError(400, 'bad_status', 'Choose an approval decision.');
            const rows = await query('WITH changed AS (UPDATE property_access p SET status=$2,reviewed_by=$3,reviewed_at=now() '
                + 'FROM account a WHERE p.account_id=$1 AND a.id=p.account_id AND a.auth_issuer=$4 '
                + 'AND ($2 <> \'approved\' OR p.accepted_notice_version=$5) RETURNING p.account_id,p.status) '
                + 'INSERT INTO property_access_history(account_id,status,reviewed_by) SELECT account_id,status,$3 FROM changed RETURNING id',
            [id, status, member.id, member.issuer, NOTICE_VERSION]);
            if (!rows.length) throw new AccessError(409, 'review_unavailable', 'The account must submit its application and accept the notice before approval.');
            return res.status(200).json({ ok: true });
        }
        if (mode === 'checkout') {
            requireApproved(member);
            return res.status(200).json({ url: await checkout(member, text(body.offer, 20), text(body.requestId, 36)) });
        }
        return res.status(400).json({ error: 'unknown_mode' });
    } catch (error) { return sendAccessError(res, error); }
}
}
export default createAccountHandler();
