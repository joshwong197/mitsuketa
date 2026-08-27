// Works out the environment variable name for a property-search account.
//
//   npm run property:user -- jane.doe@fbu.com
//
// The slug is the only non-obvious part of adding someone: the address is
// uppercased and every run of non-alphanumerics becomes one underscore, so
// jane.doe@fbu.com lives in PROPERTY_PW_JANE_DOE_FBU_COM. The VALUE is simply the
// password — set it and change it straight in the Vercel dashboard, no tooling
// in the loop.
//
// --suggest prints a password worth using for someone who has no password
// manager. Nothing is stored or transmitted; it is a suggestion, not a step.

import { randomBytes } from 'node:crypto';
import { envKeyFor } from './propertyUsers.ts';

// 256 short, unambiguous, easy-to-spell words — exactly 8 bits each.
const WORDS = `able acid acre afar aged ahoy airy ajar alto amber amble anchor angle ankle apple apron arbor arcade arch arena argon arrow ash aspen atlas atom attic aura auto awake axis bacon badge bagel baker balmy bamboo banjo barge basil basin batch beach beacon beam bean bear beech belt bench berry birch bison blade blaze bloom blue bluff board bolt bonus boot boulder brave bread brick bridge brisk broom brush bubble buckle budge buffalo bugle bulb bunch bundle burrow bushel butter cabin cable cactus cadet camel canal candle canoe canvas canyon cape cargo carol carve cedar cello chalk charm chase cheese cherry chess chime chisel cider cinder circus clamp clay clever cliff cloak clock clover coal coast cobalt cocoa coil comet compass copper coral cork cosmic cotton cove coyote crane crate creek crest crisp crown crystal cube cursor curve cymbal dagger dahlia daisy damp dapper dawn deck delta denim desert diamond diesel dingo dolphin domino donut dove dowel dragon drift drum dune dusk eagle earth easel ebony echo eden elbow elder elk ember emerald ensign equal estate ether ewe fable falcon fancy fauna fawn feather fennel fern ferry fiber fiddle fig filter finch fjord flame flask fleet flint float flute foam foil forest forge fossil fountain fox frost galaxy garden garnet gazelle gecko geode ginger glacier glass globe gold gopher granite grape gravel green grotto grove guitar gulf gully harbor harvest hawk hazel heather helix hermit heron hickory hollow honey hoop horizon
horn husk indigo inlet iris island ivory jade jasmine jetty jewel juniper kayak kelp`
    .trim().split(/\s+/);

// Asserted rather than trusted: a short list would silently yield the word
// "undefined" for high bytes, which it did at 242 words.
if (WORDS.length !== 256 || new Set(WORDS).size !== 256) {
    throw new Error(`wordlist must be 256 unique words, got ${WORDS.length}`);
}

function suggestPassword(): string {
    const b = randomBytes(4);
    return `${WORDS[b[0]]}-${WORDS[b[1]]}-${WORDS[b[2]]}-${10 + (b[3] % 90)}`;
}

const args = process.argv.slice(2);
const username = args.find(a => !a.startsWith('--'));

if (!username) {
    console.error('Usage: npm run property:user -- <email-or-username> [--suggest]');
    process.exit(1);
}

console.log(`
  Sign in as   ${username.trim().toLowerCase()}

  Vercel variable name
  ${envKeyFor(username)}

  Value        the password itself — set or change it in the dashboard
${args.includes('--suggest') ? `\n  Suggestion   ${suggestPassword()}\n` : ''}`);
