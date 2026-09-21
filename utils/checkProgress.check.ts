import assert from 'node:assert/strict';
import { personCheckProgress } from './checkProgress';
import { NodeType, type GraphNode } from '../types';
import { enrichGraphNodes } from '../src/api/companyStatusApi';
import { toPersistedTab } from './caseStore';
import type { CompanyTab } from '../types';
const person = (id: string, a?: 'pending' | 'complete' | 'unavailable', b = a): GraphNode => ({
  id, type: 'personNode', position: { x: 0, y: 0 }, data: { type: NodeType.PERSON, label: id, disqualifiedCheck: a, insolvencyCheck: b },
});
assert.deepEqual(personCheckProgress([]), { total: 0, settled: 0, unavailable: 0 });
assert.deepEqual(personCheckProgress([
  person('pending', 'pending'), person('partial', 'complete', 'pending'), person('done', 'complete'),
  person('failed', 'unavailable', 'complete'), person('restored'),
  { id: 'company', type: 'companyNode', position: { x: 0, y: 0 }, data: { type: NodeType.COMPANY, label: 'Company' } },
]), { total: 5, settled: 2, unavailable: 1 });
console.log('PASS: Progress distinguishes pending, partially checked, unavailable and restored unchecked people.');

const tab: CompanyTab = { id: 'fixture', label: 'Fixture', nzbn: '111', searchQuery: 'Fixture',
  nodes: [person('pending', 'pending')], allNodesInMemory: [person('pending', 'pending')], edges: [],
  isLoading: true, graphIncomplete: true };
assert.equal(toPersistedTab(tab).allNodesInMemory.length, 0, 'Never restore a preview as a complete chart');
assert.equal(toPersistedTab({ ...tab, graphIncomplete: false, isLoading: false }).allNodesInMemory.length, 1,
  'A complete chart remains restorable while its register checks run');

const originalFetch = globalThis.fetch;
try {
  let failHistory = true;
  globalThis.fetch = async input => {
    const path = new URL(String(input), 'https://fixture.invalid').searchParams.get('path') || '';
    if (path.endsWith('/history/entity-statuses')) return failHistory
      ? new Response('', { status: 503 }) : new Response('[]');
    return new Response(JSON.stringify({ nzbn: 'progress-company', entityName: 'Fixture', entityStatusDescription: 'Registered' }));
  };
  const company: GraphNode = { id: 'progress-company', type: 'companyNode', position: { x: 0, y: 0 },
    data: { type: NodeType.COMPANY, label: 'Fixture', nzbn: 'progress-company' } };
  const config = { nzbnKey: '', companiesKey: '', disqualifiedDirectorsKey: '', insolvencyKey: '' };
  const failed = await enrichGraphNodes([company], config);
  assert.equal(failed[0].data.companyCheck, 'unavailable', 'Failed history cannot be reported as a completed company check');
  failHistory = false;
  const retried = await enrichGraphNodes(failed, config);
  assert.equal(retried[0].data.companyCheck, 'complete');
  console.log('PASS: Company-history failures remain unavailable until a successful retry.');
} finally { globalThis.fetch = originalFetch; }
