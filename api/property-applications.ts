import type { VercelRequest, VercelResponse } from '@vercel/node';
import { accountQuery, authMode, getMember, AccessError, NOTICE_VERSION, requireOrigin, sendAccessError } from '../utils/propertyAccount.js';
import { createInvitationService, invitationClient } from '../utils/propertyInvitations.js';
import { checkRateLimit } from '../mcp/lib/rateLimit.js';

const clean = (value: unknown, max: number) => {
    if (typeof value !== 'string' || value.trim().length > max || /[\x00-\x1f\x7f]/.test(value)) throw new AccessError(400, 'invalid_input', 'Check the information you entered.');
    return value.trim();
};
export function createApplicationsHandler(deps: { query?: typeof accountQuery; member?: typeof getMember;
    invite?: ReturnType<typeof createInvitationService>; clerk?: typeof invitationClient } = {}) {
    const query = deps.query || accountQuery;
    const member = deps.member || getMember;
    const invite = deps.invite || createInvitationService(query);
    return async (req: VercelRequest, res: VercelResponse) => {
        res.setHeader('Cache-Control', 'no-store');
        try {
            if (authMode() !== 'clerk') throw new AccessError(503, 'not_configured', 'Account applications are unavailable.');
            const mode = req.query.mode || 'apply';
            if (mode === 'notice' && req.method === 'GET') return res.status(200).json({ noticeVersion: NOTICE_VERSION });
            if (!['GET','POST'].includes(req.method || '')) return res.status(405).json({ error: 'method_not_allowed' });
            if (req.method === 'POST') requireOrigin(req);
            if (mode === 'apply' && req.method === 'POST') {
                const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown');
                if (!checkRateLimit(ip, 'property-application', 5).allowed) throw new AccessError(429, 'rate_limited', 'Please wait a minute before trying again.');
                const email = clean(req.body?.email, 254).toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccessError(400, 'invalid_email', 'Enter a valid email address.');
                const organisation = clean(req.body?.organisation || '', 160);
                const purpose = clean(req.body?.purpose, 1000);
                if (!purpose) throw new AccessError(400, 'purpose_required', 'Tell us how you intend to use property searches.');
                if (req.body?.noticeVersion !== NOTICE_VERSION) throw new AccessError(400, 'notice_required', 'Read and accept the current privacy notice and terms.');
                if (!process.env.CLERK_ISSUER) throw new AccessError(503, 'not_configured', 'Applications are not configured.');
                // Duplicate public requests cannot change decisions or overwrite details.
                await query(`INSERT INTO property_application(issuer,email,organisation,purpose,notice_version)
                    VALUES($1,$2,$3,$4,$5) ON CONFLICT(issuer,email) DO NOTHING`,
                    [process.env.CLERK_ISSUER, email, organisation, purpose, NOTICE_VERSION]);
                return res.status(200).json({ ok: true, message: 'Request received. If approved, you will receive an invitation by email. If you have already applied, your existing request remains in review.' });
            }
            const actor = await member(req);
            if (!actor.canAudit) throw new AccessError(403, 'forbidden', 'Administrator access is required.');
            if (mode === 'list' && req.method === 'GET') {
                const rows = await query(`SELECT id,email,organisation,purpose,status,invitation_state,requested_at,reviewed_at,
                    expires_at,activated_at FROM property_application WHERE issuer=$1 ORDER BY requested_at DESC LIMIT 200`, [actor.issuer]);
                return res.status(200).json({ rows });
            }
            if (req.method !== 'POST') return res.status(405).json({ error: 'POST_required' });
            const id = clean(req.body?.applicationId, 36);
            if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AccessError(400, 'invalid_id', 'Choose an application.');
            if (mode === 'invite' || mode === 'resend') return res.status(200).json(await invite(id, actor, mode === 'resend'));
            if (mode === 'reject' || mode === 'revoke') {
                const result = await query('SELECT property_decide_application($1,$2,$3,$4) AS invitation_id',
                    [id, actor.issuer, mode === 'reject' ? 'rejected' : 'revoked', actor.id]);
                let mailRevoked = true;
                if (result[0]?.invitation_id) {
                    try { await (deps.clerk || invitationClient)().invitations.revokeInvitation(result[0].invitation_id); }
                    catch { mailRevoked = false; }
                }
                return res.status(200).json({ ok: true, message: mailRevoked ? 'Access withdrawn.' : 'Access withdrawn. The email link could not be revoked, but it cannot activate property access.' });
            }
            return res.status(400).json({ error: 'unknown_mode' });
        } catch (error) { return sendAccessError(res, error); }
    };
}
export default createApplicationsHandler();
