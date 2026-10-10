import assert from 'node:assert/strict';
import { generateOrgChart } from './apiService.js';
import type { ApiConfig } from '../types.js';

const config: ApiConfig = { nzbnKey: '', companiesKey: '', disqualifiedDirectorsKey: '', insolvencyKey: '', includeInactive: true };
const entity = (nzbn: string, name: string, holders: any[] = [], roles: any[] = []) => ({
    nzbn, entityName: name, entityStatusDescription: 'Registered', roles,
    'company-details': { shareholding: { numberOfShares: 100, shareAllocation: holders.map(shareholder => ({ allocation: 25, shareholder: [shareholder] })) } },
});
const root = entity('111', 'ABC LIMITED', [
    { otherShareholder: { nzbn: '222', currentEntityName: 'PARENT LIMITED' } },
    { otherShareholder: { currentEntityName: 'UNLINKED TRUSTEE', companyNumber: '987654' } },
    { individualShareholder: { fullName: 'Alex Example' } },
], [{ roleType: 'Director', roleStatus: 'Active', rolePerson: { fullName: 'Alex Example' } },
    { roleType: 'Director', roleStatus: 'Active', rolePerson: { fullName: 'Sam Example' } },
    { roleType: 'Director', roleStatus: 'Inactive', rolePerson: { fullName: 'Former Director' }, endDate: '2000-01-01' }]);
const parent = entity('222', 'PARENT LIMITED', [{ otherShareholder: { nzbn: '333', currentEntityName: 'GRANDPARENT LIMITED' } }],
    [{ roleType: 'Director', roleStatus: 'Active', rolePerson: { fullName: 'Parent Director' } }]);
const fixtures: Record<string, unknown> = { '111': root, '222': parent, '333': entity('333', 'GRANDPARENT LIMITED') };
const originalFetch = globalThis.fetch;
let requests: string[] = [];
globalThis.fetch = (async (input: any) => {
    const url = new URL(String(input), 'http://fixture.test');
    const path = url.searchParams.get('path') || '';
    requests.push(path);
    const id = path.match(/\/entities\/(\d+)$/)?.[1];
    if (id && fixtures[id]) return new Response(JSON.stringify(fixtures[id]), { status: 200 });
    if (path.includes('/entities?')) return new Response(JSON.stringify({ items: [], totalItems: 0 }), { status: 200 });
    if (path.includes('/search?')) return new Response(JSON.stringify({ roles: [] }), { status: 200 });
    throw new Error(`Unexpected request: ${path}`);
}) as typeof fetch;
try {
    const simple = await generateOrgChart('111', { ...config, companySearchScope: 'simple' });
    assert.equal(requests.length, 1, 'Simple must fetch only the target record during graph discovery');
    assert.deepEqual(simple.nodes.map(n => n.data.label).sort(), ['ABC LIMITED', 'PARENT LIMITED', 'UNLINKED TRUSTEE', 'Alex Example', 'Sam Example'].sort());
    assert.ok(simple.edges.every(e => e.target === '111'), 'All relationships must be immediate');
    assert.equal(simple.nodes.filter(n => n.data.label === 'Alex Example').length, 1, 'Dual-role person must be deduplicated');
    assert.match(simple.edges.find(e => e.data?.roleKind === 'both')?.data?.label || '', /25%/);
    assert.equal(simple.nodes.find(n => n.data.isTarget)?.data.companySearchScope, 'simple');
    requests = [];
    let previewCount = 0;
    let previewJson = '';
    let previewGraph: Awaited<ReturnType<typeof generateOrgChart>> | undefined;
    const full = await generateOrgChart('111', config, undefined, undefined, undefined, preview => {
        previewCount++;
        assert.equal(requests.length, 1, 'Preview must use the root payload, without additional API calls');
        assert.deepEqual(preview.nodes.map(n => n.id).sort(), simple.nodes.map(n => n.id).sort());
        previewGraph = preview;
        previewJson = JSON.stringify(preview);
    });
    assert.equal(previewCount, 1, 'Publish one stable immediate preview');
    assert.equal(JSON.stringify(previewGraph), previewJson, 'The comprehensive crawl must not mutate the preview');
    assert.equal(requests.filter(p => /\/entities\/111$/.test(p)).length, 1, 'Preview must not refetch the root');
    assert.ok(full.nodes.some(n => n.id === '333'), 'Default Comprehensive must still follow upstream ownership');
    assert.ok(full.nodes.some(n => n.data.label === 'Parent Director'));
    assert.ok(full.nodes.some(n => n.data.label === 'Former Director'), 'Comprehensive retains historical roles');
    assert.ok(requests.some(p => p.includes('/search?')), 'Comprehensive must still discover downstream holdings');
    assert.equal(full.nodes.find(n => n.data.isTarget)?.data.companySearchScope, 'comprehensive');
    fixtures['444'] = entity('444', 'SOLE COMPANY');
    const empty = await generateOrgChart('444', { ...config, companySearchScope: 'simple' });
    assert.equal(empty.nodes.length, 1);
    assert.equal(empty.edges.length, 0);
    for (const [index, type, role] of [[5, 'I', 'officer'], [6, 'Trading_Trust', 'Trustee'], [7, 'Y', 'Partner']] as const) {
        const id = String(index);
        fixtures[id] = { nzbn: id, entityName: 'EXAMPLE ENTITY', entityTypeCode: type, sourceRegister: type, entityTypeDescription: 'Example type',
            roles: [{ roleType: role, roleStatus: 'Active', rolePerson: { firstName: 'Alex', middleNames: 'Taylor', lastName: 'Example' } }] };
        const graph = await generateOrgChart(id, { ...config, companySearchScope: 'simple' });
        assert.equal(graph.nodes.length, 2);
        assert.equal(graph.nodes.find(n => n.data.isTarget)?.data.entityTypeCode, type);
        const officer = graph.nodes.find(n => !n.data.isTarget)!;
        assert.equal(officer.data.label, 'Alex Taylor Example');
        assert.equal(officer.data.reportedRole, role);
        assert.equal(officer.data.roleKind, undefined, 'Non-company role is not a shareholder/director');
        assert.ok(graph.edges[0].data?.label.includes(role));
    }
    console.log('PASS: Simple immediate relationships, non-company roles, dual roles, unlinked holders, empty company; Comprehensive remains default and crawls wider.');
} finally { globalThis.fetch = originalFetch; }
