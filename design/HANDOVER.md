# Handover — search & report redesign

Branch: `claude/mitsuketa-search-report-redesign-4tg7du`

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

### 3a. People can never deduplicate on the graph
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

### 3b. Directors are never drawn
The upstream crawl builds only from `shareholdings.shareAllocation.shareholder`. There is a
`details.roles` branch at `apiService.ts:334`, but it is an `else if` that fires only when a company
has **no shareholdings at all** — it exists for General Partners of a Limited Partnership.

The NZBN entity response carries directors in that same `roles` collection ("the persons and
business entities that are directors, trustees, partners, officers"), and `fetchEntityDetailsFull`
already returns it. **Drawing directors costs no additional API calls.**

### 3c. `isDisqualified` is rendered but never set
`NodeData.isDisqualified` exists, `CustomNodes` renders a crit inkan for it, and both
`statusRamp.ts` and `statusDiff.ts` handle it. Nothing anywhere assigns it — `enrichGraphNodes`
filters to `n.data.type === 'company'`. The rendering half of the person-flag feature is already
built against a permanently-false field.

### 3d. Insolvency fields fetched and discarded
`src/api/insolvencyApi.ts` declares four fewer fields than the official schema in
`docs/insolvency-trustee-services.json` provides:

| Field | Why it matters | Declared? |
|---|---|---|
| `adjudicationOrLiquidationDate` | start of bankruptcy | yes |
| `dischargeOrCompletionDate` | end of it | yes |
| `dischargeOrCompletionType` | reason for discharge | **no** |
| `dischargeConditionExpiryDate` | what "(conditional) discharged" points at | **no** |
| `dischargeSuspended` | **a suspended discharge means still bankrupt**, whatever `insolvencyStatus` reads | **no** |
| `annulmentDate` | annulled rather than discharged | **no** |

`dischargeSuspended` is the one worth wiring on its own merits — it is exactly the case where an
amber "historic" flag would be actively wrong.

### 3e. The individual masthead blocks the page
`components/PersonSearchResults.tsx:311` bounds the register-check block at
`max-h-[240px] overflow-y-auto`. Two insolvency records render as two full cards (~350px), so the
user gets a nested scrollbar *and* a masthead consuming the viewport — the company grid starts
below the fold. Confirmed on a real search (ritesh mani, 45 companies, 2 records).

An earlier attempt at scroll-driven auto-collapse did not hold up. Proposal is a
**collapsed-by-default disclosure** instead: deterministic height, no nested scroll. See
`directors-and-flags.html`.

---

## 4. Decisions still open

1. **Insolvency checks: automatic or behind a button?** Two API calls per unique individual —
   roughly 80 extra on a 40-director chart. The graph-derived tiers are free and should always run.
   *This is the one gating a build.*
2. **Does an unverified "name match" flag go into the exported chart?** The evidence card does not
   travel with an exported PNG.
3. **Discharged records:** crit red when corroborated, or does currency demote to amber?
4. **Directors on by default?** Drawn with a toolbar toggle in the mock; on by default.
5. **Do directors get crawled, or only drawn?** Drawing is free. Following a director's other
   shareholdings upstream makes charts far more revealing and considerably bigger.
6. **Does the summary strip auto-expand on a *current* insolvency?** (`dischargeSuspended` should
   count as current.)
7. **Does the overlap count get stated?** "N directorships held during a bankruptcy period",
   computed from dates already held. Phrased mechanically, never as a conclusion that anything was
   breached — but it would be the most consequential sentence the app generates.

### Corrections already absorbed
- **Colour tiers.** `utils/statusRamp.ts` puts *current* liquidation/receivership in **amber 琥**
  and reserves **crit 紅** for *historic* insolvency and disqualification. An early proposal had a
  director redder than the liquidated company causing his flag. A person's mark must never outrank
  the event that caused it.
- **役 is taken.** The property report uses 役 for easements (地役権), so the director glyph is
  締 (取締役), not the otherwise-obvious 役 from 役員.

---

## 5. UNRESOLVED — the role mark

The last message on this thread pointed at the split-ring seal (印 in a ring that is half solid,
half dashed) and said *"this is the kanji that I think we should replace for directors and
shareholders"*. That is ambiguous and was never clarified. Two readings:

- **(a)** Replace the 株 / 締 text glyphs on the role line — the split ring alone carries the
  role distinction, and the role line goes back to plain words.
- **(b)** Replace **印** *inside* the seal with the role kanji — 株 for a shareholder, 締 for a
  director, and the split ring only for someone who is both.

Reading (b) is the more interesting design and probably what was meant, but it trades away the
inkan as a consistent person mark, which is a real cost — 印 currently identifies "this node is a
person" across the graph, the export viewer and `PersonSearchResults`.

**Ask before building either.**

Current state as drawn in `directors-and-flags.html`: 印 stays in the ring; the ring is solid for
shareholders, dashed for directors, half-and-half for both; 株 / 締 / 株締 sit on the role line.

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
