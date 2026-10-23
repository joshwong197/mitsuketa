import assert from 'node:assert/strict';
import { holdings, ultimateOwners } from './ownership';
import type { EntityProfile } from './entityProfile';

// A ← 100% B; B ← 70% C, 30% Dee; C ← 50% Eve, 50% Fay.
const co = (nzbn: string, totalShares: number, allocs: [number, { name: string; nzbn?: string }[]][]): EntityProfile => ({
    nzbn, name: nzbn, totalShares, extensive: false,
    allocations: allocs.map(([shares, hs]) => ({ shares, holders: hs.map(h => ({ name: h.name, nzbn: h.nzbn || '', number: '' })) })),
} as unknown as EntityProfile);
const reg: Record<string, EntityProfile> = {
    A: co('A', 100, [[100, [{ name: 'B Ltd', nzbn: 'B' }]]]),
    B: co('B', 10, [[7, [{ name: 'C Ltd', nzbn: 'C' }]], [3, [{ name: 'Dee' }]]]),
    C: co('C', 4, [[2, [{ name: 'Eve' }]], [1, [{ name: 'Fay' }]], [1, [{ name: 'Fay' }]]]),
};
const load = async (n: string) => { if (!reg[n]) throw new Error('missing'); return reg[n]; };

const owners = await ultimateOwners(reg.A, load);
const pct = Object.fromEntries(owners.map(o => [o.names.join('&'), Math.round(o.pct! * 10) / 10]));
assert.deepEqual(pct, { Eve: 35, Fay: 35, Dee: 30 });
assert.deepEqual(owners.find(o => o.names[0] === 'Eve')!.via.map(h => h.nzbn), ['B', 'C']);

// Merges a holder split across allocations; joint holders stay one holding.
assert.equal(holdings(reg.C).find(h => h.names[0] === 'Fay')!.pct, 50);
assert.equal(holdings(co('J', 10, [[10, [{ name: 'X' }, { name: 'Y' }]]]))[0].names.length, 2);

// Cycle A → B → A does not loop; unknown parent is marked unresolved.
reg.B2 = co('B2', 10, [[5, [{ name: 'A Ltd', nzbn: 'A' }]], [5, [{ name: 'Ghost', nzbn: 'G' }]]]);
const loop = await ultimateOwners(co('A', 1, [[1, [{ name: 'B2', nzbn: 'B2' }]]]), load);
assert.deepEqual(loop.map(o => [o.names[0], o.end]), [['Ghost', 'unresolved']]);

// Register prefixes corporate holder names with the company number.
assert.deepEqual(holdings(co('P', 1, [[1, [{ name: '1104175 - FLETCHER BUILDING LIMITED', nzbn: 'F' }]]]))[0].names, ['FLETCHER BUILDING LIMITED']);
console.log('ownership ok');
