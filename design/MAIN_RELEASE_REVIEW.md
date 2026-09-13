# Main release review — 14 September 2026

Review and branch hardening. No push, merge, deployment, invitation, historical audit deletion or production configuration change performed. Migration 004 was applied to the currently configured Neon endpoint; its development or production designation has not been verified.

## Scope

Include Simple/Comprehensive company searches, entity records and history/document links, updated HTML export, Clerk approved property access, privacy notice and acceptance flow. Company searches remain public.

Exclude the new homepage and monetisation content. GitHub main verified by ls-remote at df342495f42efc17ea82a331179c3e95cdf2bd76. Local main is stale; compare with origin/main. Branch feature/monetization is at 86df4bf with substantial uncommitted and untracked work. A whole-branch merge is not suitable.

## Release findings

1. Entry routing includes the excluded homepage. origin/main/index.tsx renders App directly; current index.tsx routes the root URL to Landing. Preserve direct app entry while adding Clerk and explicit access/privacy/terms routes. Terms and Privacy also import marketing.tsx; separate their necessary legal presentation from excluded marketing navigation/content.
2. Monetisation wording remains visible with billing off: legalContent.ts mentions payment testing, Stripe, report passes, fees and sandbox checkout. ClerkPropertyAccess.tsx says 'Refresh access and balance' and 'Payment cannot change this decision'. Remove these from the release wording; update the shared notice version when final wording changes.
3. Auth has a billing dependency: api/property-account.ts calls passBalance for every status request even when billing is off. Simply excluding monetisation schema/code can break access. Separate approval/account migrations and status from optional billing before selecting release files.
4. Production Clerk readiness is not confirmed. Local configuration uses development keys, Clerk auth on both frontend/backend, billing off and localhost as app origin. Verify production instance, keys, authorized origins, invitation/success redirects, invite-only signup, admin subject IDs and destination database migrations. Existing development users/grants are not evidence of production access. Recipient list is pending from the user.
5. Constitution shortcut selects the first matching constitution filing from the retrieved document list. It is a filing shortcut, not proof of a consolidated current constitution; check amendment/revocation-only filings before describing every match as the constitution itself.

## Neon investigation and fix

Read-only aggregate checks on the configured local database found 24 audit rows: 11 address, 11 title and 2 owner. Within the preceding two days, two repeated same-actor/matter/query/mode groups occurred: address twice over 30 seconds; title twice over one second. Neither matched the diagnostic's test-reference naming heuristic. The rows alone cannot prove which UI gesture produced them.

Confirmed implementation causes:

- PropertyScreen.tsx submit calls searchAddress or searchOwner; pickCandidate calls searchAddress again; openTitle calls fetchTitleReport. Each carries the matter reference but no common search-operation ID.
- api/property.ts independently logs each address, owner and title request. utils/propertyAudit.ts always INSERTs; no idempotency key or unique logical-search constraint exists.
- ResultRow/candidate clicks are not disabled while busy, and run() lacks an immediate in-flight guard. Rapid repeated clicks can issue repeated title requests. React StrictMode does not itself double-invoke these event handlers.
- Existing property-flow.spec.ts explicitly expects separate AUD-101 and AUD-102 for search and report opening, so previous passing tests did not enforce the newly requested one-row behavior.

Implemented on the branch: each Search submission receives a UUID, candidate selection and title opens reuse it, and Neon enforces actor-scoped uniqueness. The row keeps the original mode, query, time, matter reference and user identity; opened title references are appended without copying title contents. The UI blocks repeated result clicks while a request is running. Historical audit rows were retained.

Migration 004 was applied to the currently configured Neon endpoint. A self-cleaning live check issued two concurrent starts and two repeated title updates for the same operation. Neon returned one audit reference and held exactly one row with one title reference; the synthetic row was deleted. The endpoint's development or production designation has not been verified.

## UI review

The live Fletcher Steel Record card and section hierarchy fit the current narrow in-app viewport and follow the indigo/serif treatment. The constitution action is visible beside the register link.

The Network scope/view controls now occupy a dedicated rail above the canvas. Shared-child parents such as a corporate shareholder and multiple directors retain Dagre's peer spacing instead of being recentered onto the same point. The live Fletcher Steel view was measured and visually checked with no control or node overlap.

The custom Annotate UI overlay remains enabled in development and crowds the lower-right corner. Exclude its mount/component from the proposed release selection. It is already omitted from production builds.

HTML export's Network/Record separation and collapsed details passed the current offline tests. Returning to Network remounts ReactFlow with fitView; viewport preservation is not implemented, although controlled node state survives.

## Validation

Current service checks passed: property audit, property invitations, property access (including bundled Stripe isolation checks), company scope, entity profile and register evidence. They use synthetic dependencies. The Neon idempotency check used one self-cleaning synthetic operation in addition to the earlier aggregate reads.

All 15 browser cases passed across company scope, entity/export, property account, invitation/privacy and property-flow coverage (1.2 minutes). The company-scope test now asserts that the graph rail clears the nodes and node rectangles do not overlap. These verify the working branch, not a future selectively prepared release.

The production build and full service check suite pass after the audit and layout fixes. Production Clerk configuration and the selective release checkout have not yet been certified.

`npx tsc --noEmit` is not currently a clean release gate. It reports existing ReactFlow generic mismatches in App, unknown values in KydVerificationPanel, and copied Clerk source under `tmp/`. The configured production build and repository checks do not run this command. Either exclude the scratch sources and fix the application typings, or explicitly keep TypeScript checking outside this release gate.
