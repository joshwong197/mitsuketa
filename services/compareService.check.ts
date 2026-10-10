import assert from 'node:assert/strict';
import { findConnection } from './compareService';
import type { ApiConfig } from '../types';

const config: ApiConfig = { nzbnKey: '', companiesKey: '', disqualifiedDirectorsKey: '', insolvencyKey: '' };
const entity = (nzbn: string, holders: string[] = [], status = 'Registered') => ({
  nzbn, entityName: `COMPANY ${nzbn} LIMITED`, entityStatusDescription: status,
  'company-details': { shareholding: { numberOfShares: 100, shareAllocation: holders.map(id => ({ allocation: 100,
    shareholder: [{ otherShareholder: { nzbn: id, currentEntityName: `COMPANY ${id} LIMITED` } }] })) } },
});
const originalFetch = globalThis.fetch;
let fixtures: Record<string, any>;
let holdings: any[];
let requests: string[];
globalThis.fetch = (async (input: any) => {
  const path = new URL(String(input), 'http://fixture.test').searchParams.get('path') || '';
  requests.push(path);
  const id = path.match(/\/entities\/(\d+)$/)?.[1];
  if (id && fixtures[id]) return new Response(JSON.stringify(fixtures[id]));
  if (path.includes('/search?')) return new Response(JSON.stringify({ roles: [{ roleType: 'Organisation Shareholder', nzbn: '111', name: 'COMPANY 111 LIMITED', shareholdings: holdings }] }));
  throw new Error(`Unexpected request: ${path}`);
}) as typeof fetch;
const run = async (child: any, holding: any = {}) => {
  fixtures = { '111': entity('111'), '222': child };
  holdings = [{ associatedCompanyNzbn: '222', associatedCompanyName: 'COMPANY 222 LIMITED', ...holding }];
  requests = [];
  return findConnection({ kind: 'company', nzbn: '111', name: 'COMPANY 111 LIMITED' },
    { kind: 'company', nzbn: '222', name: 'COMPANY 222 LIMITED' }, config);
};
try {
  assert.equal((await run(entity('222'))).found, false, 'A historical Roles hit absent from current allocations cannot create a path');
  const current = await run(entity('222', ['111']));
  assert.equal(current.found, true);
  assert.equal(current.hops, 1);
  assert.equal(current.edges[0].data?.isCeased, false);
  assert.equal(requests.filter(p => /\/entities\/222$/.test(p)).length, 1, 'Verification fetch is reused');
  assert.equal((await run(entity('222', ['111']), { cessationDate: '2010-01-01' })).found, false, 'Explicit cessation overrides allocations');
  assert.equal(requests.filter(p => /\/entities\/222$/.test(p)).length, 0, 'Explicit cessation needs no verification call');
  assert.equal((await run({ nzbn: '222', entityName: 'COMPANY 222 LIMITED' })).found, false, 'Missing evidence is not proof of current ownership');
  assert.equal((await run(entity('222', ['111'], 'Removed'))).found, false, 'Removed companies cannot establish current connections');

  fixtures = { '111': entity('111', ['222']), '222': entity('222') }; holdings = []; requests = [];
  const direct = await findConnection({ kind: 'company', nzbn: '111', name: 'COMPANY 111 LIMITED' }, { kind: 'company', nzbn: '222', name: 'COMPANY 222 LIMITED' }, config);
  assert.equal(direct.found, true);
  assert.equal(requests.length, 1, 'A verified direct parent should not wait for downstream discovery');

  fixtures = { '111': entity('111'), '999': entity('999') };
  holdings = Array.from({ length: 55 }, (_, i) => { const id = String(300 + i); fixtures[id] = entity(id); return { associatedCompanyNzbn: id }; });
  requests = [];
  const capped = await findConnection({ kind: 'company', nzbn: '111', name: 'COMPANY 111 LIMITED' }, { kind: 'company', nzbn: '999', name: 'COMPANY 999 LIMITED' }, config);
  assert.equal(capped.stats.truncated, true);
  assert.ok(requests.length <= 50, 'Verification must respect the existing API budget');
  console.log('PASS: Compare rejects former, missing and removed ownership evidence; current links work, direct parents skip discovery, and verification is cached and bounded.');
} finally { globalThis.fetch = originalFetch; }
