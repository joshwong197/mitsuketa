import React from 'react';
import type { GraphNode } from '../types';
import { personCheckProgress } from '../utils/checkProgress';

export type SearchPhase = 'mapping' | 'checking' | 'complete' | 'interrupted' | 'incomplete';

export function RegisterCheckProgress({ nodes, phase }: { nodes: GraphNode[]; phase?: SearchPhase }) {
  const { total, settled, unavailable } = personCheckProgress(nodes);
  // Reloading does not restart a search. Persisted pending checks must not look
  // as if a background task is still running.
  if (!phase && nodes.some(n => n.data.disqualifiedCheck === 'pending' || n.data.insolvencyCheck === 'pending')) phase = 'interrupted';
  if (!phase) return null;
  const unavailableCompanies = nodes.filter(n => n.data.companyCheck === 'unavailable').length;
  const mapping = phase === 'mapping' || phase === 'incomplete';
  const percent = total ? Math.floor(settled / total * 100) : 0;
  const title = phase === 'incomplete' ? 'The relationship network could not finish'
    : mapping ? 'Building the full relationship network'
    : phase === 'interrupted' ? 'Some register checks could not finish'
    : phase === 'complete' && settled < total ? 'This view contains unchecked people'
    : phase === 'complete' ? 'Register checks finished'
    : 'Register checks running';
  return <section aria-label="Search progress" className="border-b border-rule bg-paper px-5 py-3 shrink-0" style={{ fontSize: 12 }}>
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <p role="status" className="text-ink">{title}</p>
      {!mapping && total > 0 && <span className="text-ink-mid">{settled.toLocaleString()} of {total.toLocaleString()} people processed · {percent}%</span>}
    </div>
    {!mapping && total > 0 && <progress aria-label="People processed against both registers" value={settled} max={total}
      className="block w-full mt-2 h-1.5" style={{ accentColor: 'var(--color-accent)' }} />}
    <p className="text-ink-mid mt-1">
      {phase === 'incomplete' ? 'This is an incomplete preview. Run the search again to retry.'
        : mapping ? 'Showing the initial relationships while the wider network loads. Register checks will follow.'
        : phase === 'checking' ? 'You can explore the chart. Company and person checks continue in the background.'
        : phase === 'interrupted' ? 'Pending results are unchecked. Run the search again to retry.'
        : 'Finished does not mean no matches were found. Review the alerts on each entity.'}
      {unavailable > 0 && <span className="text-amber"> {unavailable.toLocaleString()} people have an unavailable check.</span>}
      {unavailableCompanies > 0 && <span className="text-amber"> {unavailableCompanies.toLocaleString()} companies have an unavailable check.</span>}
      {!mapping && phase === 'checking' && settled === total && ' Person checks have finished; company checks are still running.'}
    </p>
  </section>;
}
