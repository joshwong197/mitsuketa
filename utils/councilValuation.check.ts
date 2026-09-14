import assert from 'node:assert/strict';
import { councilSourceFor, lookupCouncilRating, type ResolvedPropertyAddress } from './councilValuation.ts';

assert.equal(councilSourceFor('Waimakariri District')?.council, 'Waimakariri District Council');
assert.equal(councilSourceFor('Palmerston North City')?.adapter, 'horizons');
assert.equal(councilSourceFor('Queenstown-Lakes District')?.council, 'Queenstown Lakes District Council');
assert.equal(councilSourceFor('Auckland')?.officialUrl.includes('aucklandcouncil.govt.nz'), true);
assert.equal(councilSourceFor('Unknown authority'), null);

const base: ResolvedPropertyAddress = {
    full_address: '215 High Street, Rangiora 7400',
    territorial_authority: 'Waimakariri District',
    longitude: 172.593, latitude: -43.303,
};

let requested = '';
const waimakaririFetch: typeof fetch = async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({ features: [{ attributes: {
        LOCATION: '215 HIGH STREET RANGIORA', VNZ: '21700/12300', PROPERTY_NO: 123,
        CapitalValue: 920000, LANDVALUE: 410000, ImprovementsValue: 510000,
        VALNDATE: Date.UTC(2022, 7, 1),
    } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
};
const wdc = await lookupCouncilRating(base, waimakaririFetch);
assert.equal(wdc?.status, 'matched');
assert.equal(wdc?.capitalValue, 920000);
assert.equal(wdc?.landValue, 410000);
assert.equal(wdc?.improvementsValue, 510000);
assert.equal(wdc?.valuationNumber, '21700/12300');
assert.ok(requested.includes('inSR=4326'));
assert.ok(requested.includes('distance=120'));

const horizonsFetch: typeof fetch = async () => new Response(JSON.stringify({ features: [{ attributes: {
    VnzLocation: '10 THE SQUARE PALMERSTON NORTH', ValuationNumber: '12345/67800',
    VnzCapitalValue: 1000000, VnzLandValue: 300000,
    TerritorialAuthority: 'Palmerston North City',
    RatesSearchLink: 'https://example.govt.nz/rates/12345',
    DataLastUpdated: Date.UTC(2026, 8, 1),
} }] }), { status: 200, headers: { 'content-type': 'application/json' } });
const horizons = await lookupCouncilRating({
    ...base, full_address: '10 The Square, Palmerston North 4410',
    territorial_authority: 'Palmerston North City',
}, horizonsFetch);
assert.equal(horizons?.status, 'matched');
assert.equal(horizons?.improvementsValue, 700000);
assert.equal(horizons?.officialUrl, 'https://example.govt.nz/rates/12345');

let linkFetches = 0;
const linkOnly = await lookupCouncilRating({ ...base, territorial_authority: 'Auckland' }, async () => {
    linkFetches++;
    throw new Error('should not fetch');
});
assert.equal(linkOnly?.status, 'link_only');
assert.equal(linkFetches, 0);

const failed = await lookupCouncilRating(base, async () => { throw new Error('offline'); });
assert.equal(failed?.status, 'link_only');
assert.match(failed?.note ?? '', /unavailable/);

console.log('ok - council valuation routing, licensed adapters and safe fallback');
