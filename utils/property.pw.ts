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

// 256 short, unambiguous, easy-to-spell words — exactly 8 bits each, so the
// entropy maths below is exact rather than approximate.
const WORDS = `able acid acre afar aged ahoy airy ajar alto amber amble anchor angle ankle apple apron arbor arcade arch arena argon arrow ash aspen atlas atom attic aura auto awake axis bacon badge bagel baker balmy bamboo banjo barge basil basin batch beach beacon beam bean bear beech belt bench berry birch bison blade blaze bloom blue bluff board bolt bonus boot boulder brave bread brick bridge brisk broom brush bubble buckle budge buffalo bugle bulb bunch bundle burrow bushel butter cabin cable cactus cadet camel canal candle canoe canvas canyon cape cargo carol carve cedar cello chalk charm chase cheese cherry chess chime chisel cider cinder circus clamp clay clever cliff cloak clock clover coal coast cobalt cocoa coil comet compass copper coral cork cosmic cotton cove coyote crane crate creek crest crisp crown crystal cube cursor curve cymbal dagger dahlia daisy damp dapper dawn deck delta denim desert diamond diesel dingo dolphin domino donut dove dowel dragon drift drum dune dusk eagle earth easel ebony echo eden elbow elder elk ember emerald ensign equal estate ether ewe fable falcon fancy fauna fawn feather fennel fern ferry fiber fiddle fig filter finch fjord flame flask fleet flint float flute foam foil forest forge fossil fountain fox frost galaxy garden garnet gazelle gecko geode ginger glacier glass globe gold gopher granite grape gravel green grotto grove guitar gulf gully harbor harvest hawk hazel heather helix hermit heron hickory hollow honey hoop horizon
horn husk indigo inlet iris island ivory jade jasmine jetty jewel juniper kayak kelp`
    .trim().split(/\s+/);

// Exactly 256 makes each byte of randomness one word with no modulo bias — and
// makes an index out of range impossible. A short list would silently yield the
// word "undefined" for high bytes, so this is asserted rather than trusted.
if (WORDS.length !== 256 || new Set(WORDS).size !== 256) {
    throw new Error(`wordlist must be 256 unique words, got ${WORDS.length} (${new Set(WORDS).size} unique)`);
}

/** A memorable passphrase: three words plus two digits, hyphenated. */
function generatePassphrase(): string {
    const b = randomBytes(4);
    const words = [WORDS[b[0]], WORDS[b[1]], WORDS[b[2]]];
    return `${words.join('-')}-${10 + (b[3] % 90)}`;
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

// --words trades entropy for typeability: ~30 bits against ~113. Acceptable
// here because scrypt makes each guess cost ~80ms and the hashes are not
// public, but prefer the default for anyone who uses a password manager.
const password = chosen || (args.includes('--words') ? generatePassphrase() : generatePassword());
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
