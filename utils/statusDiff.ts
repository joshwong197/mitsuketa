import { GraphNode } from '../types';
import { getStatusBucket, StatusBucket } from './statusRamp';
import { personId } from '../services/compareService';

/**
 * Save-point diff (Stage C, design/CASES_PLAN.md §Diff) — "what changed since
 * I saved". Pure comparison, ZERO API calls: the caller re-enriches a clone of
 * the save point's nodes via enrichGraphNodes, then hands both sides here.
 *
 * Compared fields:
 *   companies (nzbn only) — status ramp bucket + raw status string
 *   persons               — isDisqualified only
 * Roles/director diff is skip-for-now (per plan). Results are session-only;
 * they are never persisted into the save point or the case session.
 *
 * Minimal runnable check: utils/statusDiff.selftest.ts
 *   npx esbuild utils/statusDiff.selftest.ts --bundle --format=cjs --platform=node | node
 */

export interface NodeDiff {
  nodeId: string;
  key: string; // stable identity: nzbn ?? personId(label)
  label: string;
  prevStatus: string;
  prevBucket: StatusBucket;
  newStatus: string;
  newBucket: StatusBucket;
}

const norm = (s?: string) => (s || '').trim();

export function diffStatuses(savedNodes: GraphNode[], freshNodes: GraphNode[]): NodeDiff[] {
  const freshById = new Map(freshNodes.map(n => [n.id, n]));
  const diffs: NodeDiff[] = [];

  for (const saved of savedNodes) {
    const fresh = freshById.get(saved.id);
    if (!fresh) continue; // enrichment never drops nodes; be safe anyway

    const prev = saved.data;
    const next = fresh.data;
    const key = prev.nzbn || personId(prev.label || '');

    if (prev.type === 'company') {
      // Only NZBN-linked companies can be re-checked (one cached NZBN call
      // each); a node the register never linked has nothing to look up.
      if (!prev.nzbn) continue;
      const prevStatus = norm(prev.status);
      const newStatus = norm(next.status);
      const prevBucket = getStatusBucket(prev);
      const newBucket = getStatusBucket(next);
      if (prevBucket === newBucket && prevStatus === newStatus) continue;
      diffs.push({
        nodeId: saved.id,
        key,
        label: prev.label,
        prevStatus: prevStatus || 'Unknown',
        prevBucket,
        newStatus: newStatus || 'Unknown',
        newBucket,
      });
    } else if (prev.type === 'person') {
      // Persons: isDisqualified is the ONLY compared field (plan mandate).
      if (!!prev.isDisqualified === !!next.isDisqualified) continue;
      diffs.push({
        nodeId: saved.id,
        key,
        label: prev.label,
        prevStatus: prev.isDisqualified ? 'Disqualified' : 'Not disqualified',
        prevBucket: getStatusBucket(prev),
        newStatus: next.isDisqualified ? 'Disqualified' : 'Not disqualified',
        newBucket: getStatusBucket(next),
      });
    }
    // summary/other node kinds: nothing to diff
  }

  return diffs;
}
