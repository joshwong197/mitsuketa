import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { SharedPerson, SharedPersonAppearance } from '../../utils/peopleInCommon';

/**
 * PEOPLE IN COMMON — Stage D dossier section (design/CASES_PLAN.md).
 * Pure presentation over computePeopleInCommon output: rows expand to tab
 * chips; a chip click jumps to that tab and highlights the person's node by
 * key (same jumpToTab + highlight-by-label mechanic as the Notes rows).
 * Renders nothing when no person spans ≥2 tabs.
 */
export const PeopleSection: React.FC<{
  people: SharedPerson[];
  onJumpToPerson: (person: SharedPerson, appearance: SharedPersonAppearance) => void;
}> = ({ people, onJumpToPerson }) => {
  const [open, setOpen] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (people.length === 0) return null;

  return (
    <section className="border-b border-rule">
      {/* Header — the existing 10.5px uppercase tracked ink-pale section voice */}
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
            People in common ({people.length})
          </span>
        </button>
      </div>
      {open && (
        <div className="pb-2">
          {people.map((person) => {
            const expanded = expandedKey === person.key;
            return (
              <div key={person.key}>
                <button
                  onClick={() => setExpandedKey(expanded ? null : person.key)}
                  className="w-full text-left flex items-baseline justify-between gap-2 px-[18px] py-1.5 hover:bg-paper2 transition-colors"
                  aria-expanded={expanded}
                >
                  <span className="font-bold text-ink truncate" style={{ fontSize: 12.5 }}>
                    {person.displayName}
                  </span>
                  <span className="text-ink-mid whitespace-nowrap" style={{ fontSize: 11 }}>
                    {person.appearances.length} charts
                  </span>
                </button>
                {expanded && (
                  <div className="flex flex-wrap gap-1.5 px-[18px] pt-0.5 pb-2">
                    {person.appearances.map((app) => (
                      <button
                        key={app.tabId}
                        onClick={() => onJumpToPerson(person, app)}
                        className="border border-rule text-ink-mid hover:border-ink-mid hover:text-ink transition-colors px-2 py-0.5 max-w-full truncate"
                        style={{ fontSize: 11 }}
                        title={
                          app.viaCompanies.length > 0
                            ? `via ${app.viaCompanies.join(', ')}`
                            : app.kind === 'person-tab'
                              ? 'Person search tab'
                              : app.tabLabel
                        }
                      >
                        {app.tabLabel}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <p className="px-[18px] pt-1 pb-1.5 text-ink-pale" style={{ fontSize: 11 }}>
            Matched by name — same-name individuals can collide.
          </p>
        </div>
      )}
    </section>
  );
};
