import assert from 'node:assert/strict';
import { loadSession, saveSession, toPersistedTab, SESSION_KEY, SAVEPOINTS_KEY } from './caseStore';
import { isActivePersonCompany } from './personCompanyStatus';
import type { CompanyTab } from '../types';

const values = new Map<string, string>();
let limit = Infinity;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    if (value.length > limit) throw new DOMException('Full', 'QuotaExceededError');
    values.set(key, value);
  },
} });
const tab = (id: string, count: number): CompanyTab => ({
  id, label: id, nzbn: id, searchQuery: id, nodes: [], isLoading: false,
  hideInactiveCompanies: true, hideInactiveDirectors: true,
  allNodesInMemory: Array.from({ length: count }, (_, i) => ({ id: `${id}-${i}`, type: 'companyNode',
    position: { x: i, y: i }, data: { label: `Entity ${i}`, type: 'company' as any, isVisible: true } })),
  edges: [{ id: `edge-${id}`, source: `${id}-0`, target: `${id}-1`, data: { label: 'Shareholder · Former', percentage: 100, isCeased: true },
    style: { stroke: 'red' }, markerEnd: 'arrowclosed', labelStyle: { fontSize: 12 } } as any],
});
const active = tab('active', 50), older = tab('older', 20);
const notes: any[] = [{ id: 'note', text: 'Keep this note' }];
values.set(SAVEPOINTS_KEY, 'untouched snapshot');
const compact = toPersistedTab(active);
assert.equal(compact.edges[0].style, undefined);
assert.equal(compact.edges[0].data?.isCeased, true, 'Preserve relationship evidence');
assert.equal(compact.allNodesInMemory[2].position.x, 2);
assert.equal(compact.hideInactiveCompanies, true);
const initial = saveSession([active], 'active', notes);
assert.equal(initial.ok, true);
limit = values.get(SESSION_KEY)!.length + 500;
const quota = saveSession([active, older], 'active', notes);
assert.equal(quota.ok, true);
assert.deepEqual(quota.droppedTabLabels, ['older'], 'Preserve the active graph before older graphs, even when active is larger');
const loaded = loadSession()!;
assert.equal(loaded.companyTabs[0].allNodesInMemory.length, 50);
assert.equal(loaded.companyTabs[1].allNodesInMemory.length, 0);
assert.deepEqual(loaded.notes, notes);
assert.equal(values.get(SAVEPOINTS_KEY), 'untouched snapshot');
const previous = values.get(SESSION_KEY);
limit = 1;
assert.equal(saveSession([active], 'active', notes).ok, false);
assert.equal(values.get(SESSION_KEY), previous, 'A failed write must preserve the previous session');
assert.equal(active.allNodesInMemory.length, 50, 'Quota handling must not mutate the live chart');

assert.equal(isActivePersonCompany({ status: 'Registered', entityStatusCode: 50, isInactive: false }), true);
assert.equal(isActivePersonCompany({ status: 'Removed', entityStatusCode: 80, isInactive: false }), false);
assert.equal(isActivePersonCompany({ status: 'Removed', isInactive: false }), false);
assert.equal(isActivePersonCompany({ status: 'Registered', entityStatusCode: 50, isInactive: true }), false);
assert.equal(isActivePersonCompany({ status: 'In Liquidation', entityStatusCode: 50, isInactive: false }), true, 'Active does not mean financially healthy');
console.log('PASS: quota handling preserves the active graph, notes, snapshots and previous writes; relationship metadata and filters survive serialization; active counts exclude removed companies and former roles.');
