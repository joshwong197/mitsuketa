// Per-user credentials for the property feature, held one-per-environment-variable.
// (Fictional example — real values live only in the deployment environment.)
//
//   PROPERTY_PW_JANE_DOE_FBU_COM = not-a-real-password
//
// ONE VARIABLE PER USER, deliberately. The obvious alternative — a single
// PROPERTY_USERS="a:pw,b:pw" blob — fails the requirement that resetting one
// password must not touch anyone else's: you would have to rewrite the whole
// string, from memory if the variable is marked Sensitive, and one slip locks a
// colleague out. Here, add / reset / revoke each touch exactly one variable.
//
// The value is the PASSWORD ITSELF, so it can be set and changed straight from
// the Vercel dashboard with no tooling in the loop. The trade is real and worth
// naming: anyone who can read the environment — a teammate, a screen share, an
// account compromise — reads the passwords. That is acceptable for purpose-made
// credentials used only here, and not acceptable for a password reused
// elsewhere.
//
// A value of the form `scrypt.<salt>.<key>` is still accepted and verified as a
// hash, so credentials minted by the earlier tooling keep working and hashing
// can be reintroduced per-user without a migration.

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
 *   jane.doe@fbu.com -> PROPERTY_PW_JANE_DOE_FBU_COM
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

/** The stored credential for a username, or null. Password or hash — this IS the secret. */
export function storedCredential(username: string, env: NodeJS.ProcessEnv = process.env): string | null {
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

/** Constant-time equality for plaintext, via digests so lengths always match. */
function sameString(a: string, b: string): boolean {
    return timingSafeEqual(
        createHash('sha256').update(a).digest(),
        createHash('sha256').update(b).digest());
}

const isHashed = (stored: string): boolean => /^scrypt[.$]/.test(stored);

/**
 * Verifies a supplied password against whatever is stored — the password itself,
 * or a scrypt hash if the value looks like one. Never throws.
 */
export function verifyCredential(password: string, stored: string): boolean {
    if (!password || !stored) return false;
    return isHashed(stored) ? verifyPassword(password, stored) : sameString(password, stored);
}

export function authenticate(username: string, password: string, env: NodeJS.ProcessEnv = process.env): boolean {
    const stored = storedCredential(username, env);
    // Compare against a decoy when the account does not exist, so that a missing
    // account and a wrong password cannot be told apart by response timing.
    if (!stored) { sameString(password || '', randomBytes(16).toString('hex')); return false; }
    return verifyCredential(password, stored);
}

/**
 * Session-signing key for a user, derived from their stored credential — the
 * credential itself never leaves the server, and this derived value is what
 * signs the cookie.
 *
 * This is what makes a reset isolated. Change one person's password and their
 * signing secret changes with it, so their existing cookie stops verifying and
 * they — and only they — are signed out. Everyone else's sessions are untouched.
 */
export function userSessionSecret(stored: string): string {
    return createHash('sha256').update(`mitsuketa-property-user-v1:${stored}`).digest('base64url');
}
