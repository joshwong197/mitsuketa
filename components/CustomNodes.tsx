import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Users } from 'lucide-react';
import { NodeData } from '../types';
import { getStatusBucket } from '../utils/statusRamp';

// The sumi mockup nodes have no visible handle dots — edges anchor to the
// node body. Keep handles functional but visually invisible.
const HANDLE_CLASS = '!w-1 !h-1 !min-w-0 !min-h-0 !bg-transparent !border-0';

// Status chip per the approved mockup: 15px serif kanji square on a status
// color, --accent-ink glyph, then a 10px bold uppercase tracked label.
const KanjiChip = ({ kanji, color, textClass, label, title }: {
  kanji: string;
  color: string;
  textClass: string;
  label: string;
  title?: string;
}) => (
  <div className="flex items-center gap-[5px] mt-2 status-chip" title={title}>
    <span
      className="grid place-items-center shrink-0"
      style={{ width: 15, height: 15, fontFamily: 'var(--serif)', fontSize: 11, lineHeight: 1, color: 'var(--accent-ink)', background: color }}
    >
      {kanji}
    </span>
    <span className={`text-[10px] uppercase font-bold truncate ${textClass}`} style={{ letterSpacing: '.08em' }}>
      {label}
    </span>
  </div>
);

// Case-note dog-ear (Stage B, design/CASES_PLAN.md §Notes): a CSS-triangle
// folded corner at the TOP-LEFT, rendered INSIDE the node's status border so
// it composes with ink/amber/crit/wash borders alike. Ink by default; a
// flagged note dyes it --accent (the user's inkan mark — an annotation, not a
// register status). Corner inventory: target stamp top-right, +N/capped
// bottom-right, Stage C's 変 badge takes another free corner — keep this small.
const NoteDogEar = ({ flagged, inset = 0 }: { flagged?: boolean; inset?: number }) => (
  <span
    aria-hidden="true"
    className="absolute"
    title="Has case note"
    style={{
      top: 0,
      left: inset,
      width: 0,
      height: 0,
      borderTop: `9px solid ${flagged ? 'var(--accent)' : 'var(--ink)'}`,
      borderRight: '9px solid transparent',
    }}
  />
);

// Save-point status-diff badge (Stage C, design/CASES_PLAN.md §Diff):
// bottom-left, mirroring the +N/capped badge grammar (bottom-right) — pure
// ink, no new colors. Only rendered after "Check for changes" has run and
// this node's status moved since the save point.
const DiffBadge = ({ prevStatus }: { prevStatus: string }) => (
  <div
    className="absolute font-bold"
    style={{ bottom: '-10px', left: '-9px', background: 'var(--ink)', color: 'var(--paper)', fontSize: 10, padding: '2px 7px' }}
    title={`Was: ${prevStatus}`}
  >
    変
  </div>
);

export const CompanyNode = memo(({ data, selected }: NodeProps<NodeData>) => {
  // Calculate dynamic width based on label length and badges.
  // Badges are now compact 19px kanji squares + short labels, not pills,
  // so the extra width per flag is much smaller than before.
  const labelLength = data.label?.length || 0;

  let extraWidth = 0;
  if (data.isInExternalAdmin) extraWidth += 60;
  if (data.removalCommenced) extraWidth += 55;
  if (data.hasHistoricInsolvency) extraWidth += 70;

  const minWidth = 176;
  const maxWidth = 400;
  const dynamicWidth = Math.min(maxWidth, Math.max(minWidth, (labelLength * 8 + 60) + (extraWidth > 0 ? extraWidth / 1.5 : 0)));

  const isHighlighted = data.isHighlighted;
  const isTarget = data.isTarget;

  // Status ramp bucket (design/STATUS_RAMP.md): active = plain ink,
  // trouble = dyed, dead = faded.
  const bucket = getStatusBucket(data);
  const isFaded = bucket === 'faded' || bucket === 'amalgamated';

  // Nodes always carry a full-weight 2px border (per the approved status-ramp
  // mockup — thin/washy card borders read weak; edges carry depth fading).
  // Status dye overrides ink depth: amber for admin trouble, crit for
  // insolvency (the only red on canvas), wash for dead entities. Depth only
  // softens active nodes: 2+ hops drop from ink to ink-mid.
  const tier = isTarget || data.depth === 0 ? 0 : data.depth === 1 ? 1 : 2;
  const borderWidth = '2px';
  const borderColor = selected
    ? 'var(--accent)'
    : bucket === 'crit'
      ? 'var(--crit)'
      : bucket === 'warning'
        ? 'var(--amber)'
        : isFaded
          ? 'var(--ink-wash)'
          : tier === 2
            ? 'var(--ink-mid)'
            : 'var(--ink)';
  const titleColorClass = isFaded ? 'text-ink-mid' : 'text-ink';
  const idColorClass = 'text-ink-pale';

  const showStatus = data.status && !data.isInExternalAdmin;
  const isRegistered = showStatus && data.status!.toLowerCase().includes('registered');
  const statusTextClass =
    isRegistered ? 'text-green'
      : bucket === 'crit' ? 'text-crit'
        : bucket === 'warning' ? 'text-amber'
          : 'text-ink-pale';

  return (
    <div
      className={`relative${bucket === 'crit' ? ' node-crit' : ''}`}
      style={{
        width: `${dynamicWidth}px`,
        background: 'var(--paper)',
        borderWidth,
        borderStyle: 'solid',
        borderColor,
        ...(isHighlighted ? { outline: '2px solid var(--accent)', outlineOffset: '2px' } : {}),
      }}
    >
      {data.hasNote && <NoteDogEar flagged={data.noteFlagged} />}

      {isTarget && (
        <div
          className="absolute grid place-items-center"
          style={{
            top: '-14px',
            right: '-12px',
            width: 32,
            height: 32,
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            fontFamily: 'var(--serif)',
            fontWeight: 700,
            fontSize: 17,
            transform: 'rotate(-6deg)',
            boxShadow: 'inset 0 0 14px oklch(0 0 0 / .22)',
          }}
          title="Search target"
        >
          見
        </div>
      )}

      <Handle type="target" position={Position.Top} className={HANDLE_CLASS} />

      {/* .gnode body (mockup): 9px 12px pad, no icon — name / id / status rows */}
      <div style={{ padding: '9px 12px' }}>
        <h3
          className={`text-[12.5px] font-bold break-words ${titleColorClass}`}
          style={{ margin: '0 0 3px', lineHeight: 1.35 }}
          title={data.label}
        >
          {data.label}
          {bucket === 'amalgamated' && (
            <span className="text-ink-pale font-normal" style={{ marginLeft: 6 }} aria-hidden="true" title="Amalgamated into successor entity">→</span>
          )}
        </h3>
        <p className={`font-mono text-[10.5px] tabular-nums ${idColorClass}`}>
          {data.nzbn ? `NZBN: ${data.nzbn}` : 'Overseas / Unreg'}
        </p>

        {showStatus && (
          <div className="flex items-center gap-[5px] mt-2 status-chip">
            <span
              className={`text-[10px] uppercase font-bold truncate ${statusTextClass}`}
              style={{ letterSpacing: '.08em' }}
              title={data.status}
            >
              {data.status}
            </span>
          </div>
        )}

        {data.entityTypeDescription && data.entityTypeCode !== 'NZCompany' && (
          <div className="flex items-center gap-[7px] mt-2">
            <span className="text-[10px] uppercase tracking-wider text-ink-pale truncate" title={data.entityTypeDescription}>
              {data.entityTypeDescription}
            </span>
          </div>
        )}

        {/* External administration (liquidation / receivership / VA) is amber
            per the status ramp — crit red is reserved for insolvency. */}
        {data.isInExternalAdmin && data.externalAdminType && (
          <KanjiChip kanji="琥" color="var(--amber)" textClass="text-amber" label={data.externalAdminType.toUpperCase()} title={data.externalAdminType} />
        )}

        {data.removalCommenced && (
          <KanjiChip kanji="琥" color="var(--amber)" textClass="text-amber" label="REMOVAL IN PROGRESS" title="Removal in Progress" />
        )}

        {data.hasHistoricInsolvency && (
          <KanjiChip
            kanji="紅"
            color="var(--crit)"
            textClass="text-crit"
            label={`PREV: ${data.historicInsolvencyType?.toUpperCase() || 'INSOLVENT'}`}
            title={`Previously in ${data.historicInsolvencyType}`}
          />
        )}
      </div>

      {data.hiddenDescendantCount && data.hiddenDescendantCount > 0 && !data.isCapped && (
        <div
          className="absolute font-bold tabular-nums"
          style={{ bottom: '-10px', right: '-9px', background: 'var(--ink)', color: 'var(--paper)', fontSize: 10, padding: '2px 7px' }}
        >
          +{data.hiddenDescendantCount}
        </div>
      )}

      {data.isCapped && (
        <div
          className="absolute font-bold tabular-nums"
          style={{ bottom: '-10px', right: '-9px', background: 'var(--crit)', color: 'var(--paper)', fontSize: 10, padding: '2px 7px' }}
          title="Trustee mega-node — right-click to expand"
        >
          {data.cappedChildCount || '?'} capped
        </div>
      )}

      {data.isExpanding && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: 'oklch(from var(--paper) l c h / .6)' }}
        >
          <div
            className="animate-spin rounded-full"
            style={{ width: 20, height: 20, borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
        </div>
      )}

      {data.diff && <DiffBadge prevStatus={data.diff.prevStatus} />}

      <Handle type="source" position={Position.Bottom} className={HANDLE_CLASS} />
    </div>
  );
});

// The seal (印) is replaced by the person's role — 株 (株主 kabunushi,
// shareholder) or 締 (取締役 torishimariyaku, director). Someone who is both
// (data.roleKind === 'both', rolled up across every edge touching this node —
// see utils/personRoles.ts) gets both roles sliced clean down the middle and
// set side by side, with a dividing line so the split reads as deliberate
// rather than a rendering glitch — most readers can't parse the kanji anyway,
// the shape is the signal. The ring echoes the same split: solid arc for
// ownership, dashed arc for control.
const SealGlyph = ({ roleKind, color }: { roleKind?: 'shareholder' | 'director' | 'both'; color: string }) => {
  if (roleKind === 'both') {
    return (
      <span className="relative grid place-items-center" style={{ width: 14, height: 15 }} aria-hidden="true">
        <span style={{ position: 'absolute', inset: 0, fontFamily: 'var(--serif)', fontSize: 12, lineHeight: '15px', color, clipPath: 'inset(0 50% 0 0)' }}>株</span>
        <span style={{ position: 'absolute', inset: 0, fontFamily: 'var(--serif)', fontSize: 12, lineHeight: '15px', color, clipPath: 'inset(0 0 0 50%)' }}>締</span>
        <span style={{ position: 'absolute', top: -1, bottom: -1, left: '50%', width: 1, background: color, opacity: 0.7 }} />
      </span>
    );
  }
  return (
    <span style={{ fontFamily: 'var(--serif)', fontSize: 12, color }} aria-hidden="true">
      {roleKind === 'director' ? '締' : '株'}
    </span>
  );
};

// Ring per role: solid (shareholder/ownership), dashed (director/control), or —
// for both — one circle carrying two stroke styles via SVG arcs, since a CSS
// border can't be half-dashed.
const SealRing = ({ roleKind, color }: { roleKind?: 'shareholder' | 'director' | 'both'; color: string }) => {
  if (roleKind === 'both') {
    return (
      <svg viewBox="0 0 30 30" aria-hidden="true" className="absolute inset-0" style={{ width: 30, height: 30 }}>
        <path d="M15,0.5 A14.5,14.5 0 0,0 15,29.5" fill="none" stroke={color} strokeWidth="1" />
        <path d="M15,0.5 A14.5,14.5 0 0,1 15,29.5" fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 2.5" />
        <path d="M15,2.5 A12.5,12.5 0 0,0 15,27.5" fill="none" stroke={color} strokeWidth="1" opacity=".35" />
        <path d="M15,2.5 A12.5,12.5 0 0,1 15,27.5" fill="none" stroke={color} strokeWidth="1" opacity=".35" strokeDasharray="3 2.5" />
      </svg>
    );
  }
  const borderStyle = roleKind === 'director' ? 'dashed' : 'solid';
  return (
    <>
      <div className="absolute inset-0 rounded-full" style={{ border: `1px solid ${color}`, borderStyle }} />
      <div className="absolute rounded-full" style={{ inset: 2, border: `1px solid oklch(from ${color} l c h / .35)`, borderStyle }} />
    </>
  );
};

export const PersonNode = memo(({ data, selected }: NodeProps<NodeData>) => {
  const isHighlighted = data.isHighlighted;
  const isDisqualified = data.isDisqualified;
  const hasInsolvencyRecord = data.hasInsolvencyRecord;

  // Discharged is still crit, not demoted to amber — currency is a separate
  // fact (below), not a colour softening (design/HANDOVER.md §4.3).
  const critLabels: string[] = [];
  if (isDisqualified) critLabels.push('Disqualified');
  if (hasInsolvencyRecord) critLabels.push(data.insolvencyCurrent ? 'Current insolvency' : 'Insolvency record');
  const isCrit = critLabels.length > 0;

  const sealColor = isCrit ? 'var(--crit)' : 'var(--accent)';
  const roleLabel =
    data.roleKind === 'both' ? 'Shareholder · Director'
      : data.roleKind === 'director' ? 'Director'
        : data.roleKind === 'shareholder' ? 'Shareholder'
          : 'Individual';

  return (
    <div
      className={`relative flex items-center min-w-[180px]${isCrit ? ' node-crit' : ''}`}
      style={{
        borderRadius: 999,
        border: isCrit ? '2px solid var(--crit)' : '1px solid var(--ink-mid)',
        borderColor: selected ? 'var(--accent)' : isCrit ? 'var(--crit)' : 'var(--ink-mid)',
        background: 'var(--paper)',
        padding: '8px 18px 8px 9px',
        gap: 10,
        ...(isHighlighted ? { outline: '2px solid var(--accent)', outlineOffset: '2px' } : {}),
      }}
    >
      <Handle type="target" position={Position.Top} className={HANDLE_CLASS} />

      {/* Pill leading edge: inset past the border-radius curve so the fold
          sits inside the (possibly crit 2px) border, not outside the pill. */}
      {data.hasNote && <NoteDogEar flagged={data.noteFlagged} inset={18} />}

      <div className="relative shrink-0 grid place-items-center" style={{ width: 30, height: 30 }}>
        <SealRing roleKind={data.roleKind} color={sealColor} />
        <SealGlyph roleKind={data.roleKind} color={sealColor} />
      </div>
      <div>
        <p className="text-[12.5px] font-bold text-ink">{data.label}</p>
        <p className="text-[10px] uppercase tracking-wider text-ink-pale">{roleLabel}</p>
        {isCrit && (
          <div className="flex items-center gap-[5px] mt-0.5 status-chip" title={critLabels.join(' · ')}>
            <span
              className="grid place-items-center shrink-0"
              style={{ width: 15, height: 15, fontFamily: 'var(--serif)', fontSize: 11, lineHeight: 1, color: 'var(--accent-ink)', background: 'var(--crit)' }}
            >
              紅
            </span>
            <span className="text-[10px] uppercase font-bold text-crit truncate" style={{ letterSpacing: '.08em' }}>
              {critLabels.join(' · ')}
            </span>
          </div>
        )}
      </div>

      {data.diff && <DiffBadge prevStatus={data.diff.prevStatus} />}

      <Handle type="source" position={Position.Bottom} className={HANDLE_CLASS} />
    </div>
  );
});

export const SummaryNode = memo(({ data, selected }: NodeProps<NodeData>) => {
  return (
    <div
      className="relative w-[220px] flex items-center gap-3"
      style={{
        border: '1px dashed var(--rule)',
        borderColor: selected ? 'var(--accent)' : 'var(--rule)',
        background: 'var(--paper)',
        padding: '8px 12px',
      }}
    >
      <Handle type="target" position={Position.Top} className={HANDLE_CLASS} />

      <Users size={16} className="text-ink-pale shrink-0" strokeWidth={1.5} />
      <div>
        <p className="text-[12px] font-bold uppercase text-ink-mid">{data.label}</p>
        <p className="text-[9px] text-ink-pale">Minor shareholders hidden</p>
      </div>

      <Handle type="source" position={Position.Bottom} className={HANDLE_CLASS} />
    </div>
  );
});
