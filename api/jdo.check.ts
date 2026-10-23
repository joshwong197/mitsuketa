import assert from 'node:assert/strict';
import { jdoPhrase, jdoPhrases, jdoSearchUrl, judgmentTime, mergeLookups } from './jdo';

assert.equal(jdoPhrase('  Ritesh   Mani '), 'Ritesh Mani');
assert.equal(jdoPhrase('"Ritesh Mani"'), 'Ritesh Mani', 'user quotes are stripped, we add our own');
assert.equal(jdoPhrase('Mani'), null, 'a lone surname is refused');
assert.equal(jdoPhrase(['Ritesh Mani']), null);
const terms = (phrases: string[]) => new URL(jdoSearchUrl(phrases)).searchParams;
assert.equal(terms(jdoPhrases('Ritesh Mani', 'person')).get('searchTerms'), '"Ritesh Mani"', 'phrase must be quoted in full text');
assert.equal(terms(['Ritesh Mani']).get('caseName'), '', 'case-name field stays empty');
assert.deepEqual(jdoPhrases('ECO-SMART GROUP LIMITED', 'company'), ['ECO-SMART GROUP Limited', 'ECO-SMART GROUP Ltd']);
assert.deepEqual(jdoPhrases('Acme Ltd.', 'company'), ['Acme Limited', 'Acme Ltd']);
assert.deepEqual(jdoPhrases('Ritesh Limited', 'person'), ['Ritesh Limited'], 'suffix expansion is company-only');
assert.equal(terms(jdoPhrases('ASCCN (21) LIMITED', 'company')).get('searchTerms'), '"ASCCN (21) Limited" OR "ASCCN (21) Ltd"');

assert.equal(judgmentTime('X v Y [2025] NZHC 3639 [27 November 2025]'), Date.parse('27 November 2025'));
assert.equal(judgmentTime('CIR V MANI HC AK CIV 2010-404-001918  29 September 2010'), Date.parse('29 September 2010'));
assert.equal(judgmentTime('No date here'), 0);

const old = { title: 'Old [1 May 2016]', url: 'u1' }, shared = { title: 'Shared [1 May 2025]', url: 'u2' };
const merged = mergeLookups([
    { name: 'NEW LIMITED', current: true, phrases: [], status: 'ok', count: 1, results: [shared] },
    { name: 'OLD LIMITED', current: false, phrases: [], status: 'ok', count: 2, results: [old, shared] },
    { name: 'GONE LIMITED', current: false, phrases: [], status: 'unavailable' },
]);
assert.equal(merged.count, 2, 'a decision matched by two names is counted once');
assert.deepEqual(merged.results.map(r => r.url), ['u2', 'u1'], 'newest first');
assert.deepEqual(merged.results[0].matched, ['NEW LIMITED', 'OLD LIMITED']);
assert.equal(merged.capped, false);
assert.equal(mergeLookups([{ name: 'A B', current: true, phrases: [], status: 'ok', count: 50, results: [] }]).capped, true);
console.log('PASS: JDO phrases, query shape, judgment dates and per-name merge.');
