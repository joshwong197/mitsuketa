import assert from 'node:assert/strict';
import { searchEntities } from './apiService';
import type { ApiConfig, EntitySearchResultItem } from '../types';

const config = { nzbnKey: 'test', companiesKey: 'test' } as ApiConfig;
const CREDIT: EntitySearchResultItem = {
    nzbn: '9429042783640', entityName: 'THE NEW ZEALAND CREDIT AND FINANCE INSTITUTE INCORPORATED',
    entityStatusDescription: 'Registered', entityTypeCode: 'I', entityTypeDescription: 'Incorporated Society',
};
let calls: { term: string; page: string | null }[] = [];

function stub(results: (term: string) => EntitySearchResultItem[], totalItems = 1) {
    calls = [];
    globalThis.fetch = (async (url: string) => {
        const path = new URL(url, 'http://local').searchParams.get('path') || '';
        const parsed = new URL(path, 'http://local');
        const term = parsed.searchParams.get('search-term') || '';
        calls.push({ term, page: parsed.searchParams.get('page') });
        return { ok: true, status: 200, statusText: 'OK', json: async () => ({ pageSize: 10, page: Number(parsed.searchParams.get('page')), totalItems, items: results(term) }) } as Response;
    }) as typeof fetch;
}

async function main() {
    // Required live-register example represented as a deterministic proxy check:
    // partial phrase, ampersand spelling and NZBN all keep the same record.
    stub(term => term === '"THE NEW ZEALAND CREDIT"' ? [CREDIT] : []);
    let data = await searchEntities('  THE   NEW ZEALAND   CREDIT ', config);
    assert.deepEqual(data.items.map(item => item.nzbn), ['9429042783640']);
    assert.deepEqual(calls, [{ term: '"THE NEW ZEALAND CREDIT"', page: '0' }]);

    // The NZBN search index is case-insensitive; preserve the user's casing in
    // requests while making the proxy fixture model that documented behaviour.
    stub(term => term.toUpperCase() === '"CREDIT & FINANCE"' ? [CREDIT] : []);
    data = await searchEntities('credit and finance', config);
    assert.deepEqual(data.items.map(item => item.nzbn), ['9429042783640']);
    assert.deepEqual(calls.map(call => call.term), ['"credit AND finance"', '"credit & finance"']);

    stub(term => term.toUpperCase() === 'CREDIT FINANCE INSTITUTE' ? [CREDIT] : []);
    data = await searchEntities('credit finance institute', config, undefined, 3);
    assert.deepEqual(data.items.map(item => item.nzbn), ['9429042783640']);
    assert.deepEqual(calls, [
        { term: '"credit finance institute"', page: '3' },
        { term: 'credit finance institute', page: '3' },
    ]);
    assert.equal(data.page, 3);

    stub(term => term === '9429042783640' ? [CREDIT, CREDIT] : []);
    data = await searchEntities('9429 0427-8364 0', config);
    assert.deepEqual(calls.map(call => call.term), ['9429042783640']);
    assert.deepEqual(data.items.map(item => item.nzbn), ['9429042783640']);

    const exact = { ...CREDIT, nzbn: '1', entityName: 'CREDIT AND FINANCE' };
    const prefix = { ...CREDIT, nzbn: '2', entityName: 'CREDIT AND FINANCE SERVICES' };
    const loose = { ...CREDIT, nzbn: '3', entityName: 'THE CREDIT AND FINANCE GROUP' };
    stub(() => [loose, prefix, exact, exact]);
    data = await searchEntities('credit & finance', config);
    assert.deepEqual(data.items.map(item => item.nzbn), ['1', '2', '3']);

    console.log('PASS: partial, ampersand, numeric identifier, bounded fallback, de-duplication and page-coherent entity search');
}

main();
