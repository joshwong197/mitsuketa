// Per-user credentials for the property feature, held one-per-environment-variable.
//
//   PROPERTY_PW_NITESHNI_SWAMI_FBU_COM = scrypt$<salt-hex>$<key-hex>
//
// ONE VARIABLE PER USER, deliberately. The obvious alternative — a single
// PROPERTY_USERS="a:pw,b:pw" blob — fails the requirement that resetting one
// password must not touch anyone else's: you would have to rewrite the whole
// string, from memory if the variable is marked Sensitive, and one slip locks a
// colleague out. Here, add / reset / revoke each touch exactly one variable.
//
// Passwords are never stored. The scrypt hash is what lives in the environment,
// so dashboard read access yields something unusable rather than a credential
// people have reused elsewhere.

import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

const PREFIX = 'PROPERTY_PW_';
const SCRYPT_KEYLEN = 32;
// Cost parameters. N=16384 is ~50-100ms per verify on Vercel — deliberately slow
// for a login endpoint, irrelevant at this volume.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

/**
 * Environment-variable name for a username. Usernames here are email addresses,
 * which contain characters no env var name may hold, so every run of
 * non-alphanumerics collapses to one underscore:
 *
 *   niteshni.swami@fbu.com -> PROPERTY_PW_NITESHNI_SWAMI_FBU_COM
 *
 * Forward-only by design — nothing ever needs to turn a variable name back into
 * an address, because login slugs what the user typed and looks that up. Two
 * addresses could in principle collide (a.b@x.com and a_b@x.com); the CLI warns
 * when it would, and real addresses do not.
 */
export function envKeyFor(username: string): string {
    return PREFIX + username.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase();
}

/** True when at least one per-user credential is configured. */
export function hasUsers(env: NodeJS.ProcessEnv = process.env): boolean {
    return Object.keys(env).some(k => k.startsWith(PREFIX) && !!env[k]);
}

/**
 * Configured credential variable names — NOT their values.
 *
 * For diagnostics only. A deployment silently running in shared-password mode
 * because it cannot see any PROPERTY_PW_* variable looks identical, from the
 * browser, to one where every password is wrong; this is what tells the two
 * apart in `vercel logs`. Names are derived from email addresses and hold no
 * secret, so they are safe to log — the hashes are never printed.
 */
export function configuredUserKeys(env: NodeJS.ProcessEnv = process.env): string[] {
    return Object.keys(env).filter(k => k.startsWith(PREFIX) && !!env[k]).sort();
}

/** The stored hash string for a username, or null. This IS the secret. */
export function storedHash(username: string, env: NodeJS.ProcessEnv = process.env): string | null {
    if (!username) return null;
    return env[envKeyFor(username)] || null;
}

/**
 * `scrypt.<salt-hex>.<key-hex>` for a plaintext password.
 *
 * Dot-separated, NOT the conventional `$` of PHC strings, and deliberately so:
 * dotenv expands `$name` inside a .env value, so a `scrypt$<salt>$<key>` string
 * loses its salt on the way in and every login fails with no hint as to why.
 * Vercel is unaffected — it stores values literally — but local dev is not, and
 * a credential format that breaks depending on how it was loaded is a trap.
 * Hex and dots collide with nothing.
 */
export function hashPassword(password: string): string {
    const salt = randomBytes(16);
    const key = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
    return `scrypt.${salt.toString('hex')}.${key.toString('hex')}`;
}

/**
 * Constant-time verify. False on any malformed stored value rather than throwing.
 * Accepts `$` separators too, so hashes minted before the format changed still
 * work — the label is fixed and both fields are hex, so neither is ambiguous.
 */
export function verifyPassword(password: string, stored: string): boolean {
    const parts = (stored || '').replace(/\$/g, '.').split('.');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    try {
        const salt = Buffer.from(parts[1], 'hex');
        const expected = Buffer.from(parts[2], 'hex');
        if (salt.length === 0 || expected.length !== SCRYPT_KEYLEN) return false;
        const actual = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
        return timingSafeEqual(actual, expected);
    } catch {
        return false;
    }
}

/**
 * Runs scrypt even when the user does not exist, so a missing account and a
 * wrong password take the same time. Without this, response timing tells an
 * attacker which addresses are registered.
 */
const DUMMY_HASH = hashPassword(randomBytes(16).toString('hex'));

export function authenticate(username: string, password: string, env: NodeJS.ProcessEnv = process.env): boolean {
    const stored = storedHash(username, env);
    if (!stored) { verifyPassword(password, DUMMY_HASH); return false; }
    return verifyPassword(password, stored);
}

/**
 * Session-signing key for a user: their stored hash, never the password.
 *
 * This is what makes a reset isolated. Change one person's password and their
 * stored hash changes, so their existing cookie no longer verifies and they —
 * and only they — are signed out. Everyone else's sessions continue untouched.
 */
export function userSessionSecret(stored: string): string {
    return createHash('sha256').update(`mitsuketa-property-user-v1:${stored}`).digest('base64url');
}
