import { randomBytes } from 'node:crypto';
import { createClerkClient } from '@clerk/backend';
import { AccessError, accountQuery, allowedOrigins, type Member } from './propertyAccount.js';

export function invitationRedirect() {
    const origin = process.env.PROPERTY_APP_ORIGIN;
    if (!origin || !allowedOrigins().includes(origin)) throw new AccessError(503, 'not_configured', 'The invitation destination is not configured.');
    return `${origin}/?access=invite`;
}
export function invitationClient() {
    if (!process.env.CLERK_SECRET_KEY) throw new AccessError(503, 'not_configured', 'Invitations are not configured.');
    return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
}
export function createInvitationService(query = accountQuery, client = invitationClient) {
    return async (id: string, member: Member, resend = false) => {
        if (!member.canAudit) throw new AccessError(403, 'forbidden', 'Administrator access is required.');
        const redirectUrl = invitationRedirect();
        const clerk = client();
        // A lease prevents concurrent admin clicks from dispatching duplicate mail.
        const rows = await query(`UPDATE property_application SET send_lease_until=now()+interval '2 minutes'
            WHERE id=$1 AND issuer=$2 AND status IN ('pending','approved')
              AND (send_lease_until IS NULL OR send_lease_until < now()) RETURNING *`, [id, member.issuer]);
        if (!rows.length) throw new AccessError(409, 'invite_unavailable', 'This application is active, closed, or already being processed.');
        let application = rows[0];
        try {
            if (application.invitation_state === 'sent' && !resend) return { ok: true, invitationState: 'sent' };
            const users = await clerk.users.getUserList({ emailAddress: [application.email] });
            if (users.totalCount > 1) throw new AccessError(409, 'account_link_required', 'Review the existing Clerk identities before inviting.');
            const existing = users.data[0];
            if (existing && (existing.banned || existing.locked)) throw new AccessError(409, 'account_disabled', 'The existing Clerk account is disabled.');
            const accounts = await query('SELECT auth_subject,auth_issuer,p.status FROM account a LEFT JOIN property_access p ON p.account_id=a.id WHERE email=$1', [application.email]);
            if (accounts.some(a => !existing || a.auth_subject !== existing.id || a.auth_issuer !== member.issuer)) {
                throw new AccessError(409, 'account_link_required', 'This email has an existing account that requires manual identity review.');
            }
            if (accounts.some(a => ['rejected','suspended'].includes(a.status))) throw new AccessError(409, 'account_disabled', 'This account has a previous denial or suspension. Resolve that decision before inviting.');
            if (resend && application.invitation_id) {
                try { await clerk.invitations.revokeInvitation(application.invitation_id); }
                catch (e: any) { if (e.status !== 404 && !e.errors?.some((x: any) => x.code === 'invitation_already_revoked')) throw e; }
            }
            // Reuse the nonce after an ambiguous provider failure. A retry can
            // reconcile a successful send without sending a second invitation.
            const nonce = !resend && application.invite_nonce || randomBytes(32).toString('hex');
            const updated = await query(`WITH changed AS (UPDATE property_application SET status='approved',
                reviewed_at=COALESCE(reviewed_at,now()),reviewed_by=$3,invite_nonce=$4,
                expected_subject=$5,invitation_state='sending',expires_at=now()+interval '7 days'
                WHERE id=$1 AND issuer=$2 AND status IN ('pending','approved') RETURNING *)
                SELECT * FROM changed`, [id, member.issuer, member.id, nonce, existing?.id || null]);
            if (!updated.length) throw new AccessError(409, 'invite_unavailable', 'The application has been closed.');
            application = updated[0];
            await query('INSERT INTO property_application_history(application_id,action,actor) VALUES($1,$2,$3)',
                [id, resend ? 'resend' : 'approve_and_invite', member.id]);
            const pending = await clerk.invitations.getInvitationList({ query: application.email, status: 'pending', limit: 100 });
            let invitation = pending.data.find(i => i.emailAddress.toLowerCase() === application.email.toLowerCase()
                && (i.publicMetadata?.mitsuketaGrant as any)?.nonce === nonce);
            if (!invitation) invitation = await clerk.invitations.createInvitation({
                emailAddress: application.email, redirectUrl, notify: true, ignoreExisting: Boolean(existing), expiresInDays: 7,
                publicMetadata: { mitsuketaGrant: { applicationId: id, nonce } },
            });
            const sent = await query(`UPDATE property_application SET invitation_id=$3,invitation_state='sent'
                WHERE id=$1 AND issuer=$2 AND status IN ('approved','active') AND invite_nonce=$4 RETURNING id`,
                [id, member.issuer, invitation.id, nonce]);
            if (!sent.length) {
                await clerk.invitations.revokeInvitation(invitation.id);
                throw new AccessError(409, 'invite_unavailable', 'The application was closed during sending. Its access is disabled.');
            }
            return { ok: true, invitationState: 'sent' };
        } catch (error) {
            await query(`UPDATE property_application SET invitation_state='failed' WHERE id=$1 AND issuer=$2
                AND status='approved' AND invitation_state='sending'`, [id, member.issuer]);
            if (error instanceof AccessError) throw error;
            throw new AccessError(503, 'invitation_failed', 'The invitation could not be confirmed. Refresh the application list and retry.');
        } finally {
            await query('UPDATE property_application SET send_lease_until=NULL WHERE id=$1 AND issuer=$2', [id, member.issuer]);
        }
    };
}
