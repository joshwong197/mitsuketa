// Property search — LINZ Title Register, gated to the team.
//
//   POST /api/property?mode=login                  { searcher, password }
//   GET  /api/property?mode=address&q=&ref=[&address_id=]
//   GET  /api/property?mode=owner&q=&ref=
//   GET  /api/property?mode=title&title_no=&ref=
//   GET  /api/property?mode=tile&z=&x=&y=
//   POST /api/property?mode=logout
//
// This endpoint returns RESTRICTED personal data — the names of registered
// owners, mortgagees and caveators — supplied under the LINZ Licence for
// Personal Data. Three things follow, and none of them are optional:
//
//   1. It FAILS CLOSED. No credential configured means nobody gets in,
//      rather than everybody.
//   2. The LINZ key never leaves the server. The browser talks to this handler.
//   3. Every search is logged with the reference the searcher supplied.
//
// AUTH has two modes, and per-user wins whenever it is configured:
//
//   per-user  PROPERTY_PW_<SLUG> — one variable each (utils/propertyUsers.ts).
//             Sign in with an email address and that person's own password.
//   shared    PROPERTY_PASS — the original single credential, kept only so a
//             deployment that has not been migrated still works. It is IGNORED
//             the moment any PROPERTY_PW_* exists, because leaving both live
//             would make the shared password a standing bypass around per-user
//             revocation.
//
// The session secret is derived from the credential, so changing it invalidates
// existing sessions — otherwise rotating a leaked password buys nothing until
// the old cookies expire. In per-user mode that isolation is per-person:
// resetting one password signs out that person alone.
//
// Identity is still a shared secret, not proof — nothing here verifies that the
// person typing an address owns that mailbox. The audit log records
// `verified: false` accordingly. See design/PROPERTY_ACCESS_PLAN.md §3.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { add } from '../utils/audit.js';
import { authenticate, configuredUserKeys, envKeyFor, hasUsers, storedHash, userSessionSecret } from '../utils/propertyUsers.js';
import {
    LDSClient, searchAddress, searchOwner, titleReport,
} from '../utils/lds.js';

// LINZ Basemaps aerial imagery, CC BY 4.0. Proxied rather than hit from the
// browser for the same reason as every other LINZ call: the key stays here.
// Basemaps issues its own key; LINZ_BASEMAPS_KEY is preferred and LINZ_API_KEY
// is the fallback, so a deployment with one key still renders a map.
const BASEMAPS = 'https://basemaps.linz.govt.nz/v1/tiles/aerial';
const TILE_MAX_ZOOM = 22;
const TILE_TIMEOUT_MS = 8_000;

const COOKIE = 'mitsuketa_property';
const SESSION_HOURS = 12;
const MAX_QUERY = 200;
const MAX_REFERENCE = 100;

// --------------------------------------------------------------------------- //
// Login throttle
// --------------------------------------------------------------------------- //
//
// scrypt makes one guess cost ~80ms, which is not on its own a defence: an
// attacker running requests in parallel still gets hundreds of attempts a
// second, and this endpoint is reachable by anyone holding the deployment URL.
//
// Counted per account AND per IP, with very different limits, because the two
// are guarding different things and a shared limit gets one of them wrong:
//
//   account (10) — stops someone grinding away at one person's password from
//                  anywhere. Tight, because ten failures is already a lot of
//                  typos.
//   IP     (100) — stops a broad scripted sweep. Deliberately loose, because a
//                  whole office usually shares one public address: a tight IP
//                  limit means one colleague fat-fingering their password locks
//                  out everybody, which testing here duly demonstrated.
//
// ponytail: module-scope Map, so the window is per warm serverless instance
// rather than global. Best-effort, not a guarantee — it stops scripted guessing
// without needing a shared store, and a real limiter belongs with the Postgres
// work in utils/audit.ts.
const FAILURE_WINDOW_MS = 15 * 60_000;
const ACCOUNT_LIMIT = 10;
const IP_LIMIT = 100;

interface Bucket { key: string; limit: number }
const failures = new Map<string, { count: number; until: number }>();

function throttled(buckets: Bucket[], now = Date.now()): boolean {
    return buckets.some(({ key, limit }) => {
        const hit = failures.get(key);
        return !!hit && now < hit.until && hit.count >= limit;
    });
}

function recordFailure(buckets: Bucket[], now = Date.now()): void {
    // Opportunistic sweep — the map only ever holds keys seen recently.
    if (failures.size > 500) {
        for (const [k, v] of failures) if (now >= v.until) failures.delete(k);
    }
    for (const { key } of buckets) {
        const hit = failures.get(key);
        if (!hit || now >= hit.until) failures.set(key, { count: 1, until: now + FAILURE_WINDOW_MS });
        else hit.count++;
    }
}

/**
 * Clears the ACCOUNT bucket only. The IP bucket is left to expire on its own so
 * that holding one valid account cannot be used to keep resetting the address's
 * budget while guessing at everyone else's.
 */
function clearAccountFailures(searcher: string): void {
    failures.delete(`user:${searcher}`);
}

// --------------------------------------------------------------------------- //
// Session
// --------------------------------------------------------------------------- //

// `secret` is the shared password in legacy mode, or the per-user session secret
// derived from that user's stored hash — never a plaintext password in per-user
// mode, and never anything the browser sees in either.
function sessionKey(secret: string): Buffer {
    return createHmac('sha256', secret).update('mitsuketa-property-session-v1').digest();
}

function sign(payload: string, secret: string): string {
    return createHmac('sha256', sessionKey(secret)).update(payload).digest('base64url');
}

/** Compare via digests so the buffers are always the same length. */
function sameSecret(a: string, b: string): boolean {
    return timingSafeEqual(
        createHash('sha256').update(a).digest(),
        createHash('sha256').update(b).digest());
}

function issueCookie(searcher: string, secret: string, secure: boolean): string {
    const exp = Date.now() + SESSION_HOURS * 3600_000;
    // The searcher name rides inside the signed payload so it cannot be edited.
    const payload = `${exp}.${Buffer.from(searcher).toString('base64url')}`;
    const value = `${payload}.${sign(payload, secret)}`;
    // No Max-Age/Expires: a session cookie, so the browser drops it when the
    // browser session ends. The signed exp above is still enforced server-side —
    // the cookie lifetime is the browser's promise, the exp is ours.
    const flags = ['HttpOnly', 'Path=/', 'SameSite=Lax'];
    if (secure) flags.push('Secure');
    return `${COOKIE}=${value}; ${flags.join('; ')}`;
}

interface Session { searcher: string }

/**
 * Verifies the cookie against whichever secret issued it.
 *
 * In per-user mode the signing secret is derived from that user's stored hash,
 * so it has to be looked up from the identity inside the payload — which is
 * safe, because the signature is what proves the payload was not edited. A
 * cookie naming a user who no longer exists simply fails to verify, which is
 * how revocation takes effect immediately rather than at cookie expiry.
 */
function readSession(req: VercelRequest, sharedPassword: string): Session | null {
    const raw = req.cookies?.[COOKIE];
    if (!raw) return null;
    const parts = raw.split('.');
    if (parts.length !== 3) return null;
    const [exp, who, sig] = parts;

    let searcher: string;
    try {
        searcher = Buffer.from(who, 'base64url').toString('utf8');
    } catch {
        return null;
    }

    let secret: string;
    if (hasUsers()) {
        const stored = storedHash(searcher);
        if (!stored) return null; // user removed, or a forged identity
        secret = userSessionSecret(stored);
    } else {
        secret = sharedPassword;
    }

    const payload = `${exp}.${who}`;
    if (!sameSecret(sig, sign(payload, secret))) return null;
    const expiry = Number(exp);
    if (!Number.isFinite(expiry) || Date.now() > expiry) return null;
    return { searcher };
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
    //
    // Which variable is missing goes to the server log, never to the client —
    // config state is not the public's business. Note that Vercel binds env
    // vars at BUILD time, so a deployment built before a variable was added
    // will land here until it is redeployed. Check `vercel logs <url>`.
    const perUser = hasUsers();
    const missing = [
        !perUser && !password && 'PROPERTY_PASS (or any PROPERTY_PW_*)',
        !process.env.LINZ_API_KEY && 'LINZ_API_KEY',
    ].filter(Boolean);
    if (missing.length > 0) {
        console.error(`[property] disabled — not set on this deployment: ${missing.join(', ')}`
            + ' (env vars bind at build time; redeploy after adding them)');
        return res.status(503).json({
            error: 'not_configured',
            message: 'Property search is not enabled on this deployment.',
        });
    }

    const secure = (req.headers['x-forwarded-proto'] as string) !== 'http';

    if (mode === 'login') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

        // Which mode is live, and which accounts exist. Without this, "the
        // deployment cannot see any PROPERTY_PW_* variable" and "everyone typed
        // the wrong password" are indistinguishable from the browser — they were
        // once, and the shared password quietly answering for one account is
        // exactly what that looks like. Names only; hashes are never logged.
        const keys = configuredUserKeys();
        console.log(`[property] auth mode=${perUser ? 'per-user' : 'shared'}`
            + ` credentials=${keys.length}${keys.length ? ` [${keys.join(', ')}]` : ''}`
            + `${perUser && password ? ' (PROPERTY_PASS present but ignored)' : ''}`);
        const body = (req.body ?? {}) as Record<string, unknown>;
        const supplied = str(body.password);
        const searcher = str(body.searcher).slice(0, 120).toLowerCase();
        if (!searcher) {
            return res.status(400).json({
                error: 'searcher_required',
                message: perUser
                    ? 'Enter your work email address.'
                    : 'Enter your name so searches can be attributed.',
            });
        }

        const throttleKeys: Bucket[] = [
            { key: `user:${searcher}`, limit: ACCOUNT_LIMIT },
            { key: `ip:${ip || 'unknown'}`, limit: IP_LIMIT },
        ];
        if (throttled(throttleKeys)) {
            await add({ action: 'refused', query: 'login-throttled', searcher, ip });
            return res.status(429).json({
                error: 'too_many_attempts',
                message: 'Too many failed sign-in attempts. Try again in 15 minutes.',
            });
        }

        // Per-user mode: the email selects the credential. Wrong password and
        // unknown account are indistinguishable to the caller, by design — the
        // response says neither which it was nor how long it took to decide.
        const ok = perUser
            ? authenticate(searcher, supplied)
            : !!supplied && sameSecret(supplied, password);

        if (!ok) {
            // Says whether the account exists at all, so a variable named wrongly
            // is distinguishable from a password typed wrongly. The slug is
            // derived from what the caller typed and reveals nothing; the client
            // still gets an undifferentiated 401.
            if (perUser && !storedHash(searcher)) {
                console.warn(`[property] no credential variable ${envKeyFor(searcher)}`
                    + ` — configured: [${configuredUserKeys().join(', ') || 'none'}]`);
            }
            recordFailure(throttleKeys);
            await add({ action: 'sign-in-failed', searcher, ip });
            return res.status(401).json({ error: 'invalid_credentials' });
        }
        clearAccountFailures(searcher);

        const stored = perUser ? storedHash(searcher) : null;
        const secret = stored ? userSessionSecret(stored) : password;
        await add({ action: 'sign-in', searcher, ip });
        res.setHeader('Set-Cookie', issueCookie(searcher, secret, secure));
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

    // Aerial tiles sit above the reference gate on purpose. A tile is imagery,
    // not a register search — it discloses nothing about a person and there is
    // nothing to account for, so requiring a matter reference per tile would be
    // noise in the audit log and would block the map on the report the search
    // already recorded.
    if (mode === 'tile') {
        const z = Number(req.query.z);
        const x = Number(req.query.x);
        const y = Number(req.query.y);
        const span = 2 ** z;
        const sane = [z, x, y].every(Number.isInteger)
            && z >= 0 && z <= TILE_MAX_ZOOM
            && x >= 0 && x < span && y >= 0 && y < span;
        if (!sane) return res.status(400).json({ error: 'bad_tile' });

        const key = process.env.LINZ_BASEMAPS_KEY || process.env.LINZ_API_KEY || '';
        let upstream: Response;
        try {
            upstream = await fetch(
                `${BASEMAPS}/3857/${z}/${x}/${y}.webp?api=${encodeURIComponent(key)}`,
                // The handler runs on a 30s budget and one report asks for a
                // dozen tiles; a hung upstream must not consume the whole thing.
                { signal: AbortSignal.timeout(TILE_TIMEOUT_MS) });
        } catch {
            console.error('[property] tile fetch failed or timed out');
            return res.status(504).json({ error: 'tile_unavailable' });
        }
        if (!upstream.ok) {
            // A missing tile is normal at the edge of coverage and stays quiet.
            // Anything else means the KEY is wrong — Basemaps issues its own
            // keys and an LDS key may not be accepted — so log the status,
            // because from the browser this only ever looks like a blank map.
            if (upstream.status !== 404) {
                console.error(`[property] basemaps returned HTTP ${upstream.status}`
                    + ` — check LINZ_BASEMAPS_KEY (an LDS key may not be valid for Basemaps)`);
            }
            return res.status(upstream.status === 404 ? 404 : 502)
                .json({ error: 'tile_unavailable' });
        }
        // Aerial imagery is immutable per tile, and it is not personal data
        // — but it is only served to a signed-in session, so the cache stays
        // private to the browser that asked.
        res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/webp');
        res.setHeader('Cache-Control', 'private, max-age=86400');
        return res.status(200).send(Buffer.from(await upstream.arrayBuffer()));
    }

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
