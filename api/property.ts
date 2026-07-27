// Property search — LINZ Title Register, gated to the team.
//
//   POST /api/property?mode=login                  { password, searcher? }
//   GET  /api/property?mode=address&q=&ref=[&address_id=]
//   GET  /api/property?mode=owner&q=&ref=
//   GET  /api/property?mode=title&title_no=&ref=
//   POST /api/property?mode=logout
//
// This endpoint returns RESTRICTED personal data — the names of registered
// owners, mortgagees and caveators — supplied under the LINZ Licence for
// Personal Data. Three things follow, and none of them are optional:
//
//   1. It FAILS CLOSED. No PROPERTY_PASS configured means nobody gets in,
//      rather than everybody.
//   2. The LINZ key never leaves the server. The browser talks to this handler.
//   3. Every search is logged with the reference the searcher supplied.
//
// The session secret is derived from the password itself, so changing
// PROPERTY_PASS invalidates every existing session — otherwise rotating a leaked
// credential buys nothing until the old cookies expire.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { add } from '../utils/audit.js';
import {
    LDSClient, searchAddress, searchOwner, titleReport,
} from '../utils/lds.js';

const COOKIE = 'mitsuketa_property';
const SESSION_HOURS = 12;
const MAX_QUERY = 200;
const MAX_REFERENCE = 100;

// --------------------------------------------------------------------------- //
// Session
// --------------------------------------------------------------------------- //

function sessionKey(password: string): Buffer {
    return createHmac('sha256', password).update('mitsuketa-property-session-v1').digest();
}

function sign(payload: string, password: string): string {
    return createHmac('sha256', sessionKey(password)).update(payload).digest('base64url');
}

/** Compare via digests so the buffers are always the same length. */
function sameSecret(a: string, b: string): boolean {
    return timingSafeEqual(
        createHash('sha256').update(a).digest(),
        createHash('sha256').update(b).digest());
}

function issueCookie(searcher: string, password: string, secure: boolean): string {
    const exp = Date.now() + SESSION_HOURS * 3600_000;
    // The searcher name rides inside the signed payload so it cannot be edited.
    const payload = `${exp}.${Buffer.from(searcher).toString('base64url')}`;
    const value = `${payload}.${sign(payload, password)}`;
    // No Max-Age/Expires: a session cookie, so the browser drops it when the
    // browser session ends. The signed exp above is still enforced server-side —
    // the cookie lifetime is the browser's promise, the exp is ours.
    const flags = ['HttpOnly', 'Path=/', 'SameSite=Lax'];
    if (secure) flags.push('Secure');
    return `${COOKIE}=${value}; ${flags.join('; ')}`;
}

interface Session { searcher: string }

function readSession(req: VercelRequest, password: string): Session | null {
    const raw = req.cookies?.[COOKIE];
    if (!raw) return null;
    const parts = raw.split('.');
    if (parts.length !== 3) return null;
    const [exp, who, sig] = parts;
    const payload = `${exp}.${who}`;
    if (!sameSecret(sig, sign(payload, password))) return null;
    const expiry = Number(exp);
    if (!Number.isFinite(expiry) || Date.now() > expiry) return null;
    try {
        return { searcher: Buffer.from(who, 'base64url').toString('utf8') };
    } catch {
        return null;
    }
}

// --------------------------------------------------------------------------- //
// Handler
// --------------------------------------------------------------------------- //

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const password = process.env.PROPERTY_PASS || '';
    const mode = str(req.query.mode);
    const ip = (req.headers['x-forwarded-for'] as string) || undefined;

    // Fail closed: an unconfigured feature is an unreachable one.
    if (!password) {
        return res.status(503).json({
            error: 'not_configured',
            message: 'Property search is not enabled on this deployment.',
        });
    }
    if (!process.env.LINZ_API_KEY) {
        return res.status(503).json({
            error: 'not_configured',
            message: 'Property search is not enabled on this deployment.',
        });
    }

    const secure = (req.headers['x-forwarded-proto'] as string) !== 'http';

    if (mode === 'login') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const body = (req.body ?? {}) as Record<string, unknown>;
        const supplied = str(body.password);
        const searcher = str(body.searcher).slice(0, 80);
        // A shared credential cannot prove who is searching, so the name is the
        // only attribution the audit log gets. Required, even though unverified.
        if (!searcher) {
            return res.status(400).json({
                error: 'searcher_required',
                message: 'Enter your name so searches can be attributed.',
            });
        }
        if (!supplied || !sameSecret(supplied, password)) {
            await add({ action: 'sign-in-failed', searcher: searcher || undefined, ip });
            return res.status(401).json({ error: 'invalid_credentials' });
        }
        await add({ action: 'sign-in', searcher: searcher || undefined, ip });
        res.setHeader('Set-Cookie', issueCookie(searcher, password, secure));
        return res.status(200).json({ ok: true, searcher });
    }

    if (mode === 'logout') {
        const flags = ['HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
        if (secure) flags.push('Secure');
        res.setHeader('Set-Cookie', `${COOKIE}=; ${flags.join('; ')}`);
        return res.status(200).json({ ok: true });
    }

    const session = readSession(req, password);
    if (!session) {
        await add({ action: 'refused', query: mode, ip });
        return res.status(401).json({ error: 'unauthorised' });
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });

    // The reference is the accountability record — a shared credential cannot
    // say who searched, so it must at least say what for.
    const reference = str(req.query.ref).slice(0, MAX_REFERENCE);
    if (!reference) {
        return res.status(400).json({
            error: 'reference_required',
            message: 'Enter a file or matter reference for this search.',
        });
    }

    const query = str(req.query.q).slice(0, MAX_QUERY);
    const base = { reference, searcher: session.searcher, ip };

    try {
        const client = new LDSClient();

        if (mode === 'address') {
            const rawId = str(req.query.address_id);
            let addressId: number | undefined;
            if (rawId) {
                const parsed = Number(rawId);
                if (!Number.isInteger(parsed) || parsed < 0) {
                    return res.status(400).json({ error: 'bad_address_id' });
                }
                addressId = parsed;
            }
            if (!query && addressId === undefined) {
                return res.status(400).json({ error: 'query_required' });
            }
            await add({ ...base, action: 'search-address', query: query || `address_id=${addressId}` });
            return res.status(200).json(await searchAddress(client, query, addressId));
        }

        if (mode === 'owner') {
            if (!query) return res.status(400).json({ error: 'query_required' });
            await add({ ...base, action: 'search-owner', query });
            return res.status(200).json(await searchOwner(client, query));
        }

        if (mode === 'title') {
            const titleNo = str(req.query.title_no).slice(0, MAX_QUERY);
            if (!titleNo) return res.status(400).json({ error: 'title_no_required' });
            await add({ ...base, action: 'report-opened', query: titleNo });
            return res.status(200).json(await titleReport(client, titleNo));
        }

        return res.status(400).json({ error: 'unknown_mode' });
    } catch (err: any) {
        // Belt and braces: LDSClient already strips the URL from its errors, but
        // anything logged here gets the key scrubbed regardless of its source.
        const safe = String(err?.message ?? 'error').replace(/;key=[^/\s]+/g, ';key=REDACTED');
        console.error('Property search error:', safe);
        return res.status(502).json({ error: 'upstream_failed' });
    }
}
