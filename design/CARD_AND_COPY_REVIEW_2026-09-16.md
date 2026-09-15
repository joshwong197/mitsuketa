# Card and homepage copy review

Status: brief approved. Owner selected Individual proposal A, retaining the split director/shareholder seal. Individual page and person HTML export implemented; other surfaces remain pending.

## Sources and scope

Reviewed all eight browser comments, `Design Guide/SKILL.md`, `Design Guide/ANTI-SLOP.md`, the supplied brief and critic rubric, `.impeccable.md`, and the current Landing, marketing, person and property styles.

The folder supplied by the owner is named Design Guide in this workspace.

Work remains on feature/monetization. No main release, authentication cutover or new pricing workflow. The homepage stays excluded from the planned main release. Privacy and terms content is preserved; only its reader changes.

## Product and success criteria

Users investigate New Zealand company relationships and approved users inspect property titles. The first screen should identify the subject, its current status and the available evidence. Same-name register findings must remain distinct from confirmed identity.

Success means readable subject cards without forced name wrapping, current liquidation visible immediately, one document-reading path, and homepage claims that match the available data and access rules. Verify at desktop and mobile widths, in both themes, with keyboard and text zoom.

## Recommended direction

Use one wide subject card above the detailed view. Keep the indigo spine and kanji as the identifying motif. Current liquidation uses the existing Mitsuketa red spine with a clear current-status label. Historical findings appear separately and do not present a current liquidation claim. Keep other chart classifications unchanged pending a separate decision about the chart status palette.

Person: name and role coverage on the left of the horizontal card, supplied match count and search context on the right. Register checks, verification and the company list sit below; verification can retain a narrower column without constraining the subject card.

Property: merge the heading and title summary into a single wide card with a blue spine and property kanji. Street address leads, locality follows in smaller text. Title number uses the same readable sans-serif with tabular numerals. Include supplied owners and title facts in the card, with current interests in a separate row. Avoid repeating the address and title in a second summary card.

Typography: retain the existing Zen Kaku Gothic New face for English addresses, title identifiers and supporting content. Use Shippori Mincho for the kanji/spine and retained wordmark. Remove the serif address heading and monospace title subtitle that the owner rejected. Do not replace them with another fashionable display font without a type comparison.

Address formatting: standardise comma spacing and labels, deduplicate exact repeated emails and structured address parts. Keep original source values available. Do not guess how an unstructured address should be title-cased, or delete similar fragments without evidence they are duplicates.

Privacy and terms: one continuous scrollable reader with two clearly headed sections and one larger in-tab dialog. Acceptance requires reaching the end of the combined content. Preserve the document version, consent wording and reset behaviour. Completion is shared between the inline and larger readers.

Terminology: File, Open files, File notes and File trail in visible copy. Workspace retains its name. Internal case IDs and storage keys remain compatible.

## Alternatives to compare in HTML

1. Wide subject card above all content (recommended). Preserves the motifs the owner likes and fixes the narrow person layout.
2. Wide compact masthead with a slim kanji spine, followed by an unboxed facts band. More space for the company list, but less of the card appearance requested.
3. Wide two-part card with identity and facts in separate horizontal regions. Suits longer property facts; must stack cleanly on mobile without recreating the cramped person panel.

These are layout alternatives within the established brand, rather than unrelated redesigns.

## Homepage copy audit and proposed replacements

The current copy repeats whole-structure promises, uses scripted slogans, claims complete name matches and promises timing. Some access and retention wording is also inconsistent with the internal rollout and existing search audit. Those are accuracy problems as well as writing problems.

| Current text or section | Proposed wording |
| --- | --- |
| The finding | New Zealand register search |
| See who owns what. | Search company ownership. |
| Hero introduction | Search a company or person to view registered roles and shareholdings. Choose Simple for immediate relationships or Comprehensive to explore related entities. |
| The facts are public. They just don't sit together. | Company records and relationships in one view. |
| Premise paragraphs | Open a company's record alongside its ownership chart. View directors and shareholders, then follow the related companies in a Comprehensive search. Status labels distinguish current findings from historical records. |
| Four capabilities. | What you can search |
| Capabilities introduction | Company and individual searches use official register data. Property searches use licensed LINZ title data and require approved access. |
| Ownership graph description | View immediate directors and shareholders, or expand the search to related entities. |
| Individual search description | Find company roles and shareholdings recorded under a person's name. Review the identifying details before treating a name match as the same person. |
| Risk on the graph | Register status and alerts |
| Alert description | Read company status and supplied insolvency or disqualification findings alongside the relationships. Current and historical findings are labelled separately. |
| Property and title description | View supplied registered owners, title interests and parcel imagery. Council valuation information is included where a supported source returns a match. |
| One name, every company they touch. | Find company roles by name. |
| Person introduction | Review returned directorships and shareholdings, with register checks and address comparisons. Director consent documents can provide further identifying evidence where available. A name match alone does not confirm identity. |
| From a name to the whole structure. | How to use Mitsuketa |
| Search step | Enter a company name, NZBN or person's name. |
| Build step | Choose Simple or Comprehensive for a company search, then open its chart or Details. |
| Read the risk step | Review status labels and register findings. Check whether each finding is current or historical. |
| Keep it step | Add file notes, save a snapshot or download an HTML report with the chart and record details. |
| Two layers. One is open, one draws a credit. | Search access |
| Company access | Company and individual search is available without signing in. |
| Property access | Property search is currently restricted to approved users. Sign in with an approved account or request access. |
| Nothing about the result is kept. | Search logs record who searched, the search time and the matter reference. Read the privacy notice for details. |
| Final introduction, including seconds promise | Enter a company or person to begin your search. |

Keep Start searching as the action label because it states the next action and preserves the existing entry flow. Identify the homepage chart and person illustration as example data. Do not present illustrative names, identifiers or adverse findings as verified real records.

## Build and review sequence after approval

1. Produce local HTML comparisons with person, current-liquidation company, property and combined-reader states. Include mobile and dark-mode views and the proposed homepage copy.
2. Review typography and composition before changing production components.
3. Apply the selected layout to PersonSearchResults, EntityRecord, PropertyReport and the offline report output. Update visible File terminology and NoticeAcceptance readers.
4. Apply approved homepage wording in Landing and shared marketing copy; remove stale pricing promises from the internal access presentation without changing backend billing.
5. Run focused browser paths for reader completion, scope switches, exports and file state; run TypeScript and build. Review desktop/mobile screenshots independently against the supplied rubric.

Expected implementation files include components/Landing.tsx, components/marketing.tsx, components/PersonSearchResults.tsx, components/EntityRecord.tsx, components/entity-record.css, components/PropertyReport.tsx, components/PropertyStyles.tsx, the notice-reader components, components/CasePanel.tsx, App.tsx and services/exportService.ts.

## Approval point

The supplied Design Director guide says: "Do not create or edit frontend code, components, CSS, assets, or tokens before the brief and plan receive approval." The owner approved this brief and requested individual/director mockups first. Application implementation remains pending the layout review.

## Individual card prototypes

Created `design/individual-card-proposals.html`, available through the local Vite server at `http://127.0.0.1:3000/design/individual-card-proposals.html`. It compares A (wide card), B (compact header and separate counts), and C (findings beside identity), with theme, phone-width and register-state controls. All example names and findings are fictional; the prototype makes no API calls or data writes.

An independent Luna screenshot review preferred A. Its feedback led to an identity qualification directly below the name and labelled company rows on mobile. Desktop A/B/C previews and light/mobile and dark/current-finding states were rendered. All four register states and mobile page overflow were checked; pending checks do not show a completed-check timestamp. This validates the proposal, not production accessibility or data integration.

Suggested headline fields: returned name, role coverage, company/directorship/shareholding counts, a qualified current or historical register-finding summary, actual completed-check time and source. Identifying addresses and consent evidence remain below. Counts include historical roles in the example; production labels must match their actual calculation.

The prototype review made no application changes. The owner then selected A and authorised its implementation on the branch, with the split half-株/half-締 role seal retained.

## Individual implementation

PersonSubjectCard is now a full-width card above IdentifyingEvidence and the company matches. English headings use the existing Gothic family. Combined roles retain the split seal; single roles retain their respective glyph. The role counts are labelled as including historical data, with overlap explained.

The card distinguishes company matches from insolvency/disqualification name matches. Identifying addresses and consent evidence remain below. Current and historical register findings are qualified as name matches. A failure has an explicit unavailable state, rather than an empty-success claim. Completed check metadata stays with the originating Individual file and travels with new snapshots. Old snapshots without that metadata do not acquire a fabricated check timestamp.

The offline person HTML has the same card structure and seal, preserves its evidence and roster, and uses self-contained styles and scripts. Phone company rows have labels; print retains readable paper styling. The existing sidebar can be dismissed at phone widths.

Validation: TypeScript and check:person-report pass. All 19 browser cases have passed across the combined run and corrected person-spec rerun (2/2). App and export desktop/mobile screenshots were reviewed. An independent screenshot critique prompted clearer no-match wording and spacing above the exported card's theme control. The final production build passes. Ready for branch review.
