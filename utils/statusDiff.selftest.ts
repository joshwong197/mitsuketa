/**
 * Minimal runnable check for utils/statusDiff.ts (plan-mandated).
 * Run:
 *   npx esbuild utils/statusDiff.selftest.ts --bundle --format=cjs --platform=node | node
 * Prints "statusDiff self-test: N assertions passed" and exits 0 on success.
 */
import { diffStatuses } from './statusDiff';
import { GraphNode, NodeType } from '../types';

let passed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  passed++;
}

const company = (id: string, label: string, data: Partial<GraphNode['data']> = {}): GraphNode => ({
  id,
  type: 'companyNode',
  position: { x: 0, y: 0 },
  data: { label, type: NodeType.COMPANY, nzbn: `94290${id}`, status: 'Registered', ...data },
});
const person = (id: string, label: string, isDisqualified?: boolean): GraphNode => ({
  id,
  type: 'personNode',
  position: { x: 0, y: 0 },
  data: { label, type: NodeType.PERSON, isDisqualified },
});

// 1. Company status change: Registered → In Liquidation (active → warning)
{
  const saved = [company('1', 'ACME LTD')];
  const fresh = [company('1', 'ACME LTD', { status: 'In Liquidation', isInExternalAdmin: true })];
  const d = diffStatuses(saved, fresh);
  assert(d.length === 1, 'liquidation change detected');
  assert(d[0].prevStatus === 'Registered' && d[0].newStatus === 'In Liquidation', 'raw statuses carried');
  assert(d[0].prevBucket === 'active' && d[0].newBucket === 'warning', 'buckets active → warning');
  assert(d[0].key === '942901', 'company key is the nzbn');
}

// 2. Unchanged company produces no diff
{
  const d = diffStatuses([company('1', 'ACME LTD')], [company('1', 'ACME LTD')]);
  assert(d.length === 0, 'unchanged company skipped');
}

// 3. Raw status string change within the SAME bucket still reports
{
  const saved = [company('1', 'ACME LTD', { status: 'In Liquidation' })];
  const fresh = [company('1', 'ACME LTD', { status: 'In Receivership' })];
  const d = diffStatuses(saved, fresh);
  assert(d.length === 1 && d[0].prevBucket === d[0].newBucket, 'same-bucket raw string change detected');
}

// 4. Company without nzbn (overseas/unreg) is never compared
{
  const saved = [company('1', 'OVERSEAS CO', { nzbn: undefined })];
  const fresh = [company('1', 'OVERSEAS CO', { nzbn: undefined, status: 'Removed' })];
  assert(diffStatuses(saved, fresh).length === 0, 'nzbn-less company skipped');
}

// 5. Person: isDisqualified flip detected (→ crit); key uses personId form
{
  const d = diffStatuses([person('p1', 'Jane Q Doe', false)], [person('p1', 'Jane Q Doe', true)]);
  assert(d.length === 1, 'person disqualification detected');
  assert(d[0].newBucket === 'crit' && d[0].prevBucket === 'active', 'person buckets active → crit');
  assert(d[0].key === 'P-DOE-JANE-Q', 'person key is personId(label)');
}

// 6. Person with only non-compared changes (e.g. status text) is skipped
{
  const saved = [person('p1', 'Jane Q Doe', false)];
  const fresh = [{ ...person('p1', 'Jane Q Doe', false), data: { ...person('p1', 'Jane Q Doe', false).data, status: 'whatever' } }];
  assert(diffStatuses(saved, fresh).length === 0, 'persons compare isDisqualified only');
}

// 7. Node missing from fresh side is ignored, others still diff
{
  const saved = [company('1', 'GONE LTD'), company('2', 'ACME LTD')];
  const fresh = [company('2', 'ACME LTD', { status: 'Removed' })];
  const d = diffStatuses(saved, fresh);
  assert(d.length === 1 && d[0].label === 'ACME LTD' && d[0].newBucket === 'faded', 'missing node ignored; Removed → faded');
}

console.log(`statusDiff self-test: ${passed} assertions passed`);
