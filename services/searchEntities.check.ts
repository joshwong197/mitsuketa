import assert from 'node:assert/strict';
import { searchEntities, searchEntitiesDeep } from './apiService';
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

    // Flagship ranking: the bare incorporated company outranks longer siblings
    // even when the register returns them first, and beats them on word count.
    const finance = { ...CREDIT, nzbn: 'f', entityName: 'FONTERRA FINANCE CORPORATION LIMITED' };
    const ingredients = { ...CREDIT, nzbn: 'i', entityName: 'FONTERRA INGREDIENTS LIMITED' };
    const limited = { ...CREDIT, nzbn: 'l', entityName: 'FONTERRA LIMITED' };
    stub(() => [finance, ingredients, limited]);
    data = await searchEntities('fonterra', config);
    assert.deepEqual(data.items.map(item => item.nzbn), ['l', 'i', 'f']);

    // Deep gather: walk several register pages of the winning query, union them,
    // and re-rank locally so an exact/prefix match buried past page 0 surfaces.
    const filler = Array.from({ length: 10 }, (_, i) => ({ ...CREDIT, nzbn: `0${i}`, entityName: `FONTERRA GROUP ${i}` }));
    const exactOnPage1 = { ...CREDIT, nzbn: 'E', entityName: 'FONTERRA' };
    const pages: Record<string, EntitySearchResultItem[]> = {
        '0': filler,
        '1': [{ ...CREDIT, nzbn: '1a', entityName: 'FONTERRA TRADING' }, exactOnPage1],
        '2': [], // register claimed 25 but the tail is empty — gather must stop here
    };
    calls = [];
    globalThis.fetch = (async (url: string) => {
        const path = new URL(url, 'http://local').searchParams.get('path') || '';
        const parsed = new URL(path, 'http://local');
        const page = parsed.searchParams.get('page') || '0';
        calls.push({ term: parsed.searchParams.get('search-term') || '', page });
        return { ok: true, status: 200, json: async () => ({ pageSize: 10, page: Number(page), totalItems: 25, items: pages[page] ?? [] }) } as Response;
    }) as typeof fetch;
    const deep = await searchEntitiesDeep('fonterra', config);
    assert.equal(deep.items.length, 12, 'unions page 0 and page 1');
    assert.equal(deep.items[0].nzbn, 'E', 'exact match from page 1 re-ranked to the top');
    assert.deepEqual(calls.map(c => c.page), ['0', '1', '2'], 'gathers up to the register total, stops on the empty tail');

    console.log('PASS: partial, ampersand, numeric identifier, bounded fallback, de-duplication, page-coherent and deep-gather entity search');
}

main();
