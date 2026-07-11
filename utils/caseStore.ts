import type {
  CaseNote,
  CaseSession,
  CompanyTab,
  GraphNode,
  GraphSnapshot,
  PersistedCompanyTab,
} from '../types';

/**
 * Cases workspace persistence (see design/CASES_PLAN.md).
 *
 * Keys:
 *   mitsuketa_session_v1     — the one implicit CaseSession (tabs + notes)
 *   mitsuketa_savepoints_v1  — GraphSnapshot[] ("Save points" in the UI)
 *   mitsuketa_snapshots      — LEGACY. Migrated verbatim into savepoints on
 *                              first boot, then left untouched (kept unwritten
 *                              for rollback; deletion is skip-for-now).
 *
 * Debouncing is the CALLER's responsibility: App.tsx owns the single
 * ~1.5s-debounced persist effect on [graphTabs, activeCompanyTabId, caseNotes].
 * saveSession() itself writes synchronously.
 *
 * Compliance: Individual (person) tabs must never reach saveSession — the
 * caller only passes CompanyTab[] and the types enforce it. Person save
 * points are filtered by the caller (same rule as the legacy snapshot effect).
 */

export const SESSION_KEY = 'mitsuketa_session_v1';
export const SAVEPOINTS_KEY = 'mitsuketa_savepoints_v1';
export const LEGACY_SNAPSHOTS_KEY = 'mitsuketa_snapshots';

// ── Tab serialization ──────────────────────────────────────────────────────

/** Strip per-render transients so persisted graphs rehydrate clean. */
const stripTransients = (nodes: GraphNode[]): GraphNode[] =>
  nodes.map((n) => {
    const { isHighlighted: _h, isExpanding: _e, ...data } = n.data;
    const { selected: _s, ...node } = n as GraphNode & { selected?: boolean };
    return { ...node, data } as GraphNode;
  });

/**
 * CompanyTab → PersistedCompanyTab. Only allNodesInMemory + edges are kept;
 * visible nodes are rebuilt on load (assignDepths → layout → styleEdgesByDepth
 * in App.tsx), so tab.nodes is deliberately dropped.
 */
export const toPersistedTab = (tab: CompanyTab): PersistedCompanyTab => ({
  id: tab.id,
  label: tab.label,
  nzbn: tab.nzbn,
  searchQuery: tab.searchQuery,
  allNodesInMemory: stripTransients(tab.allNodesInMemory),
  edges: tab.edges,
  ...(tab.compare ? { compare: tab.compare } : {}),
});

/** Quota-guard stub: the tab survives as a re-searchable placeholder. */
const toStubTab = (tab: PersistedCompanyTab): PersistedCompanyTab => ({
  id: tab.id,
  label: tab.label,
  nzbn: tab.nzbn,
  searchQuery: tab.searchQuery,
  allNodesInMemory: [],
  edges: [],
});

const isQuotaError = (err: unknown): boolean =>
  err instanceof DOMException &&
  (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');

// ── Session ────────────────────────────────────────────────────────────────

export const loadSession = (): CaseSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CaseSession;
    if (parsed?.version !== 1 || !Array.isArray(parsed.companyTabs)) return null;
    return parsed;
  } catch (err) {
    console.warn('caseStore: failed to load session', err);
    return null;
  }
};

export interface SaveSessionResult {
  ok: boolean;
  /** Labels of tabs whose graphs were dropped to stubs to fit quota (for trail logging). */
  droppedTabLabels: string[];
}

/**
 * Persist the session. On QuotaExceededError, repeatedly drop the largest
 * tab's graph to a {id,label,nzbn,searchQuery} stub and retry until the write
 * fits (or everything is stubbed). Synchronous — caller debounces.
 */
export const saveSession = (
  companyTabs: CompanyTab[],
  activeCompanyTabId: string | null,
  notes: CaseNote[],
): SaveSessionResult => {
  let tabs = companyTabs.map(toPersistedTab);
  const droppedTabLabels: string[] = [];

  for (;;) {
    const session: CaseSession = {
      version: 1,
      companyTabs: tabs,
      activeCompanyTabId,
      notes,
      updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { ok: true, droppedTabLabels };
    } catch (err) {
      if (!isQuotaError(err)) {
        console.warn('caseStore: failed to save session', err);
        return { ok: false, droppedTabLabels };
      }
      // Find the largest still-un-stubbed tab and stub it.
      let largestIdx = -1;
      let largestSize = 0;
      tabs.forEach((t, i) => {
        if (t.allNodesInMemory.length === 0 && t.edges.length === 0) return;
        const size = JSON.stringify(t).length;
        if (size > largestSize) {
          largestSize = size;
          largestIdx = i;
        }
      });
      if (largestIdx === -1) {
        console.warn('caseStore: session exceeds quota even fully stubbed');
        return { ok: false, droppedTabLabels };
      }
      droppedTabLabels.push(tabs[largestIdx].label);
      tabs = tabs.map((t, i) => (i === largestIdx ? toStubTab(t) : t));
    }
  }
};

// ── Save points (formerly "snapshots") ─────────────────────────────────────

/**
 * Load save points, running the one-time migration: if mitsuketa_savepoints_v1
 * has never been written and the legacy mitsuketa_snapshots key exists, copy
 * it verbatim. The legacy key is left in place but never written again.
 */
export const loadSavePoints = (): GraphSnapshot[] => {
  try {
    const raw = localStorage.getItem(SAVEPOINTS_KEY);
    if (raw !== null) return JSON.parse(raw) as GraphSnapshot[];
    const legacy = localStorage.getItem(LEGACY_SNAPSHOTS_KEY);
    if (legacy !== null) {
      localStorage.setItem(SAVEPOINTS_KEY, legacy); // verbatim copy
      return JSON.parse(legacy) as GraphSnapshot[];
    }
    return [];
  } catch (err) {
    console.warn('caseStore: failed to load save points', err);
    return [];
  }
};

/** Persist save points. Caller must pre-filter person snapshots (compliance). */
export const saveSavePoints = (savePoints: GraphSnapshot[]): void => {
  try {
    localStorage.setItem(SAVEPOINTS_KEY, JSON.stringify(savePoints));
  } catch (err) {
    console.warn('caseStore: failed to save save points', err);
  }
};
