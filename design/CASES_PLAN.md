# Cases workspace — architecture plan (2026-07-11, approved pending user go)

Evolves the sidebar camera/snapshots into a "Cases" investigation workspace:
session auto-save, save-point diff, node notes, people-in-common. One implicit
case in v1 (multi-case deferred — CaseSession is already its serialization).

## Verified code facts the plan builds on
- Tabs are in-memory only; save-back effect at App.tsx:872-880 stamps live
  nodes/edges into the active CompanyTab — makes auto-save nearly free.
- Snapshots: GraphSnapshot (types.ts:90-99), persisted App.tsx:359-362 with
  person snapshots filtered (compliance). Handlers App.tsx:1004-1214; panel
  JSX inline at ~1690-1914 behind panelView 'case'|'snapshots'.
- enrichGraphNodes (src/api/companyStatusApi.ts:377) = 1 cached NZBN call per
  company node, concurrency 5 — the diff engine already exists.
- personId() (services/compareService.ts:66) = the one person-identity
  normalization (uppercase, sorted tokens, P- prefix). Reuse everywhere.
- CustomNodes corner inventory: target stamp top-right, +N/capped bottom-right;
  TOP-LEFT and BOTTOM-LEFT free for dog-ear + 変 badge.
- Export viewer shares CustomNodes — NodeData fields render in exports free.

## Data model (types.ts)
- CaseNote { id, key /* nzbn ?? personId(label) */, tabId, nodeLabel, text,
  flag, createdAt }
- CaseSession { version: 1, companyTabs: PersistedCompanyTab[],
  activeCompanyTabId, notes, updatedAt } → localStorage mitsuketa_session_v1,
  debounced ~1.5s.
- PersistedCompanyTab = { id, label, nzbn, searchQuery, allNodesInMemory,
  edges, compare? } — store allNodesInMemory only; visible nodes rebuilt on
  load via existing assignDepths/styleEdgesByDepth path. Strip transient
  fields (isHighlighted, isExpanding, selected).
- GraphSnapshot gains optional notes?: CaseNote[]. Snapshot IS the save point.
- Diff baseline = the save point's own status fields; no schema change, old
  snapshots diff with zero migration.
- Save points → mitsuketa_savepoints_v1 (migrated verbatim from
  mitsuketa_snapshots on boot; legacy key kept unwritten for rollback).
- Quota guard: try/catch; on QuotaExceededError drop largest tab's graph to a
  {id,label,nzbn,searchQuery} stub, retry, log to trail. No IndexedDB v1.

## Compliance
Individual (person) tabs NEVER written to session (extends the existing
person-snapshot rule). Person nodes inside company graphs persist (as today).
disqualifiedMatches/insolvencyMatches live only on IndividualTab → auto-excluded.

## Sidebar IA
Extract App.tsx panel JSX (~1690-1914) → components/CasePanel.tsx. panelView
state deleted; rail = Search + Case icon (replace Camera). One scrolling
dossier, stacked collapsible sections (NOT tabs), render only when non-empty:
CASE FILE / NOTES (n) / PEOPLE IN COMMON / CHANGES (n) / SAVE POINTS / exports
footer. Section headers in existing 10.5px uppercase tracked ink-pale voice.

## Diff ("Check for changes" button on save-point rows; never automatic)
utils/statusDiff.ts: diffStatuses(saved, fresh) → NodeDiff { nodeId, key,
label, prevStatus, prevBucket, newStatus, newBucket }. Flow: load save point →
enrichGraphNodes → diff → stamp data.diff on changed nodes. Cost = 1 call per
company node (same as normal enrichment); progress in trail. New status renders
via the normal ramp; the "changed" mark is INK ONLY: small ink square badge
(top-left, grammar of the +N badge), glyph 変, title="Was: X". Sidebar Changes
section carries "Registered → In Liquidation" detail. Diff marks session-only.
Compared fields: status buckets + raw status string; persons only
isDisqualified. Roles/director diff = skip-for-now.

## Notes
NodeContextMenu gains "Add note" + onAddNote(nodeId, label, nzbn?). New
components/NoteEditor.tsx at menu position (bg-paper border-rule, textarea
gothic 12.5px, flag toggle, ~500 char cap). Marker: CSS-triangle dog-ear
top-left INSIDE the 2px status border (border-top 9px var(--ink)); flagged
notes dye it var(--accent) (user's inkan mark — annotation, not register
status). Rendered from data.hasNote/noteFlagged stamped by an App decoration
useMemo → works in export viewer unmodified. Notes copied into save points at
takeSnapshot (matched by key). Sidebar list grouped by tab; click →
jumpToTab + highlight by key (reuse App.tsx:1139-1152 highlight mechanic).

## People in common
utils/peopleInCommon.ts — pure derivation, ZERO API calls. SharedPerson
{ key: personId(name), displayName (longest variant), appearances[{tabId,
tabLabel, kind, viaCompanies}] }, only ≥2 tabs. Sources: person nodes in each
company tab's allNodesInMemory (viaCompanies = edge-linked company labels) +
IndividualTab subject names. Memoized in CasePanel on [companyTabs,
individualTabs] (O(nodes), cheap; fingerprint memo only if profiling demands).
Interaction: row expands → tab chips → jumpToTab + highlight. Same-name
caveat footnote. Skip: auto-launching Compare from a row.

## Stages (tsc gate: stays at 23 pre-existing errors; no new deps)
- A (first, L): extraction + persistence — owns App.tsx, CasePanel.tsx (new),
  utils/caseStore.ts (new), types.ts. Boot hydration, persist effect,
  migration, "Save points" copy.
- B (M): notes — owns NodeContextMenu.tsx, NoteEditor.tsx (new),
  CustomNodes.tsx (dog-ear), CasePanel Notes section.
- C (M): diff — owns utils/statusDiff.ts (new), CasePanel Changes section,
  CustomNodes.tsx (変 badge), App.tsx handleCheckChanges. AFTER B (both touch
  CustomNodes).
- D (S): people in common — owns utils/peopleInCommon.ts (new), CasePanel
  section. Parallel with C only if C/D use separate section subcomponents.
- E (S): export integration — owns services/exportService.ts,
  export-viewer.entry.tsx (+ npm run build:export-viewer). Parallel after B.

## Skip-for-now
Multi-case switcher; persisting person tabs; roles diff; auto-diff on load;
compare-from-people-row; notes in static person report; trail persistence;
IndexedDB; deleting legacy mitsuketa_snapshots key.

Est. total: Stage A large (mostly code motion), B/C medium, D/E small.
