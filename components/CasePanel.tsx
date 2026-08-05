import React, { useMemo, useRef, useState } from 'react';
import { Camera, ChevronRight, Download, RefreshCw, Trash2, Upload } from 'lucide-react';
import { CaseNote, GraphNode, GraphSnapshot } from '../types';
import { PeopleSection } from './casepanel/PeopleSection';
import { ChangesSection } from './casepanel/ChangesSection';
import { NodeDiff } from '../utils/statusDiff';
import {
  computePeopleInCommon,
  PeopleCompanyTabInput,
  PeopleIndividualTabInput,
  SharedPerson,
  SharedPersonAppearance,
} from '../utils/peopleInCommon';

/**
 * Cases workspace sidebar — the one scrolling dossier (design/CASES_PLAN.md).
 * Stacked collapsible sections (NOT tabs): CASE FILE / NOTES / PEOPLE IN
 * COMMON / CHANGES / SAVE POINTS / exports footer. Sections render only when
 * non-empty; NOTES / PEOPLE IN COMMON / CHANGES are Stage B/D/C mount points
 * (render nothing today).
 */

// ── Collapsible section shell ──────────────────────────────────────────────
// Header voice: 10.5px uppercase tracked ink-pale (the existing panel voice);
// plain disclosure caret; border-rule separators between sections.
const Section: React.FC<{
  title: string;
  count?: number;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, count, actions, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
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
            {title}
            {count !== undefined ? ` (${count})` : ''}
          </span>
        </button>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {open && children}
    </section>
  );
};

// Collapsed by default — most users don't need the activity log.
const Trail: React.FC<{ trail: { time: string; text: string }[] }> = ({ trail }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-[18px] pt-3 pb-3.5">
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
          Trail{trail.length ? ` (${trail.length})` : ''}
        </span>
      </button>
      {open && (
        trail.length === 0 ? (
          <p className="text-ink-pale italic mt-2" style={{ fontSize: 12 }}>No activity yet.</p>
        ) : (
          trail.map((row, i) => (
            <div key={i} className="flex gap-2.5 py-1.5 text-ink-mid" style={{ fontSize: 12, borderBottom: '1px solid oklch(from var(--rule) l c h/.5)' }}>
              <span className="text-ink-pale whitespace-nowrap" style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}>{row.time}</span>
              <span>{row.text}</span>
            </div>
          ))
        )
      )}
    </div>
  );
};

const Stat: React.FC<{ value: number; label: string; crit?: boolean; last?: boolean }> = ({ value, label, crit, last }) => (
  <div className={`py-3 px-2 text-center ${last ? '' : 'border-r border-rule'}`}>
    <b className="block" style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: crit ? 'var(--crit)' : 'var(--ink)' }}>{value}</b>
    <span className="uppercase text-ink-pale" style={{ fontSize: 10, letterSpacing: '.08em' }}>{label}</span>
  </div>
);


/** Role-filter row. Reads as pressed when the role is hidden. */
const RoleToggle: React.FC<{
  on: boolean; onClick: () => void; kanji: string; label: string; count: number;
}> = ({ on, onClick, kanji, label, count }) => (
  <button
    onClick={onClick}
    aria-pressed={on}
    className={`w-full flex items-center gap-2 px-2.5 py-1.5 border transition-colors ${
      on ? 'border-ink bg-ink text-paper' : 'border-rule text-ink-mid hover:border-ink-mid hover:text-ink'
    }`}
    style={{ fontSize: 12 }}
  >
    <span aria-hidden="true" style={{ fontFamily: 'var(--serif)', fontSize: 13, opacity: on ? 1 : 0.75 }}>
      {kanji}
    </span>
    <span className="flex-1 text-left">{label}</span>
    <span
      className={on ? '' : 'text-ink-pale'}
      style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}
    >
      {count}
    </span>
  </button>
);

export interface CasePanelProps {
  // Include-inactive graph option

  // Case file — company variant
  activeMainTab: 'company' | 'individual';
  graphLoaded: boolean;
  caseTarget?: GraphNode;
  entityCount: number;
  caseDepth: number;
  caseFlags: number;
  caseOpened?: string;

  // Case file — person variant
  personSearchName: string;
  personResultsCount: number;
  personActiveCount: number;
  personFlagsCount: number;
  personSearchOpened?: string;

  // Role filter — hides director/shareholder people so a prolific chart reads.
  // View-only: nothing is refetched and exports still carry the whole chart.
  hideDirectors: boolean;
  hideShareholders: boolean;
  onToggleHideDirectors: () => void;
  onToggleHideShareholders: () => void;
  roleCounts: { directors: number; shareholders: number };

  trail: { time: string; text: string }[];

  // Notes (Stage B) — section renders only when there are notes
  caseNotes: CaseNote[];
  noteTabLabels: Record<string, string>; // tabId → tab label (open tabs)
  onDeleteNote: (noteId: string) => void;
  onJumpToNote: (note: CaseNote) => void;

  // People in common (Stage D) — derived here from the open tabs
  companyTabs: PeopleCompanyTabInput[];
  individualTabs: PeopleIndividualTabInput[];
  onJumpToPerson: (person: SharedPerson, appearance: SharedPersonAppearance) => void;

  // Changes (Stage C) — save-point status diff. null = no check run yet
  // (section hidden); set once "Check for changes" has run.
  nodeDiffs: NodeDiff[] | null;
  lastCheckedSavePointName: string;
  isCheckingChanges: boolean;
  onJumpToChange: (diff: NodeDiff) => void;

  // Save points
  savePoints: GraphSnapshot[];
  onLoadSavePoint: (snap: GraphSnapshot) => void;
  onDeleteSavePoint: (snapshotId: string, e: React.MouseEvent) => void;
  onExportSavePoint: (snap: GraphSnapshot) => void;
  onExportAllSavePoints: () => void;
  onTakeSavePoint: () => void;
  onImportSavePoint: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCheckChanges: (snap: GraphSnapshot) => void;

  // Exports footer
  onExportHtml: () => void;
  isExportingHtml: boolean;
  canExport: boolean;
}

export const CasePanel: React.FC<CasePanelProps> = ({
  activeMainTab,
  graphLoaded,
  caseTarget,
  entityCount,
  caseDepth,
  caseFlags,
  caseOpened,
  personSearchName,
  personResultsCount,
  personActiveCount,
  personFlagsCount,
  personSearchOpened,
  hideDirectors,
  hideShareholders,
  onToggleHideDirectors,
  onToggleHideShareholders,
  roleCounts,
  trail,
  caseNotes,
  noteTabLabels,
  onDeleteNote,
  onJumpToNote,
  companyTabs,
  individualTabs,
  onJumpToPerson,
  nodeDiffs,
  lastCheckedSavePointName,
  isCheckingChanges,
  onJumpToChange,
  savePoints,
  onLoadSavePoint,
  onDeleteSavePoint,
  onExportSavePoint,
  onExportAllSavePoints,
  onTakeSavePoint,
  onImportSavePoint,
  onCheckChanges,
  onExportHtml,
  isExportingHtml,
  canExport,
}) => {
  const importInputRef = useRef<HTMLInputElement>(null);

  // ponytail: array-identity memo is enough today; upgrade to a content fingerprint if node drags make this hot.
  const peopleInCommon = useMemo(
    () => computePeopleInCommon(companyTabs, individualTabs),
    [companyTabs, individualTabs]
  );

  // Group notes by tab label (insertion order); notes whose tab has been
  // closed still list, under "Closed tabs".
  const noteGroups: { label: string; notes: CaseNote[] }[] = [];
  {
    const byLabel = new Map<string, CaseNote[]>();
    for (const n of caseNotes) {
      const label = noteTabLabels[n.tabId] ?? 'Closed tabs';
      let bucket = byLabel.get(label);
      if (!bucket) {
        bucket = [];
        byLabel.set(label, bucket);
        noteGroups.push({ label, notes: bucket });
      }
      bucket.push(n);
    }
  }

  const showCompanyFile = activeMainTab === 'company' && graphLoaded;
  const showPersonFile = activeMainTab === 'individual' && personResultsCount > 0;

  return (
    <div className="flex-1 min-w-0 border-r border-rule bg-paper flex flex-col overflow-hidden">

      {/* ── The dossier: one scrolling column of stacked sections ── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* CASE FILE — reflects the ACTIVE main tab, not whichever entity loaded last */}
        {showCompanyFile && (
          <Section title="Case file">
            <div className="px-[18px] pb-3.5 border-b border-rule">
              <h3 className="text-ink" style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 17, margin: '0 0 3px', lineHeight: 1.3 }}>
                {caseTarget?.data.entityName || caseTarget?.data.label}
              </h3>
              <span className="text-ink-mid" style={{ fontFamily: 'var(--mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                {caseTarget?.data.nzbn ? `NZBN ${caseTarget.data.nzbn}` : ''}{caseOpened ? ` · opened ${caseOpened}` : ''}
              </span>
            </div>
            <div className="grid grid-cols-3 border-b border-rule">
              <Stat value={entityCount} label="Entities" />
              <Stat value={caseDepth} label="Depth" />
              <Stat value={caseFlags} label="Flags" crit={caseFlags > 0} last />
            </div>
            <Trail trail={trail} />
          </Section>
        )}
        {showPersonFile && (
          <Section title="Case file">
            <div className="px-[18px] pb-3.5 border-b border-rule">
              <h3 className="text-ink" style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 17, margin: '0 0 3px', lineHeight: 1.3 }}>
                {personSearchName}
              </h3>
              <span className="text-ink-mid" style={{ fontFamily: 'var(--mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                {personResultsCount} {personResultsCount === 1 ? 'company' : 'companies'}{personSearchOpened ? ` · searched ${personSearchOpened}` : ''}
              </span>
            </div>
            <div className="grid grid-cols-3 border-b border-rule">
              <Stat value={personResultsCount} label="Companies" />
              <Stat value={personActiveCount} label="Active" />
              <Stat value={personFlagsCount} label="Flags" crit={personFlagsCount > 0} last />
            </div>
            <Trail trail={trail} />
          </Section>
        )}

        {/* VIEW — role filter. A prolific company brings hundreds of director
               and shareholder people, and the chart becomes unreadable long
               before it becomes wrong. Hiding them is a view over the same
               data: nothing is refetched, and exports and save points still
               carry the whole chart. */}
        {showCompanyFile && graphLoaded && (roleCounts.directors > 0 || roleCounts.shareholders > 0) && (
          <Section title="View">
            <div className="px-[18px] pb-3 flex flex-col gap-1.5">
              {roleCounts.directors > 0 && (
                <RoleToggle
                  on={hideDirectors}
                  onClick={onToggleHideDirectors}
                  kanji="締"
                  label="Hide directors"
                  count={roleCounts.directors}
                />
              )}
              {roleCounts.shareholders > 0 && (
                <RoleToggle
                  on={hideShareholders}
                  onClick={onToggleHideShareholders}
                  kanji="株"
                  label="Hide shareholders"
                  count={roleCounts.shareholders}
                />
              )}
              {hideDirectors && hideShareholders && (
                <p className="text-ink-pale" style={{ fontSize: 10.5, marginTop: 2 }}>
                  Corporate structure only. Someone who is both a director and a
                  shareholder is hidden only while both are off.
                </p>
              )}
            </div>
          </Section>
        )}

        {/* NOTES — node annotations (Stage B); rows grouped by tab, click
               jumps to the tab and highlights the node by key. */}
        {caseNotes.length > 0 && (
          <Section title="Notes" count={caseNotes.length}>
            <div className="pb-2">
              {noteGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-[18px] pt-1 pb-1 uppercase text-ink-pale truncate" style={{ fontSize: 10, letterSpacing: '.08em' }}>
                    {group.label}
                  </p>
                  {group.notes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => onJumpToNote(note)}
                      className="group relative flex gap-2 px-[18px] py-1.5 cursor-pointer hover:bg-paper2 transition-colors"
                      title={note.text}
                    >
                      {/* dog-ear glyph — same fold as on the node */}
                      <span
                        aria-hidden="true"
                        className="shrink-0"
                        style={{
                          width: 0,
                          height: 0,
                          marginTop: 4,
                          borderTop: `8px solid ${note.flag ? 'var(--accent)' : 'var(--ink)'}`,
                          borderRight: '8px solid transparent',
                        }}
                      />
                      <div className="flex-1 min-w-0 pr-5">
                        <p className="font-bold text-ink truncate" style={{ fontSize: 12.5 }}>{note.nodeLabel}</p>
                        <p className="text-ink-mid truncate" style={{ fontSize: 12 }}>{note.text}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                        className="absolute top-1.5 right-[14px] p-1 text-ink-pale hover:text-crit opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Delete note on ${note.nodeLabel}`}
                        title="Delete note"
                      >
                        <Trash2 size={13} strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* PEOPLE IN COMMON — people appearing in ≥2 open tabs (Stage D);
               row expands to tab chips → jump + highlight by person key. */}
        <PeopleSection people={peopleInCommon} onJumpToPerson={onJumpToPerson} />

        {/* ── STAGE C MOUNT POINT: CHANGES section renders here (statusDiff
               results, "Registered → In Liquidation" detail rows). ── */}
        <ChangesSection
          diffs={nodeDiffs}
          savePointName={lastCheckedSavePointName}
          isChecking={isCheckingChanges}
          onJumpToChange={onJumpToChange}
        />

        {/* SAVE POINTS — always present so the first save/import is reachable */}
        <Section
          title="Save points"
          count={savePoints.length}
          actions={
            <>
              <input
                type="file"
                ref={importInputRef}
                onChange={onImportSavePoint}
                accept=".json"
                className="hidden"
              />
              <button onClick={() => importInputRef.current?.click()} className="text-ink-mid hover:text-ink transition-colors" aria-label="Import save point" title="Import save point">
                <Upload size={15} strokeWidth={1.5} />
              </button>
              <button onClick={onTakeSavePoint} className="text-ink-mid hover:text-ink transition-colors" aria-label="Save a save point" title="Save a save point">
                <Camera size={15} strokeWidth={1.5} />
              </button>
            </>
          }
        >
          <div className="px-4 pb-4 space-y-2">
            {savePoints.length === 0 && (
              <p className="text-ink-pale italic" style={{ fontSize: 12 }}>No save points yet.</p>
            )}
            {savePoints.map((snap) => (
              <div key={snap.id} className="p-3 bg-paper border border-rule hover:border-ink-mid transition-colors group relative">
                <div onClick={() => onLoadSavePoint(snap)} className="cursor-pointer pr-6">
                  <p className="text-ink font-medium truncate" style={{ fontSize: 13 }}>{snap.name}</p>
                  <p className="text-ink-mid mt-0.5" style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>
                    {new Date(snap.dateCreated).toLocaleDateString()}
                    {snap.searchType === 'person' && (
                      <span className="ml-1.5 text-amber">Session only</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={(e) => onDeleteSavePoint(snap.id, e)}
                  className="absolute top-2 right-2 p-1 text-ink-pale hover:text-crit opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete save point"
                  title="Delete save point"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
                {snap.searchType === 'company' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCheckChanges(snap); }}
                    disabled={isCheckingChanges}
                    className="absolute bottom-2 left-2 p-1 text-ink-pale hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                    aria-label="Check for changes since this save point"
                    title="Check for changes"
                  >
                    <RefreshCw size={13} strokeWidth={1.5} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onExportSavePoint(snap); }}
                  className="absolute bottom-2 right-2 p-1 text-ink-pale hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Export save point JSON"
                  title="Export save point (JSON)"
                >
                  <Download size={13} strokeWidth={1.5} />
                </button>
              </div>
            ))}
            {savePoints.length > 0 && (
              <button
                onClick={onExportAllSavePoints}
                className="w-full mt-1 px-3 py-2 border border-rule text-ink hover:border-ink-mid transition-colors flex items-center justify-center gap-2"
                style={{ fontSize: 12 }}
              >
                <Download size={14} strokeWidth={1.5} />
                Export all save points
              </button>
            )}
          </div>
        </Section>
      </div>

      {/* ── Exports footer ── */}
      {showCompanyFile && (
        <div className="p-[18px] border-t border-rule flex-shrink-0">
          <button
            onClick={onExportHtml}
            disabled={isExportingHtml || !canExport}
            className="block w-full text-center px-3 py-3 mb-2 bg-ink text-paper hover:bg-accent hover:text-accent-ink transition-colors disabled:opacity-50"
            style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.01em' }}
          >
            {isExportingHtml ? 'Exporting…' : 'Export interactive chart'}
          </button>
          <button
            onClick={onTakeSavePoint}
            disabled={!canExport}
            className="w-full text-center px-3 py-2 text-ink-mid hover:text-ink transition-colors disabled:opacity-50"
            style={{ fontSize: 12.5 }}
          >
            Save point · JSON
          </button>
        </div>
      )}
      {showPersonFile && (
        <div className="p-[18px] border-t border-rule flex-shrink-0">
          <button
            onClick={onExportHtml}
            disabled={isExportingHtml}
            className="block w-full text-center px-3 py-3 bg-ink text-paper hover:bg-accent hover:text-accent-ink transition-colors disabled:opacity-50"
            style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.01em' }}
          >
            {isExportingHtml ? 'Exporting…' : 'Export report · HTML'}
          </button>
        </div>
      )}
    </div>
  );
};
