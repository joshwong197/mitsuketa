import { legalRelease, legalDocuments, validLegalAcceptance } from '../utils/legalAcceptance.js';
import { PRIVACY_DOCUMENT_HTML, TERMS_DOCUMENT_HTML } from '../components/legalContent.js';
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
                balance: billingEnabled() ? await balance(member.id) : 0, noticeVersion: NOTICE_VERSION, legal: legalRelease() ? legalDocuments() : null });
        }
        if (mode === 'acceptance-history' && req.method === 'GET') {
            if (!member.canAudit) throw new AccessError(403, 'forbidden', 'Administrator access is required.');
            const rows = await query('SELECT id,account_id,release,document_set,linz_version,accepted_at FROM property_legal_acceptance WHERE issuer=$1 ORDER BY accepted_at DESC LIMIT 200', [member.issuer]);
            return res.status(200).json({ rows });
        }
        if (mode === 'retention-review' && req.method === 'GET') {
            if (!member.canAudit) throw new AccessError(403, 'forbidden', 'Administrator access is required.');
            const value = process.env.PROPERTY_AUDIT_REVIEW_DAYS || '';
            if (!/^[1-9]\d{0,4}$/.test(value)) return res.status(200).json({ configured:false, automaticDeletion:false, rows:[] });
            const rows = await query(`SELECT COUNT(*)::int AS candidates, MIN(s.created_at) AS oldest
                FROM search_audit s JOIN account a ON a.id=s.account_id
                WHERE a.auth_issuer=$1 AND s.created_at < now()-($2::int * interval '1 day')
                AND NOT EXISTS(SELECT 1 FROM property_privacy_request r WHERE r.issuer=$1 AND r.status <> 'closed' AND (r.account_id=s.account_id OR r.account_id IS NULL))`, [member.issuer, Number(value)]);
            return res.status(200).json({ configured:true, reviewAfterDays:Number(value), automaticDeletion:false, scope:'Clerk-linked searches for this issuer; open requests excluded; legacy/unlinked records require separate review', rows });
        }
        if (mode === 'privacy-requests' && req.method === 'GET') {
            if (!member.canAudit) throw new AccessError(403, 'forbidden', 'Administrator access is required.');
            return res.status(200).json({ rows:await query('SELECT id,account_id,kind,reference,status,created_at,updated_at FROM property_privacy_request WHERE issuer=$1 ORDER BY created_at DESC LIMIT 200', [member.issuer]) });
        }
        if (mode === 'members' && req.method === 'GET') {
            if (!member.canAudit) throw new AccessError(403, 'forbidden', 'Administrator access is required.');
            const rows = await query('SELECT a.id,a.email,p.status,p.organisation,p.purpose,p.requested_at,p.reviewed_at '
                + 'FROM property_access p JOIN account a ON a.id=p.account_id WHERE a.auth_issuer=$1 '
                + 'AND NOT EXISTS(SELECT 1 FROM property_application x WHERE x.issuer=a.auth_issuer AND x.email=a.email) '
                + 'ORDER BY p.requested_at DESC NULLS LAST,a.created_at DESC LIMIT 200', [member.issuer]);
            return res.status(200).json({ rows });
        }
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST_required' });
        const body = req.body || {};
        if (mode === 'privacy-request') {
            if (!member.canAudit) throw new AccessError(403, 'forbidden', 'Administrator access is required.');
            const kind = text(body.kind, 30), reference = text(body.reference, 120);
            if (!['access','correction','deletion','incident','source-recall'].includes(kind) || !reference) throw new AccessError(400, 'invalid_request', 'Choose a request type and internal reference.');
            const accountId = body.accountId ? text(body.accountId,36) : null;
            if (accountId && !(await query('SELECT id FROM account WHERE id=$1 AND auth_issuer=$2', [accountId,member.issuer])).length) throw new AccessError(404,'not_found','Account not found.');
            const rows=await query('INSERT INTO property_privacy_request(issuer,account_id,kind,reference,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id',[member.issuer,accountId,kind,reference,member.id]);
            return res.status(200).json({id:rows[0].id});
        }
        if (mode === 'privacy-request-status') {
            if (!member.canAudit) throw new AccessError(403, 'forbidden', 'Administrator access is required.');
            const id=text(body.id,36), status=text(body.status,20);
            if (!['open','in-progress','closed'].includes(status)) throw new AccessError(400,'invalid_status','Choose a request status.');
            const rows=await query('UPDATE property_privacy_request SET status=$3,updated_at=now() WHERE id=$1 AND issuer=$2 RETURNING id',[id,member.issuer,status]);
            if (!rows.length) throw new AccessError(404,'not_found','Request not found.');
            return res.status(200).json({ok:true});
        }
        if (mode === 'accept-notice') {
            requireApproved(member);
            if (body.noticeVersion !== NOTICE_VERSION) throw new AccessError(400, 'notice_required', 'Read and accept the current privacy notice and terms.');
            if (legalRelease()) {
                if (!validLegalAcceptance(body)) throw new AccessError(400, 'legal_acceptance_required', 'Review the current documents and confirm each acknowledgement.');
                const docs = legalDocuments();
                await query(`WITH document AS (
                    INSERT INTO property_legal_document(document_set,terms_html,privacy_html) VALUES($4,$10,$11) ON CONFLICT DO NOTHING
                ), evidence AS (
                    INSERT INTO property_legal_acceptance(account_id,issuer,subject,document_set,release,terms_hash,privacy_hash,linz_version,linz_url)
                    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING
                ) UPDATE property_access SET accepted_notice_version=$12 WHERE account_id=$1`,
                    [member.id,member.issuer,member.subject,docs.documentSet,docs.release,docs.termsHash,docs.privacyHash,docs.linzVersion,docs.linzUrl,TERMS_DOCUMENT_HTML,PRIVACY_DOCUMENT_HTML,NOTICE_VERSION]);
            } else {
                await query('UPDATE property_access SET accepted_notice_version=$2 WHERE account_id=$1', [member.id, NOTICE_VERSION]);
            }
            return res.status(200).json({ ok: true });
        }
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
                + 'AND NOT EXISTS(SELECT 1 FROM property_application x WHERE x.issuer=a.auth_issuer AND x.email=a.email) '
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
