// Mints a property-search credential.
//
//   npm run property:user -- niteshni.swami@fbu.com
//   npm run property:user -- niteshni.swami@fbu.com --password 'chosen one'
//
// Prints the password to hand over and the environment variable to set. The
// plaintext is never written to disk and never stored anywhere — the hash in
// the environment is one-way, so if the password is lost the answer is to run
// this again, which is also how a reset works.
//
// Resetting one person changes one variable and signs out that person alone;
// see utils/propertyUsers.ts for why the session secret is derived from the hash.

import { randomBytes } from 'node:crypto';
import { envKeyFor, hashPassword } from './propertyUsers.ts';

// Ambiguous glyphs removed: these get read off a screen and typed by hand.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generatePassword(groups = 4, size = 5): string {
    const out: string[] = [];
    for (let g = 0; g < groups; g++) {
        let chunk = '';
        // rejection-free: 56 divides evenly enough that modulo bias here is
        // negligible against 4x5 characters of entropy (~113 bits).
        for (const b of randomBytes(size)) chunk += ALPHABET[b % ALPHABET.length];
        out.push(chunk);
    }
    return out.join('-');
}

const args = process.argv.slice(2);
const username = args.find(a => !a.startsWith('--'));
const pwFlag = args.indexOf('--password');
const chosen = pwFlag !== -1 ? args[pwFlag + 1] : undefined;

if (!username) {
    console.error('Usage: npm run property:user -- <email> [--password <password>]');
    process.exit(1);
}
if (pwFlag !== -1 && !chosen) {
    console.error('--password given with no value');
    process.exit(1);
}

const password = chosen || generatePassword();
const key = envKeyFor(username);
const hash = hashPassword(password);

console.log(`
  Username   ${username.trim().toLowerCase()}
  Password   ${password}${chosen ? '' : '   (generated — hand over once, not recoverable)'}

  Set this environment variable:

  ${key}
  ${hash}

  Vercel CLI equivalent:
  echo '${hash}' | vercel env add ${key} preview
`);
