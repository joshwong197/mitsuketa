import type { GraphNode } from '../types';

export function personCheckProgress(nodes: GraphNode[]) {
  let total = 0, settled = 0, unavailable = 0;
  for (const { data } of nodes) {
    if (data.type !== 'person' || !data.label?.trim()) continue;
    total++;
    const states = [data.disqualifiedCheck, data.insolvencyCheck];
    if (states.every(s => s === 'complete' || s === 'unavailable')) settled++;
    if (states.includes('unavailable')) unavailable++;
  }
  return { total, settled, unavailable };
}
