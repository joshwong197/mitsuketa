import React from 'react';

const InkLine = ({ color }: { color: string }) => (
  <i style={{ width: 14, height: 3, display: 'inline-block', background: color }} />
);

const StatusDot = ({ color }: { color: string }) => (
  <i
    style={{
      width: 10,
      height: 10,
      display: 'inline-block',
      background: 'var(--paper)',
      border: `2px solid ${color}`,
    }}
  />
);

/**
 * Sumi ink legend chip for the graph canvas — ink-depth tiers plus the
 * status ramp (design/STATUS_RAMP.md): active = plain ink, trouble = dyed
 * (amber admin / crit insolvency), dead = faded; ceased roles are dashed.
 */
export function StatusLegend() {
  return (
    <div
      aria-label="Graph legend"
      className="flex flex-col gap-1.5 bg-paper border border-rule text-ink-mid"
      style={{ fontSize: 10.5, padding: '7px 12px' }}
    >
      <div className="flex items-center gap-2.5">
        <span style={{ fontFamily: 'var(--serif)', letterSpacing: '.15em' }}>墨</span>
        <span className="flex items-center gap-1.5">
          <InkLine color="var(--ink)" />target
        </span>
        <span className="flex items-center gap-1.5">
          <InkLine color="var(--ink-mid)" />1 hop
        </span>
        <span className="flex items-center gap-1.5">
          <InkLine color="var(--ink-wash)" />2 hops
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <span style={{ fontFamily: 'var(--serif)', letterSpacing: '.15em' }}>色</span>
        <span className="flex items-center gap-1.5">
          <StatusDot color="var(--amber)" />admin
        </span>
        <span className="flex items-center gap-1.5">
          <StatusDot color="var(--crit)" />insolvent
        </span>
        <span className="flex items-center gap-1.5">
          <StatusDot color="var(--ink-wash)" />removed
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="3" aria-hidden="true">
            <line x1="0" y1="1.5" x2="14" y2="1.5" stroke="var(--ink-wash)" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          ceased
        </span>
      </div>
    </div>
  );
}
