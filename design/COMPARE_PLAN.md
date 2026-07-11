# Compare feature — implementation plan (approved architecture, 2026-07-11)

Feature: FindScreen "Compare" mode — Person/Entity A ↔ B, answer "is there a link?"
by finding shortest connection path(s), rendered in the existing graph viewer with
the path at full ink and context at low opacity.

## Search strategy: bidirectional BFS (NOT build-two-graphs-and-intersect)

API cost asymmetry drives the design:
- `fetchEntityDetails(nzbn)` (apiService.ts, exported) — ONE cheap call (~0.3–1s) = all
  upstream neighbors of a company: corporate parents, individual shareholders, directors.
- `searchByPersonName(name, key)` (directorSearchService.ts) — ONE call (~1–3s) = all
  company neighbors of a person (directorships + shareholdings, strict name filter).
- `fetchRolesByEntityName(name)` (apiService.ts, exported) — downstream subsidiaries, ~11s.
  Use ONLY for the two endpoint companies at depth 0 (covers "shared subsidiary"),
  never for interior frontier nodes. Worst case: exactly 2 slow calls.

Algorithm (`services/compareService.ts`, new, ~300 lines):
1. Frontiers A/B, parent maps for path reconstruction, visited maps per side.
2. Expand the SMALLER frontier one level (Promise.all, throttled like OrgSpider.smartDelay).
3. Intersect visited sets after each level; on meet, reconstruct ALL shortest paths
   through all meeting nodes at that level.
4. Budgets: maxHops 4 default (retry to 6), ~50 API calls, ~15 companies/frontier level
   (note "truncated"), ~90s wall clock, shouldCancel() between expansions.
5. onProgress({ hop, entitiesExamined, apiCalls, currentName }).

Deterministic IDs: NZBN for companies; persons get `P-` + normalized uppercase name
(OrgSpider's random IND-* ids make intersection impossible — do not reuse them).
UI carries a one-line caveat: same-name individuals can't be distinguished.

Result: path node(s)/edge(s) + already-discovered 1-hop neighbors (capped ~40) as
context — no extra API calls. All nodes `isVisible: true`; skip markDirectLineage /
calculateHiddenDescendants entirely.

```ts
type CompareEndpoint =
  | { kind: 'company'; nzbn: string; name: string }
  | { kind: 'person'; name: string };
findConnection(a, b, config, { maxHops, onProgress, onLog, shouldCancel }):
  Promise<{ found; hops; nodes; edges; pathNodeIds; pathEdgeIds;
            stats: { apiCalls; entitiesExamined; truncated } }>
```

## State: reuse CompanyTab, no new tab kind

- `types.ts`: `CompanyTab.compare?: { aLabel; bLabel; hops; pathNodeIds; pathEdgeIds }`;
  `NodeData.onComparePath?`, `isCompareEndpoint?` (endpoints also get `isTarget: true`
  so existing stamp treatment applies — zero CustomNodes.tsx edits).
- Compare result opens as a Company tab labeled "A ↔ B" (`nzbn` = endpoint A's or '').
  Zero TabBar.tsx changes. Full save/restore machinery works unchanged.

## Emphasis: post-pass, compose with existing systems

`utils/compareEmphasis.ts` (new, ~50 lines), applied AFTER assignDepths →
getLayoutedElements → styleEdgesByDepth:
- path nodes/edges untouched (full ink);
- context nodes: `style.opacity: 0.15` + pointerEvents none (same mechanism as
  App.tsx handleHideParents);
- context edges: MULTIPLY the opacity styleEdgesByDepth set by ~0.15 (compose,
  don't replace — styleEdgesByDepth stays the single edge-styling authority).
- handleShowAll un-dims for free.
- No new colors: emphasis = presence of ink, de-emphasis = absence. Radius 0, no shadows.

## UI (FindScreen)

- Third mode on the mode line: Companies · People · Compare (serif kanji 比, accent
  underline when active, matching existing toggle pattern).
- Two stacked slot inputs (A over B, small ↔ glyph), same big-search border treatment.
  Each slot: tiny Company/Person toggle. Company slots get searchEntities suggestions
  (selecting locks {nzbn,name}); person slots free-text + name-match caveat line.
- In-progress: existing find-loadbar sweep + one status line (12.5px ink-mid, mono
  tabular): "Tracing connection · hop 2 of 4 · 17 entities examined". Bordered Stop button.
- No link: stays on FindScreen, bordered row "No connection found within 4 hops ·
  31 entities examined" + secondary button "Search deeper · 6 hops". No tab opened.
- Found: opens "A ↔ B" tab; trail logs "Connection found · A ↔ B · 3 hops".

## Implementation order

1. types.ts additions (pure, safe first)
2. services/compareService.ts — neighbor adapters (mirror crawlUpstream parsing +
   handleShowDirectors director filter + strict-match normalization at apiService.ts:514),
   BFS loop, budgets, path reconstruction, result assembly
3. utils/compareEmphasis.ts
4. App.tsx handleCompare — service call w/ progress/cancel; on found: assignDepths →
   layout → styleEdgesByDepth → applyCompareEmphasis → create tab (reuse
   handleSelectEntityInTab pattern incl. forTabId late-arrival guard)
5. components/FindScreen.tsx compare mode (LAST — recent-searches changes already landed)
6. Verify: tsc error count ≤ pre-existing baseline; manual test all three pairings +
   no-link + cancel, both themes.

## Skip-for-now (explicitly deferred)
Cross-run BFS caching; non-shortest alternative paths; expand-context interactions on
compare tabs; path/context canvas legend; person disambiguation UI; compare-aware
export-viewer verification (opacity travels in node.style — follow-up check only).

~600–750 new lines: 2 new files + types.ts/App.tsx/FindScreen.tsx edits. No backend changes.
