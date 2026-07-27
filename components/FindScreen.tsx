import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { EntitySearchResultItem } from '../types';
import type { CompareEndpoint, CompareProgress } from '../services/compareService';
import { PropertyScreen } from './PropertyScreen';
import {
  addRecentSearch,
  clearRecentSearches,
  loadRecentSearches,
  type RecentSearch,
} from '../utils/recentSearches';

export interface FindScreenProps {
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSearchSubmit: () => void;
  results: EntitySearchResultItem[];       // live suggestions
  onResultSelect: (item: EntitySearchResultItem) => void;
  isLoading: boolean;
  searchMode: 'company' | 'person';
  onSearchModeChange: (m: 'company' | 'person') => void;
  // Compare mode (A ↔ B connection search)
  onCompare: (a: CompareEndpoint, b: CompareEndpoint, maxHops?: number) => void;
  onCompareCancel: () => void;
  compareProgress: CompareProgress | null;
  compareNoLink: { hops: number; examined: number } | null;
  onCompareReset: () => void;
  fetchCompanySuggestions: (q: string) => Promise<EntitySearchResultItem[]>;
  includeInactive: boolean;
  onIncludeInactiveToggle: (checked: boolean) => void;
}

const MAX_SUGGESTIONS = 6;

// ── Compare slot ─────────────────────────────────────────────────────────────
// One endpoint input (A or B). Company kind: live register suggestions;
// selecting one locks {nzbn, name}. Person kind: free text.

interface CompareSlotState {
  kind: 'company' | 'person';
  text: string;
  locked: { nzbn: string; name: string } | null;
}

const EMPTY_SLOT: CompareSlotState = { kind: 'company', text: '', locked: null };

const slotToEndpoint = (s: CompareSlotState): CompareEndpoint | null => {
  if (s.kind === 'company') {
    return s.locked ? { kind: 'company', nzbn: s.locked.nzbn, name: s.locked.name } : null;
  }
  return s.text.trim() ? { kind: 'person', name: s.text.trim() } : null;
};

const CompareSlot: React.FC<{
  label: string;
  slot: CompareSlotState;
  onChange: (s: CompareSlotState) => void;
  fetchCompanySuggestions: (q: string) => Promise<EntitySearchResultItem[]>;
  disabled: boolean;
}> = ({ label, slot, onChange, fetchCompanySuggestions, disabled }) => {
  const [suggestions, setSuggestions] = useState<EntitySearchResultItem[]>([]);

  // Debounced company suggestions while unlocked
  useEffect(() => {
    if (slot.kind !== 'company' || slot.locked || slot.text.trim().length < 2 || disabled) {
      setSuggestions([]);
      return;
    }
    let stale = false;
    const t = setTimeout(async () => {
      const items = await fetchCompanySuggestions(slot.text.trim());
      if (!stale) setSuggestions(items.slice(0, MAX_SUGGESTIONS));
    }, 250);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [slot.kind, slot.text, slot.locked, disabled, fetchCompanySuggestions]);

  const pick = (item: EntitySearchResultItem) => {
    onChange({ ...slot, text: item.entityName, locked: { nzbn: item.nzbn, name: item.entityName } });
    setSuggestions([]);
  };

  return (
    <div className="text-left" style={{ border: '1px solid var(--ink-mid)', background: 'var(--paper)' }}>
      <div className="flex items-center">
        <span
          className="text-ink-pale"
          style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '0 0 0 14px', width: 26 }}
          aria-hidden="true"
        >
          {label}
        </span>
        <input
          value={slot.text}
          disabled={disabled}
          onChange={(e) => onChange({ ...slot, text: e.target.value, locked: null })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && suggestions.length > 0) {
              e.preventDefault();
              pick(suggestions[0]);
            }
          }}
          aria-label={`Endpoint ${label} — ${slot.kind === 'company' ? 'company name or NZBN' : 'person name'}`}
          placeholder={slot.kind === 'company' ? 'Company name or NZBN' : 'Person name'}
          className="flex-1 bg-transparent"
          style={{
            border: 'none',
            padding: '13px 12px 12px',
            font: 'inherit',
            fontSize: 14.5,
            color: 'var(--ink)',
            outline: 'none',
          }}
        />
        {slot.kind === 'company' && slot.locked && (
          <span
            className="whitespace-nowrap text-ink-pale"
            style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontVariantNumeric: 'tabular-nums', paddingRight: 12 }}
          >
            NZBN {slot.locked.nzbn}
          </span>
        )}
        {/* Tiny Company/Person kind toggle */}
        <span className="flex items-center gap-2" style={{ paddingRight: 14, fontSize: 10.5 }}>
          {(['company', 'person'] as const).map((k) => (
            <button
              key={k}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ kind: k, text: '', locked: null })}
              style={{
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                padding: '2px 1px',
                borderBottom: `1px solid ${slot.kind === k ? 'var(--accent)' : 'transparent'}`,
                color: slot.kind === k ? 'var(--ink)' : 'var(--ink-pale)',
              }}
            >
              {k === 'company' ? 'Company' : 'Person'}
            </button>
          ))}
        </span>
      </div>

      {suggestions.length > 0 && (
        <div style={{ borderTop: '1px solid var(--rule)' }} role="listbox" aria-label={`Endpoint ${label} suggestions`}>
          {suggestions.map((item, i) => (
            <div
              key={item.nzbn || item.entityName + i}
              role="option"
              aria-selected={false}
              tabIndex={0}
              onClick={() => pick(item)}
              onKeyDown={(e) => e.key === 'Enter' && pick(item)}
              className="flex justify-between items-baseline gap-3.5 cursor-pointer find-compare-suggestion"
              style={{
                padding: '9px 14px',
                borderBottom: i === suggestions.length - 1 ? 'none' : '1px solid var(--rule)',
              }}
            >
              <b style={{ fontWeight: 600, fontSize: 13 }}>{item.entityName}</b>
              <span
                className="whitespace-nowrap text-ink-mid"
                style={{ fontFamily: 'var(--mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
              >
                NZBN {item.nzbn}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Full-bleed landing panel shown when no graph/person results exist.
 * Re-skins the existing search entry point per SUMI_SPEC.md §3 "The find".
 * Fills its parent container — mount inside a `position: relative` box with
 * a defined height (the integration agent replaces the old empty-state div).
 */
export const FindScreen: React.FC<FindScreenProps> = ({
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  results,
  onResultSelect,
  isLoading,
  searchMode,
  onSearchModeChange,
  onCompare,
  onCompareCancel,
  compareProgress,
  compareNoLink,
  onCompareReset,
  fetchCompanySuggestions,
  includeInactive,
  onIncludeInactiveToggle,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recent, setRecent] = useState<RecentSearch[]>(() => loadRecentSearches());
  // Compare mode — third face of the mode line. Slots + last-used hop budget.
  const [compareMode, setCompareMode] = useState(false);
  // 家族 — fourth face: LINZ property titles, behind its own sign-in. The unlock
  // itself lives in utils/propertySession.ts, so leaving this screen and coming
  // back does not ask again; only a reload or a new tab does.
  const [propertyMode, setPropertyMode] = useState(false);
  // The mode line now has four faces. These keep the JSX guards legible.
  const findFace = !compareMode && !propertyMode;
  const compareFace = compareMode && !propertyMode;
  const [slotA, setSlotA] = useState<CompareSlotState>(EMPTY_SLOT);
  const [slotB, setSlotB] = useState<CompareSlotState>(EMPTY_SLOT);
  const [lastMaxHops, setLastMaxHops] = useState(4);
  // Re-running a recent search must wait until the parent's query/mode state
  // has round-tripped back through props — onSearchSubmit reads parent state.
  const pendingRerun = useRef<RecentSearch | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  useEffect(() => {
    const p = pendingRerun.current;
    if (p && p.q === searchQuery && p.mode === searchMode) {
      pendingRerun.current = null;
      onSearchSubmit();
    }
  }, [searchQuery, searchMode, onSearchSubmit]);

  const visibleResults = results.slice(0, MAX_SUGGESTIONS);

  const recordSearch = (q: string) => {
    if (q.trim()) setRecent(addRecentSearch({ q, mode: searchMode }));
  };

  const submitSearch = () => {
    recordSearch(searchQuery);
    onSearchSubmit();
  };

  const isComparing = compareProgress !== null;
  const endpointA = slotToEndpoint(slotA);
  const endpointB = slotToEndpoint(slotB);

  // Compare searches are NOT recorded in recents (deferred).
  const submitCompare = (maxHops: number = 4) => {
    if (!endpointA || !endpointB || isComparing) return;
    setLastMaxHops(maxHops);
    onCompare(endpointA, endpointB, maxHops);
  };

  const rerunRecent = (entry: RecentSearch) => {
    setRecent(addRecentSearch(entry)); // bump to top
    if (entry.q === searchQuery && entry.mode === searchMode) {
      onSearchSubmit(); // parent state already current — submit now
      return;
    }
    pendingRerun.current = entry;
    if (entry.mode !== searchMode) onSearchModeChange(entry.mode);
    onSearchQueryChange(entry.q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (visibleResults.length > 0 && visibleResults[selectedIndex]) {
        recordSearch(searchQuery);
        onResultSelect(visibleResults[selectedIndex]);
      } else {
        submitSearch();
      }
    } else if (e.key === 'ArrowDown' && visibleResults.length > 0) {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, visibleResults.length - 1));
    } else if (e.key === 'ArrowUp' && visibleResults.length > 0) {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
  };

  return (
    <div
      className={`relative w-full h-full min-h-[620px] grid ${
        // A title report is a long document, not a centred hero: it has to
        // scroll and start at the top, or most of the memorials are unreachable.
        propertyMode
          ? 'overflow-y-auto items-start justify-items-center py-10'
          : 'overflow-hidden place-items-center'
      }`}
      style={{ position: 'relative' }}
    >
      {/* Brushed enso ring — decoration for the hero, noise behind a report. */}
      {!propertyMode && (
      <svg
        className="find-enso pointer-events-none absolute left-1/2 top-1/2"
        style={{
          width: 540,
          height: 540,
          transform: 'translate(-50%, -54%)',
          opacity: 0.1,
        }}
        viewBox="0 0 540 540"
        aria-hidden="true"
      >
        <circle
          className="find-enso-circle"
          cx={270}
          cy={270}
          r={250}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray="1560 200"
        />
      </svg>
      )}

      <div
        className="relative text-center"
        // Reports are dense lists of memorials; 660px is a hero width, not a
        // reading width.
        style={{ width: propertyMode ? 'min(900px, 92%)' : 'min(660px, 88%)' }}
      >
        <h2
          style={{
            fontFamily: 'var(--serif)',
            fontWeight: 600,
            fontSize: 'clamp(28px, 4vw, 40px)',
            letterSpacing: '.01em',
            margin: '0 0 6px',
          }}
        >
          Who owns what?
        </h2>
        <p className="text-ink-mid" style={{ fontSize: 13, margin: '0 0 34px' }}>
          <span style={{ fontFamily: 'var(--serif)', letterSpacing: '.3em', marginRight: 10, color: 'var(--ink)' }}>
            見つけた
          </span>
          mitsuketa · &quot;found it&quot; — search the NZ registers and say it yourself
        </p>

        {/* Big search */}
        {findFace && (
        <div
          className="find-bigsearch flex text-left relative overflow-hidden"
          style={{ border: '1px solid var(--ink-mid)', background: 'var(--paper)' }}
        >
          {isLoading && (
            <span
              className="find-loadbar absolute top-0 left-0 h-[2px] bg-accent"
              aria-hidden="true"
              style={{ width: '40%' }}
            />
          )}
          <input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search company or person"
            placeholder={searchMode === 'company' ? 'Search by company name or NZBN' : 'Search by person name'}
            className="flex-1 bg-transparent"
            style={{
              border: 'none',
              padding: '17px 20px 16px',
              font: 'inherit',
              fontSize: 16,
              color: 'var(--ink)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={submitSearch}
            aria-label="Search"
            className="transition-colors duration-150"
            style={{
              padding: '0 26px',
              background: 'var(--ink)',
              color: 'var(--paper)',
              fontSize: 14,
              letterSpacing: '.04em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent-ink)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--ink)';
              e.currentTarget.style.color = 'var(--paper)';
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Search size={15} strokeWidth={1.5} aria-hidden="true" />
              Search
            </span>
          </button>
        </div>
        )}

        {/* Include inactive/removed entities — off by default (fewer API calls) */}
        {findFace && (
          <label className="flex items-center gap-2 mt-3 cursor-pointer select-none text-left">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => onIncludeInactiveToggle(e.target.checked)}
              className="w-4 h-4 accent-[color:var(--accent)] cursor-pointer"
            />
            <span className="text-ink-mid" style={{ fontSize: 12.5 }}>
              Include inactive &amp; removed entities
              <span className="text-ink-pale" style={{ fontSize: 12.5 }}> — slower, adds struck-off parents and subsidiaries</span>
            </span>
          </label>
        )}

        {/* Suggestions */}
        {findFace && visibleResults.length > 0 && (
          <div
            className="text-left"
            style={{ border: '1px solid var(--rule)', borderTop: 'none', background: 'var(--paper)' }}
            role="listbox"
            aria-label="Search suggestions"
          >
            {visibleResults.map((item, i) => (
              <div
                key={item.nzbn || item.entityName + i}
                role="option"
                aria-selected={i === selectedIndex}
                tabIndex={0}
                onClick={() => {
                  recordSearch(searchQuery);
                  onResultSelect(item);
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    recordSearch(searchQuery);
                    onResultSelect(item);
                  }
                }}
                className="flex justify-between items-baseline gap-3.5 cursor-pointer"
                style={{
                  padding: '11px 20px',
                  borderBottom: i === visibleResults.length - 1 ? 'none' : '1px solid var(--rule)',
                  background: i === selectedIndex ? 'oklch(from var(--accent) l c h / .12)' : undefined,
                }}
              >
                <b style={{ fontWeight: 600, fontSize: 13.5 }}>{item.entityName}</b>
                <span
                  className="whitespace-nowrap text-ink-mid"
                  style={{ fontFamily: 'var(--mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
                >
                  NZBN {item.nzbn}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Compare (A ↔ B) */}
        {compareFace && (
          <div className="text-left">
            <CompareSlot
              label="A"
              slot={slotA}
              onChange={(s) => { setSlotA(s); onCompareReset(); }}
              fetchCompanySuggestions={fetchCompanySuggestions}
              disabled={isComparing}
            />
            <div
              className="text-ink-pale text-center"
              style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: '20px', margin: '2px 0' }}
              aria-hidden="true"
            >
              ↔
            </div>
            <CompareSlot
              label="B"
              slot={slotB}
              onChange={(s) => { setSlotB(s); onCompareReset(); }}
              fetchCompanySuggestions={fetchCompanySuggestions}
              disabled={isComparing}
            />

            {(slotA.kind === 'person' || slotB.kind === 'person') && (
              <p className="text-ink-pale" style={{ fontSize: 10.5, margin: '8px 1px 0', letterSpacing: '.02em' }}>
                People are matched by name — same-name individuals can’t be distinguished.
              </p>
            )}

            {/* Action row: idle button / in-progress status */}
            {isComparing ? (
              <div
                className="relative overflow-hidden flex items-center justify-between gap-3"
                style={{ border: '1px solid var(--rule)', marginTop: 14, padding: '10px 14px' }}
              >
                <span
                  className="find-loadbar absolute top-0 left-0 h-[2px] bg-accent"
                  aria-hidden="true"
                  style={{ width: '40%' }}
                />
                <span
                  className="text-ink-mid"
                  style={{ fontSize: 12.5, fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }}
                  role="status"
                >
                  Tracing connection · hop {compareProgress.hop} of {lastMaxHops} · {compareProgress.entitiesExamined} entities examined
                </span>
                <button
                  type="button"
                  onClick={onCompareCancel}
                  className="text-ink whitespace-nowrap"
                  style={{ border: '1px solid var(--rule)', padding: '4px 12px', fontSize: 12 }}
                >
                  Stop
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => submitCompare(4)}
                disabled={!endpointA || !endpointB}
                className="w-full transition-colors duration-150"
                style={{
                  marginTop: 14,
                  padding: '12px 0 11px',
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  fontSize: 14,
                  letterSpacing: '.04em',
                  opacity: !endpointA || !endpointB ? 0.45 : 1,
                }}
                onMouseEnter={(e) => {
                  if (endpointA && endpointB) {
                    e.currentTarget.style.background = 'var(--accent)';
                    e.currentTarget.style.color = 'var(--accent-ink)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--ink)';
                  e.currentTarget.style.color = 'var(--paper)';
                }}
              >
                Compare
              </button>
            )}

            {/* No connection found */}
            {compareNoLink && !isComparing && (
              <div
                className="flex items-baseline justify-between gap-3"
                style={{ border: '1px solid var(--rule)', marginTop: 10, padding: '10px 14px' }}
              >
                <span className="text-ink-mid" style={{ fontSize: 12.5 }}>
                  No connection found within {compareNoLink.hops} hops · {compareNoLink.examined} entities examined
                </span>
                {compareNoLink.hops < 6 && (
                  <button
                    type="button"
                    onClick={() => submitCompare(6)}
                    className="text-ink whitespace-nowrap"
                    style={{ border: '1px solid var(--rule)', padding: '4px 12px', fontSize: 12 }}
                  >
                    Search deeper · 6 hops
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {propertyMode && (
          <div style={{ marginTop: 4 }}>
            <PropertyScreen />
          </div>
        )}

        {/* Mode line */}
        <div className="text-ink-mid" style={{ marginTop: 26, fontSize: 12.5 }}>
          <button
            type="button"
            onClick={() => { setCompareMode(false); setPropertyMode(false); onSearchModeChange('company'); }}
            style={{
              borderBottom: `1px solid ${findFace && searchMode === 'company' ? 'var(--accent)' : 'var(--rule)'}`,
              padding: '2px 1px',
              margin: '0 8px',
              color: findFace && searchMode === 'company' ? 'var(--ink)' : 'var(--ink-mid)',
            }}
          >
            Companies
          </button>
          ·
          <button
            type="button"
            onClick={() => { setCompareMode(false); setPropertyMode(false); onSearchModeChange('person'); }}
            style={{
              borderBottom: `1px solid ${findFace && searchMode === 'person' ? 'var(--accent)' : 'var(--rule)'}`,
              padding: '2px 1px',
              margin: '0 8px',
              color: findFace && searchMode === 'person' ? 'var(--ink)' : 'var(--ink-mid)',
            }}
          >
            People
          </button>
          ·
          <button
            type="button"
            onClick={() => { setCompareMode(true); setPropertyMode(false); onCompareReset(); }}
            style={{
              borderBottom: `1px solid ${compareFace ? 'var(--accent)' : 'var(--rule)'}`,
              padding: '2px 1px',
              margin: '0 8px',
              color: compareFace ? 'var(--ink)' : 'var(--ink-mid)',
            }}
          >
            <span style={{ fontFamily: 'var(--serif)', marginRight: 5 }}>比</span>
            Compare
          </button>
          ·
          {/* 家族 — kanji only, no English. Property titles, behind its own sign-in. */}
          <button
            type="button"
            onClick={() => { setCompareMode(false); setPropertyMode(true); }}
            aria-label="Property titles"
            title="Property titles"
            style={{
              borderBottom: `1px solid ${propertyMode ? 'var(--accent)' : 'var(--rule)'}`,
              padding: '2px 1px',
              margin: '0 8px',
              color: propertyMode ? 'var(--ink)' : 'var(--ink-mid)',
            }}
          >
            <span style={{ fontFamily: 'var(--serif)', letterSpacing: '.08em' }}>家族</span>
          </button>
          <span style={{ marginLeft: 18 }}>
            <kbd
              className="border-rule bg-paper2"
              style={{ border: '1px solid var(--rule)', padding: '2px 7px', fontFamily: 'var(--mono)', fontSize: 11 }}
            >
              Ctrl
            </kbd>{' '}
            +{' '}
            <kbd
              className="border-rule bg-paper2"
              style={{ border: '1px solid var(--rule)', padding: '2px 7px', fontFamily: 'var(--mono)', fontSize: 11 }}
            >
              K
            </kbd>{' '}
            from anywhere
          </span>
        </div>

        {/* Recent searches — quiet list, hidden while live suggestions show.
            Compare mode has its own slots and is not recorded in recents. */}
        {findFace && recent.length > 0 && visibleResults.length === 0 && (
          <div className="text-left" style={{ marginTop: 34 }}>
            <div
              className="flex items-baseline justify-between"
              style={{ borderBottom: '1px solid var(--rule)', paddingBottom: 6, marginBottom: 2 }}
            >
              <span
                className="text-ink-pale"
                style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase' }}
              >
                Recent
              </span>
              <button
                type="button"
                className="find-recent-clear text-ink-pale transition-colors duration-150"
                onClick={() => setRecent(clearRecentSearches())}
                style={{ fontSize: 10.5, letterSpacing: '.06em', padding: '0 1px' }}
              >
                clear
              </button>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Recent searches">
              {recent.map((entry) => {
                const isIdentifier = /^\d+$/.test(entry.q);
                return (
                  <li key={`${entry.mode}:${entry.q.toLowerCase()}`}>
                    <button
                      type="button"
                      className="find-recent-item flex w-full items-baseline justify-between gap-3.5 text-ink-mid transition-colors duration-150"
                      onClick={() => rerunRecent(entry)}
                      style={{
                        padding: '8px 1px',
                        borderBottom: '1px solid var(--rule)',
                        fontSize: 12.5,
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={
                          isIdentifier
                            ? { fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' }
                            : undefined
                        }
                      >
                        {entry.q}
                      </span>
                      <span
                        className="whitespace-nowrap text-ink-pale"
                        style={{ fontSize: 10.5, letterSpacing: '.08em' }}
                      >
                        {entry.mode === 'person' ? 'person' : 'company'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .find-enso-circle {
            stroke-dashoffset: 1560;
            animation: find-enso-draw 1.4s cubic-bezier(.4,0,.2,1) .2s forwards;
          }
          @keyframes find-enso-draw { to { stroke-dashoffset: 0; } }
          .find-loadbar {
            animation: find-loadbar-sweep 1.1s cubic-bezier(.4,0,.2,1) infinite;
          }
          @keyframes find-loadbar-sweep {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(350%); }
          }
        }
        .find-recent-item:hover,
        .find-recent-item:focus-visible { color: var(--ink); }
        .find-recent-item:hover > span:first-child,
        .find-recent-item:focus-visible > span:first-child {
          text-decoration: underline;
          text-decoration-color: var(--accent);
          text-underline-offset: 3px;
        }
        .find-recent-clear:hover,
        .find-recent-clear:focus-visible { color: var(--ink); }
        .find-compare-suggestion:hover,
        .find-compare-suggestion:focus-visible {
          background: oklch(from var(--accent) l c h / .12);
        }
        .find-compare-suggestion:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: -2px;
        }
        .find-recent-item:focus-visible,
        .find-recent-clear:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
        }
        @media (prefers-reduced-motion: reduce) {
          .find-enso-circle { stroke-dashoffset: 0; }
          .find-loadbar { transform: none; }
        }
      `}</style>
    </div>
  );
};

export default FindScreen;
