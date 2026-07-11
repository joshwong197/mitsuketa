import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { NodeDiff } from '../../utils/statusDiff';
import { StatusBucket } from '../../utils/statusRamp';

/**
 * CHANGES — Stage C dossier section (design/CASES_PLAN.md §Diff). Pure
 * presentation over diffStatuses output. Renders only after a "Check for
 * changes" run has completed (savePointName is set); before that the App
 * hasn't run a diff yet and this section stays hidden entirely. Row click
 * highlights the changed node on the canvas (it's already loaded — the
 * check flow loads the save point as part of running).
 */

// Same bucket → semantic class mapping as CustomNodes' statusTextClass
// (design/STATUS_RAMP.md): active reads plain ink, trouble is dyed, dead
// fades. No new colors — crit red is the only red.
const bucketClass = (bucket: StatusBucket): string => {
  switch (bucket) {
    case 'crit':
      return 'text-crit';
    case 'warning':
      return 'text-amber';
    case 'faded':
    case 'amalgamated':
      return 'text-ink-pale';
    default:
      return 'text-ink';
  }
};

export const ChangesSection: React.FC<{
  diffs: NodeDiff[] | null;
  savePointName: string;
  isChecking: boolean;
  onJumpToChange: (diff: NodeDiff) => void;
}> = ({ diffs, savePointName, isChecking, onJumpToChange }) => {
  const [open, setOpen] = useState(true);

  // No check has run yet this session — nothing to show.
  if (diffs === null && !isChecking) return null;

  return (
    <section className="border-b border-rule">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-ink-pale hover:text-ink transition-colors"
          aria-expanded={open}
        >
          <ChevronRight
            size={11}
            strokeWidth={1.5}
            className={`transition-transform ${open ? 'rotate-90' : ''}`}
          />
          <span className="uppercase tracking-[.14em]" style={{ fontSize: 10.5 }}>
            Changes{diffs !== null ? ` (${diffs.length})` : ''}
          </span>
        </button>
      </div>
      {open && (
        <div className="pb-2">
          {isChecking && (
            <p className="px-[18px] pb-2 text-ink-pale italic" style={{ fontSize: 12 }}>
              Checking…
            </p>
          )}
          {!isChecking && diffs !== null && diffs.length === 0 && (
            <p className="px-[18px] pb-2 text-ink-pale italic" style={{ fontSize: 12 }}>
              No changes since {savePointName}
            </p>
          )}
          {!isChecking && diffs !== null && diffs.length > 0 && (
            <>
              {diffs.map((diff) => (
                <button
                  key={diff.nodeId}
                  onClick={() => onJumpToChange(diff)}
                  className="w-full text-left px-[18px] py-1.5 hover:bg-paper2 transition-colors"
                >
                  <p className="font-bold text-ink truncate" style={{ fontSize: 12.5 }}>
                    {diff.label}
                  </p>
                  <p className="truncate" style={{ fontSize: 11.5 }}>
                    <span className="text-ink-pale">{diff.prevStatus}</span>
                    <span className="text-ink-pale" aria-hidden="true"> {'→'} </span>
                    <span className={bucketClass(diff.newBucket)}>{diff.newStatus}</span>
                  </p>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
};
