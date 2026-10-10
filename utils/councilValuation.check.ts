import assert from 'node:assert/strict';
import { councilSourceFor, lookupCouncilRating, type ResolvedPropertyAddress } from './councilValuation.ts';

assert.equal(councilSourceFor('Waimakariri District')?.council, 'Waimakariri District Council');
assert.equal(councilSourceFor('Palmerston North City')?.adapter, 'horizons');
assert.equal(councilSourceFor('Hamilton City')?.adapter, 'waikato');
assert.equal(councilSourceFor('Christchurch City')?.adapter, 'canterbury');
assert.equal(councilSourceFor('Gisborne District')?.adapter, 'gisborne');
assert.deepEqual(councilSourceFor('Waitomo District')?.adapter, ['waikato', 'horizons']);
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
assert.equal(wdc?.improvementsValueSource, 'reported');
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
assert.equal(horizons?.improvementsValueSource, 'calculated_cv_minus_lv');
assert.equal(horizons?.officialUrl, 'https://example.govt.nz/rates/12345');

const waikato = await lookupCouncilRating({
    ...base, full_address: '685A Karioitahi Road, Waiuku', territorial_authority: 'Waikato District',
}, async () => new Response(JSON.stringify({ features: [{ attributes: {
    VG_NUMBER: '00999/00100', SITUATION_ADDRESS: '685 A KARIOITAHI ROAD',
    CAPITAL_VALUE: '$1,250,000', LAND_VALUE: '450000',
} }] }), { status: 200, headers: { 'content-type': 'application/json' } }));
assert.equal(waikato?.status, 'matched');
assert.equal(waikato?.capitalValue, 1250000);
assert.equal(waikato?.improvementsValue, 800000);
assert.equal(waikato?.improvementsValueSource, 'calculated_cv_minus_lv');
assert.equal(waikato?.sourceName, 'Waikato Regional Council');

const canterbury = await lookupCouncilRating({
    ...base, full_address: '551 Colombo Street, Christchurch', territorial_authority: 'Christchurch City',
}, async () => new Response(JSON.stringify({ features: [{ attributes: {
    LocalCouncil: 'Christchurch City Council', ValuationNo: '21970/00100',
    StreetAddress: '551 COLOMBO STREET', CapitalValue: 2100000, LandValue: 1200000,
    ImprovementsValue: 900000, PublicURL: 'https://ccc.govt.nz/property/2197000100',
    PublishDate: Date.UTC(2026, 7, 1),
} }] }), { status: 200, headers: { 'content-type': 'application/json' } }));
assert.equal(canterbury?.status, 'matched');
assert.equal(canterbury?.improvementsValue, 900000);
assert.equal(canterbury?.improvementsValueSource, 'reported');
assert.equal(canterbury?.officialUrl, 'https://ccc.govt.nz/property/2197000100');
assert.match(canterbury?.sourceName ?? '', /Canterbury Maps/);

const gisborne = await lookupCouncilRating({
    ...base, full_address: '6947 Te Araroa Road, Gisborne', territorial_authority: 'Gisborne District',
}, async () => new Response(JSON.stringify({ features: [{ attributes: {
    ASSESSMNT: '10100/00200', ValuationLocation: '6947 TE ARAROA ROAD',
    CapitalValue: 780000, LandValue: 310000, ImprovementsValue: 470000,
} }] }), { status: 200, headers: { 'content-type': 'application/json' } }));
assert.equal(gisborne?.status, 'matched');
assert.equal(gisborne?.valuationNumber, '10100/00200');
assert.equal(gisborne?.improvementsValueSource, 'reported');
assert.equal(gisborne?.sourceName, 'Gisborne District Council');

let boundaryCalls = 0;
const boundary = await lookupCouncilRating({
    ...base, full_address: 'Example Road, Waitomo', territorial_authority: 'Waitomo District',
}, async () => {
    boundaryCalls++;
    return new Response(JSON.stringify(boundaryCalls === 1 ? { features: [] } : { features: [{ attributes: {
        VnzLocation: 'EXAMPLE ROAD WAITOMO', ValuationNumber: '555', VnzCapitalValue: 600000,
        VnzLandValue: 200000, TerritorialAuthority: 'Waitomo District',
    } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
});
assert.equal(boundaryCalls, 2);
assert.equal(boundary?.status, 'matched');
assert.equal(boundary?.sourceName, 'Horizons Regional Council');

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
