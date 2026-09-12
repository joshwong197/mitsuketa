// Server-only identity and vetting. Provider IDs, never submitted emails, own accounts.
import { createClerkClient } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';
import type { VercelRequest } from '@vercel/node';

export const NOTICE_VERSION = '2026-09-12';
export class AccessError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
export function authMode() {
    const mode = process.env.PROPERTY_AUTH_MODE || 'password';
    if (mode !== 'password' && mode !== 'clerk') throw new AccessError(503, 'not_configured', 'Property access is not configured.');
    return mode;
}
export async function accountQuery(sql: string, params: unknown[] = []) {
    if (!process.env.DATABASE_URL) throw new AccessError(503, 'not_configured', 'Account storage is unavailable.');
    return neon(process.env.DATABASE_URL).query(sql, params);
}
export interface Member {
    id: string; searcher: string; subject: string; issuer: string; canAudit: boolean;
    status: 'pending' | 'approved' | 'rejected' | 'suspended';
    accepted_notice_version: string | null;
}
export function allowedOrigins() {
    const origins = (process.env.CLERK_AUTHORIZED_PARTIES || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!origins.length || origins.some(s => new URL(s).origin !== s)) throw new AccessError(503, 'not_configured', 'Sign-in origins are not configured.');
    return origins;
}
export function requireOrigin(req: VercelRequest) {
    if (typeof req.headers.origin !== 'string' || !allowedOrigins().includes(req.headers.origin)) {
        throw new AccessError(403, 'forbidden', 'This request origin is not allowed.');
    }
}
export async function getMember(req: VercelRequest): Promise<Member> {
    if (authMode() !== 'clerk' || !process.env.CLERK_SECRET_KEY || !process.env.CLERK_PUBLISHABLE_KEY || !process.env.CLERK_ISSUER) {
        throw new AccessError(503, 'not_configured', 'Clerk sign-in is not configured.');
    }
    const origins = allowedOrigins();
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY, publishableKey: process.env.CLERK_PUBLISHABLE_KEY });
    const headers = new Headers();
    for (const name of ['cookie', 'authorization']) {
        const value = req.headers[name];
        if (typeof value === 'string') headers.set(name, value);
    }
    // The URL comes from trusted config; headers/Host cannot expand allowed origins.
    const state = await clerk.authenticateRequest(new Request(origins[0] + '/api/property', { headers }), { authorizedParties: origins });
    const auth = state.toAuth();
    if (!auth?.userId || auth.sessionClaims?.iss !== process.env.CLERK_ISSUER) {
        throw new AccessError(401, 'unauthorised', 'Sign in to Mitsuketa.');
    }
    const user = await clerk.users.getUser(auth.userId);
    if (user.banned || user.locked) throw new AccessError(403, 'account_disabled', 'This account is not available.');
    const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId && e.verification?.status === 'verified')?.emailAddress;
    if (!email) throw new AccessError(403, 'email_unverified', 'Verify your email before requesting access.');
    // Existing email-only accounts are NOT implicitly linked. A collision fails closed.
    let rows;
    try {
        rows = await accountQuery('INSERT INTO account(email,auth_issuer,auth_subject) VALUES($1,$2,$3) '
            + 'ON CONFLICT(auth_issuer,auth_subject) DO UPDATE SET auth_subject=EXCLUDED.auth_subject RETURNING id',
        [email, process.env.CLERK_ISSUER, auth.userId]);
    } catch (error: any) {
        if (error?.code === '23505') throw new AccessError(409, 'account_link_required', 'Contact the administrator to link your existing account.');
        throw error;
    }
    const id = String(rows[0].id);
    await accountQuery('INSERT INTO property_access(account_id) VALUES($1) ON CONFLICT DO NOTHING', [id]);
    const access = (await accountQuery('SELECT status,accepted_notice_version FROM property_access WHERE account_id=$1', [id]))[0];
    const canAudit = (process.env.PROPERTY_CLERK_ADMINS || '').split(',').map(s => s.trim()).includes(auth.userId);
    return { id, searcher: email, issuer: process.env.CLERK_ISSUER, subject: auth.userId, canAudit,
        status: access.status, accepted_notice_version: access.accepted_notice_version };
}
export function requireApproved(member: Member) {
    if (member.status !== 'approved') throw new AccessError(403, 'approval_required', 'Property access requires administrator approval.');
}
export async function passBalance(accountId: string) {
    return Number((await accountQuery('SELECT COALESCE(SUM(delta),0) AS balance FROM sandbox_pass_ledger WHERE account_id=$1', [accountId]))[0].balance);
}
export function sendAccessError(res: any, error: unknown) {
    if (error instanceof AccessError) return res.status(error.status).json({ error: error.code, message: error.message });
    // Never return/log provider errors, which can include credentials or account data.
    return res.status(503).json({ error: 'account_unavailable', message: 'Account services are temporarily unavailable.' });
}
