# UI feedback execution plan — 16 September 2026

Source: `C:/Users/break/Downloads/mitsuketa-ui-feedback (1).md`.
Status: implemented and verified on the feature branch. TypeScript, production build, full checks and all 18 browser tests pass; company/person/property cards visually reviewed.
Branch: `feature/monetization`; main remains unchanged.

## Findings at the start of review

- `App.tsx` keeps one global trail; CompanyTab and IndividualTab do not own their trails or opening timestamps. Switching tabs restores graph/person data but not a corresponding trail.
- `CasePanel.tsx` displays workspace-wide people-in-common, notes and snapshots alongside the active case. People in common is intentionally derived from all open tabs; its placement makes it look like an active-company relationship.
- `hideDirectors` is global, and the control disappears when no director-only nodes are counted. A person who is both a director and shareholder is deliberately retained. Entry-path consistency still needs a regression check.
- Depth is the maximum graph distance from the target, starting at zero, including person nodes. It is not a count of visual chart rows.
- Flags counts nodes with a subset of boolean fields; it is not a count of all status categories and is inconsistent with the chart's visual status treatments.
- Entity search quotes the whole name as a phrase. Partial names and ampersand variants can therefore miss records. Actual NZBN response behaviour needs verification during implementation.
- Documents/history enrichment currently accepts a company number and uses Companies Register pages only. Other entity types have register links but no equivalent document adapter.
- Property tabs explicitly use the title number as their label, and PropertyReport explicitly uses it as the main heading.

## Address search finding

Read-only live LINZ address-layer checks returned:

| Query | Literal LINZ match |
| --- | --- |
| `36 Nganui Ave` | `36 Nganui Avenue, Takanini, Auckland` |
| `36 Nganui Avenue, Takanini` | Same address |
| `36 Nganui Ave, Takanini` | None |

The abbreviation is a prefix of Avenue until the comma interrupts the literal match. The current branch's existing street/locality fallback successfully resolves the failing form to the same address. Title/owner queries were deliberately skipped in this check. The inspected `origin/main` version does not contain that fallback; verify against fresh main when preparing the release.

Plan: cover all four user examples in regression checks, keep the fallback in the selective main release, and normalise common street suffixes for matching/ranking only. Preserve the original query in Neon. Preserve whole street-number, unit and locality checks; ambiguous results must still prompt selection.

## Feedback mapping

| Item | Element / code | Proposed change |
| --- | --- | --- |
| 1 | CasePanel View; App role filter; person-to-company entry | Apply the same role classification from every company entry path. Keep a consistent director control; explain when there are no director-only people to hide. Preserve director/shareholders as owners. Save filter state per case. |
| 2 | PeopleSection; utils/peopleInCommon.ts | Move all-tab people in common to an explicitly labelled Workspace view. An active-case cross-link section may show only people appearing in that case. Keep the same-name caveat. |
| 3 | TabBar category buttons | Add small numeric open-tab badges to Companies, Individual and Property, with accessible labels. Use numbers rather than an unexplained star. |
| 4 | App global trail; CasePanel Trail | Give each case its own timestamp and trail. Route asynchronous events to the originating case ID even after a tab switch. |
| 5 | CasePanel snapshot footer; App takeSnapshot | Rename to Save snapshot. Open a compact naming dialog with the current entity prefilled; show clear saved feedback. Separate saving in the workspace from Download snapshot; mention JSON only in supporting text. |
| 6 | CasePanel HTML export footer | Rename to Download HTML report; show preparing/completed feedback. Update related help and command labels. |
| 7 | GraphScopeControl; App company scope; graph projection | Allow Comprehensive to switch to Simple locally, retaining the complete graph. Returning to Comprehensive restores that graph without a request. A graph initially fetched as Simple requires one confirmed comprehensive fetch. Use the same immediate-relationship rules as an actual Simple search. |
| 8 | services/apiService.ts searchEntities; entity suggestion/result flow | Normalise ampersand/and and whitespace for lookup, preserve numeric identifier searches, and use a bounded broader name fallback when a phrase has no results. Deduplicate by NZBN and rank exact names first. Verify the named incorporated society and company searches. |
| 9 | App icon rail; CasePanel notes/snapshots/changes | Separate Workspace from the active Case. Workspace lists open cases, saved snapshots, all-case notes and shared people. Case shows only its own trail, notes, changes, view settings and snapshots. Retain existing snapshots through a compatible migration. |
| 10 | api/entity-record.ts; registerEvidence; entityProfile; EntityRecord Documents | Audit official document routes for societies, charitable trusts, charities and limited partnerships, then add supported per-register links/adapters. Show unavailable/not supplied distinctly from a confirmed empty document list. Do not promise downloadable files where the source does not expose them. |
| 11 | EntityRecord grid and responsive styles | Remove the fixed Business-column span that leaves a dead area. Use a full-width Business record with paired People/Ownership cards below and Documents spanning the width. This removes the long blank area beside Business. Preserve a sensible single-column reading order. |
| 12 | EntityRecord hero/status; chart status styles | Share the chart's status classification and colour tokens: normal indigo, current administration/removal amber, removed muted, and insolvency/disqualification red. The existing chart classifier takes precedence when a historical insolvency finding exists. Include explicit status text; keep current and historical findings distinct. |
| 13 | App entity switch; EntityDetailsPanel; HTML viewer labels | Rename views Org Chart and Details throughout the app and HTML export, including accessible names and back actions. |
| 14 | PersonSearchResults subject/verification header | Reuse the entity card's typography, spine and identifier hierarchy for the person subject. Retain the existing company-result layout and address-verification detail. Present same-name uncertainty separately from confirmed register findings. |
| 15 | CasePanel Depth metric; utils/graphDepth.ts | Remove Depth from the prominent summary. Search scope already communicates breadth. If retained in secondary diagnostics, label Relationship steps and explain zero-based distance from the target; never imply visual rows. |
| 16 | App caseFlags/personFlagsCount; CasePanel summary | Replace an unexplained flag number with labelled status indicators and an expandable list of affected entities/people. Derive them from the same classifier used by cards/charts. If a count remains, label it Entities with alerts and count each affected entity once. |
| 17 | App handleOpenPropertyReport; PropertyTab; TabBar | Use the resolved street address as the property tab label; retain title number in its tooltip/secondary accessible label. Fall back to title number when no address is available. Refresh both report and label when an existing tab is reopened. |
| 18 | PropertyReport masthead; HTML title report | Make the address the primary heading, with title number and tenure/status beneath. Use title number as the main heading only for reports without an address. |
| 19 | PropertyReport masthead; titleReport view model; memorials | Build a matching property summary card with address, title number, registered owners, tenure/type, status, land district, area and issue date when supplied. Summarise current mortgages, caveats and relevant leases/interests from existing analysed events. Keep covenants/easements in their detailed section rather than the headline alerts. Mirror the summary in HTML export. |
| 20 | PropertyReport colophon; HTML colophon | Centre the disclaimer block within the report with consistent width and margins. Keep paragraph text left aligned inside the block for readability; remove the accidental one-sided placement. |
| 21 | App brand/logo header | Make the brand a keyboard-accessible home link. Preserve open cases when navigating home. |

Additional homepage request: remove the top Open for early access segment from `components/marketing.tsx`, including its now-unneeded separator. This is a branch homepage edit and does not change the agreed exclusion of the new homepage from the main release.

## Proposed execution order

1. Correctness: per-case state and async routing, directors consistency, address/name matching, status classification.
2. Workspace navigation: Workspace/Case separation, category badges, snapshot naming/feedback, export/view labels and two-way scope switching.
3. Cards/layout: entity status card, flowing entity details, person subject card, property tabs/card/masthead/colophon, home link and homepage wording.
4. Other-register documents: verify official capabilities and implement supported routes with honest fallbacks.
5. Validation: targeted regressions, full checks/build, visual review of entity/person/property and HTML exports, then push reviewable branch commits. No main merge or production Clerk cutover.

## Validation cases

- Search Ritesh Mani, open NKSW from the results, open Fletcher Steel separately, then switch repeatedly. Each case must keep its own trail, notes, view state and snapshots; shared people must be clearly workspace-wide.
- Switch tabs while company/person enrichment is running; late results and trail events must land in their originating case.
- Director-only and director/shareholder people must behave consistently across direct search, person entry and saved snapshot restore.
- Comprehensive → Simple → Comprehensive must make no additional calls after the full graph is loaded; a Simple-only case must fetch the wider network once.
- Verify partial incorporated-society names, ampersand/and, full names and numeric identifiers, including THE NEW ZEALAND CREDIT AND FINANCE INSTITUTE INCORPORATED (NZBN 9429042783640).
- Cover all four Nganui spellings, postal/unit addresses, wrong street numbers/localities and ambiguous addresses. Search-log query text remains the user's input.
- Compare entity statuses and alerts across org chart, Details, sidebar, snapshots and offline HTML.
- Check long names, no-address titles, multiple estates/owners, current/discharged mortgages/caveats, unavailable fields, small/large screens and light/dark themes.

Existing working-tree change at review start: `public/export-viewer.css`. Preserve it during implementation until its origin is checked.

## Implementation notes

- Case state now includes opening time, bounded trail, director filter and selected scope. Late graph/person results are routed to their originating case.
- Notes and new snapshots are scoped by case ID. Legacy snapshots without a case ID are matched by subject; restored snapshots are explicitly associated with the new case.
- Snapshot restore opens a new case, preserves annotations/view settings, and never overwrites the current search. Import accepts a snapshot or a bounded snapshot collection; downloading a collection respects Case versus Workspace.
- Workspace has a separate rail entry and clickable open-case index. Workspace shared people retain the same-name caveat; the active Case no longer displays unrelated searches.
- The simple projection preserves React Flow measurements and the full cached graph. A failed comprehensive request retains the Simple view. Dagre layouts clear previous cases before computing positions.
- Other-register documents remain official browse links: Societies, Charitable Trusts, Limited Partnerships and Charities. Automated retrieval is explicitly unsupported for those sources; it is not represented as an empty filing list.
- Cards/export use the existing status ramp, explicit status/history text, address-led property headings and current mortgage/caveat/lease summaries. Business is a full-width details section to remove the former left-column gap.
- Four Nganui variants are covered by address regressions; original query text is preserved for audit attribution.
- The homepage top strip no longer says Open for early access. The new homepage remains excluded from the main release.
- TypeScript excludes ignored scratch/vendor files under tmp and checks the app. Existing verification-result annotations were corrected; no verification behavior changed.

Validation completed: TypeScript, production build, check:ui-feedback, check and all 18 browser tests. Coverage includes company/non-company scope, offline export, person-to-company navigation, workspace/snapshot restore, late company loads, property audit and privacy/invitation flows. Browser tests use synthetic API responses; they do not query LINZ or write Neon. Company, person and property screenshots were visually reviewed. Vite ignores generated test reports and scratch files so saving exported HTML does not reload the local app.
