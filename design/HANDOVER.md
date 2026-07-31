# Handover — search & report redesign

Branch: `claude/mitsuketa-search-report-redesign-4tg7du`

> **Update (this session):** §3a–§3e are fixed, and the §4 decisions below are
> resolved — see the note at the end of each item.
>
> **Correction to an earlier claim in this same update:** directors were first
> drawn for the root entity and its upstream parent chain only, on the
> assumption that subsidiaries would need an extra fetch. That assumption was
> wrong — `fetchEntitySummaryLight` (used for every subsidiary) hits the exact
> same `/entities/{nzbn}` endpoint as the full fetch, it just wasn't reading
> `roles` out of the response. Fixed: `drawDirectorsFromRoles()` is now shared
> by `crawlUpstream` and `crawlDownstream`, so every company on the chart shows
> its directors, still at zero extra API calls.
>
> A real chart also surfaced a second bug while testing this: a person who is
> both director AND shareholder of the same company got two edges to it, which
> render as coincident, illegible overlapping lines (both node types have one
> handle per side). Fixed to merge into a single `roleKind: 'both'` edge
> labelled "Director & Shareholder".
>
> The "N directorships held during a bankruptcy period" sentence and the
> directorship timeline were built, then **removed after testing against live
> data** — the register carries no discharge date for these records, so both the
> chart and the count were artefacts of a missing-date fallback. See §7. The
> panel now shows only register-stated dates.
>
> Also fixed from live testing: `removalCommenced` stays set after removal
> completes, so an already-removed company rendered "REMOVED" and "REMOVAL IN
> PROGRESS" at once. Gated at the data layer (`companyStatusApi.ts`) so the graph
> badge, the `statusRamp` amber bucket and exports all get the intended meaning.
> And the graph view now shows a loading bar for person searches — "Search as
> Individual" fired a 30s search with zero feedback and read as a dead button.

Written to carry this work into a fresh session. Everything needed is in the repo: the design
documents in this directory are self-contained HTML, openable in a browser. **Published artifact
URLs are not reproduced here — they are private to the account that published them and will not
resolve for anyone else.** Open the local files instead.

---

## 1. Shipped and pushed

| Commit | What |
|---|---|
| `3f0ecb0` | 地 as a first-class tab type; report enriched; HTML export |
| `7fd3c58` | Title report typeset as a register extract |
| `52802ad` | 地図 parcel map — LINZ aerial imagery with the title outline |
| `d60b54f` | Map failure diagnostics + upstream timeout |
| `b528d06` | Fixed the map blanking itself after it had already drawn |
| `f6bc72f` | Always include inactive and removed entities (toggle removed) |

Earlier on the branch: the sumi re-skin of the property search, the `社 · 人 · 比 · 地` mode line,
and the `input, button { font: inherit }` reset in `index.css`.

### Verified by the user
Nothing on the property side has been confirmed against a real title yet. Specifically untested:

- whether the parcel outline registers correctly on **real** aerial imagery (projection maths is
  guarded by `npm run check:tiles`, but stubbed tiles cannot prove registration)
- whether the chosen zoom suits a large rural parcel vs a small suburban one
- the 現況 cut and chronology density on a messy commercial title with ~40 memorials

---

## 2. Proposed, not built

Four design documents, all **proposal only — no behaviour change committed**:

| File | Covers |
|---|---|
| `property-report-direction.html` | The register-extract redesign (this one *was* subsequently built) |
| `insolvency-flags-direction.html` | First pass at flagging individuals. **Superseded** — its colour tiers are wrong, see §4 |
| `insolvency-flags-on-chart.html` | The flags in situ on a 13-node chart, with corrected tiers |
| `directors-and-flags.html` | Directors on the chart, role marks, the blocked masthead, bankruptcy-span timeline |

`directors-and-flags.html` is the current state of thinking and supersedes the other two on
anything they disagree about.

---

## 3. Bugs found while designing, NOT yet fixed

These are real defects in shipped code, discovered while drawing mocks. None have been touched.

### 3a. People can never deduplicate on the graph — FIXED

`apiService.ts` now mints person node ids via `personId()` (moved to `utils/personId.ts`
so `apiService` can import it without a cycle through `compareService`). One catch found
while fixing it: the old code's `if (this.nodes.has(holderId)) continue` skipped the
*edge* too whenever the node already existed — with a stable id that meant a person's
second, third, etc. shareholding would silently vanish. Now only the node-add is
idempotent; every edge is still attempted. Same-person, same-company dual roles (director
AND shareholder of one company) were first drawn as two distinct edges, but that produced
coincident, illegible overlapping lines on a real layout (both node types have exactly one
handle per side) — confirmed against a live chart. Fixed to merge into one `roleKind: 'both'`
edge labelled "▼ Director & Shareholder" instead (`mergeRoleEdgeLabels` in `apiService.ts`,
mirrored in `compareService.ts`). See `utils/personRoles.ts` for the separate node-level
rollup (union of roles across the whole chart) this feeds.

Original report, kept for context:

`services/apiService.ts` (lines ~259 and ~350) mints person node ids as:

```js
holderId = `IND-${holderLabel.replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 5)}`;
```

The random suffix means the guard on the next line — `if (this.nodes.has(holderId)) continue` —
can never fire for a person. **A person holding shares in two subsidiaries already renders as two
separate nodes today.**

`services/compareService.ts` already exports a stable `personId()` (normalises and sorts name
tokens). Case notes are keyed `nzbn ?? personId(label)`, so `App.tsx:1436` highlights *every*
duplicate of a person when a note is attached to one — the note system assumes an identity the
graph never assigns. Fix is to use the existing `personId()`.

### 3b. Directors are never drawn — FIXED

`drawDirectorsFromRoles()` runs for every company on the chart — root, upstream parents (via
`crawlUpstream`), AND downstream subsidiaries (via `crawlDownstream`, added after discovering
`fetchEntitySummaryLight` already returns `roles` from the same request) — filtering to active
`Director` entries. **Drawn only, not crawled further** — a director's own other
directorships/shareholdings are not followed automatically (that was the explicit call: default
to drawn-only; a user who wants the fuller picture uses the existing "Search as Individual"
context-menu action, which already runs a full person search on demand — no new expand-and-merge
feature was needed). Director edges render dashed (`App.tsx` `styleEdgesByDepth` and
`apiService.addEdge`) — control, not ownership.

Original report: the upstream crawl built only from `shareholdings.shareAllocation.shareholder`;
the `details.roles` branch existed only as an `else if` for General Partners of a Limited
Partnership (no shareholdings at all). Directors were fetched (`fetchEntityDetailsFull` already
returns `roles`) and discarded.

### 3c. `isDisqualified` is rendered but never set — FIXED

New `src/api/personStatusApi.ts` (`enrichPersonNodes`) checks every unique person node against
the Disqualified Directors and Insolvency registers, called alongside `enrichGraphNodes` in
`App.tsx`. Because 3a now gives one node per person, this already checks each individual
exactly once no matter how many companies they appear on across the chart — no separate dedup
step was needed. Sets `isDisqualified`, `hasInsolvencyRecord`, `insolvencyCurrent`.

### 3d. Insolvency fields fetched and discarded — FIXED

`src/api/insolvencyApi.ts` now declares all six fields from
`docs/insolvency-trustee-services.json`:

| Field | Why it matters | Declared? |
|---|---|---|
| `adjudicationOrLiquidationDate` | start of bankruptcy | yes |
| `dischargeOrCompletionDate` | end of it | yes |
| `dischargeOrCompletionType` | reason for discharge | **no** |
| `dischargeConditionExpiryDate` | what "(conditional) discharged" points at | **no** |
| `dischargeSuspended` | **a suspended discharge means still bankrupt**, whatever `insolvencyStatus` reads | **no** |
| `annulmentDate` | annulled rather than discharged | **no** |

`dischargeSuspended` is wired into `isInsolvencyRecordCurrent()` (`insolvencyApi.ts`) — a
suspended discharge counts as current regardless of what `insolvencyStatus` reads, and that
function now gates both the person-node crit "current" label and the summary strip auto-expand
(3e).

### 3e. The individual masthead blocks the page — FIXED

`components/PersonSearchResults.tsx` replaced the `max-h-[240px] overflow-y-auto` card stack
with one collapsed-by-default strip per register (disqualified / insolvency), matching
`directors-and-flags.html`. A strip opens automatically when it holds a *current* record
(indefinite disqualification, or `isInsolvencyRecordCurrent()`) — deterministic height, no
nested scroll, and the one fact that matters isn't hidden behind a click.

---

## 4. Decisions still open

1. **Insolvency checks: automatic or behind a button? — RESOLVED: automatic.** Concern raised was
   whether a complex chart re-checks the same person repeatedly; it doesn't — 3a's dedup means
   one node per unique individual, so `enrichPersonNodes` checks each person exactly once
   regardless of how many companies they appear on.
2. **Does an unverified "name match" flag go into the exported chart?** Still open — not addressed
   this pass.
3. **Discharged records — RESOLVED: still crit**, never demoted to amber. `statusRamp.ts`'s
   `hasInsolvencyRecord` check doesn't distinguish current/historic for colour; `insolvencyCurrent`
   is a separate fact surfaced in the label/strip, not a colour softening.
4. **Directors on by default? — RESOLVED: yes, always drawn**, for every company on the chart
   (root, upstream parents, AND downstream subsidiaries — see the correction note at the top; the
   subsidiary half was added after it turned out to cost nothing). No toggle (a toolbar show/hide
   for Shareholders/Directors/Ceased from the mock was not built this pass).
5. **Do directors get crawled, or only drawn? — RESOLVED: drawn only.** No automatic upstream
   crawl from a director node. The existing "Search as Individual" context-menu action already
   covers "I want this director's full picture" — a full person search on demand — so no new
   expand/merge-into-graph feature was built.
6. **Does the summary strip auto-expand on a *current* insolvency? — RESOLVED: yes**,
   `dischargeSuspended` counts as current.
7. **Does the overlap count get stated? — RESOLVED: NO. Built, tested against live data, and
   deliberately removed.** A merged-coverage timeline plus a "N directorships held during a
   bankruptcy period" sentence was built, then pulled after seeing it on a real subject. Both
   of Ritesh Mani's records are "(Conditional) Discharged" with **no `dischargeOrCompletionDate`
   on file**, so the code's missing-date fallback ran every bankruptcy to today — producing a bar
   labelled "2002 — 2026" and the headline "43 directorships held during a bankruptcy period".
   Both numbers were artefacts of the fallback, not facts. The handover warned this would be the
   most consequential sentence the app generates; an accusation resting on a guessed end date is
   worse than no chart at all, so the panel now states only what the register actually gives:
   adjudication date, and the discharge date **or an explicit "not recorded on the register"**
   (never silently blank, which reads as "still bankrupt"). Per-company appointment/resignation
   dates are shown on the company cards instead. Do not reinstate the derived count without a
   real discharge date per record.

### Corrections already absorbed
- **Colour tiers.** `utils/statusRamp.ts` puts *current* liquidation/receivership in **amber 琥**
  and reserves **crit 紅** for *historic* insolvency and disqualification. An early proposal had a
  director redder than the liquidated company causing his flag. A person's mark must never outrank
  the event that caused it.
- **役 is taken.** The property report uses 役 for easements (地役権), so the director glyph is
  締 (取締役), not the otherwise-obvious 役 from 役員.

---

## 5. The role mark — RESOLVED and built

Asked, and the answer was **(b), with a variant**: 印 is replaced by the role kanji inside the
seal — 株 (shareholder), 締 (director). For someone who is both, rather than showing 株締 as text
beside a merely-split ring, the *glyph itself* is sliced down the middle — left half of 株, right
half of 締, with a thin dividing line so the split reads as deliberate rather than a rendering
glitch. Rationale given: most readers can't parse the kanji anyway, so the shape carrying the
signal matters more than either character staying legible. The ring still echoes the same split
(solid arc / dashed arc). Implemented in `components/CustomNodes.tsx` (`SealGlyph`, `SealRing`
in the `PersonNode`) via `clip-path: inset()` on two overlaid glyphs — flows through to exports
and `graph.html` for free, since both reuse `PersonNode`. A plain-English role label
(Shareholder / Director / Shareholder · Director) still sits under the name for readers who
can't parse kanji at all. Role is rolled up per-node from every edge touching that person
(`utils/personRoles.ts`) — the union across the whole chart, so directing company A and holding
shares in company B still gets one "both" node, not two single-role ones.

---

## 6. Parked

- **Property valuations.** No national CV/RV API exists; Auckland Council has a *pricing policy*
  for the dataset, so scraping the public lookup circumvents a commercial licence. Legitimate routes
  are a licensed feed or a LGOIMA request. Trade Me Property API (they own homes.co.nz) is the
  interesting free angle for listings rather than CV. Decided not to build the provider seam yet.
- **Per-person credentials** for the 地 feature — replacing the shared `PROPERTY_PASS` with a
  `PROPERTY_USERS` list so the audit log records a verified identity rather than a self-declared
  name. ~60 lines plus a hash helper. Recommended before anything else on the audit side.
- **Audit log durability.** `utils/audit.ts` writes to stdout → Vercel platform logs, which are not
  retained long enough to answer a complaint months later. The privacy notice currently promises
  more than the implementation delivers. Options: Neon free tier (queryable, supports a retention
  purge), or emailing each event to the operator via Resend (durable, off-platform, un-browsable by
  construction — which suits the stated "defensibility not surveillance" purpose). No admin
  browsing UI, deliberately.
