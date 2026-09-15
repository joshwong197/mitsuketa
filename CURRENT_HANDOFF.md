# Mitsuketa current handoff — 16 September 2026

## Current branch

- Branch: `feature/monetization`
- The branch includes the scoped entity reports, Clerk property access, council-link flow and expanded licensed valuation adapters.
- Preview: <https://mitsuketa-git-feature-monetization-joshwong197s-projects.vercel.app/#/app>
- Preview deploys from this branch; verify the deployment after the latest branch push.
- The September 16 UI feedback batch is documented in `design/UI_FEEDBACK_PLAN_2026-09-16.md`.

## Ready for owner testing

- Public company/entity search while signed out.
- Simple and Comprehensive company search.
- Expanded entity record, company history/document links and constitution shortcut.
- Details + Org Chart HTML export.
- Property access through development Clerk.
- `breakerofboundaries@gmail.com` is the branch Property administrator.
- A signed-out browser correctly receives **Sign in** and **Request access** at Property.
- Privacy/terms must both be scrolled to the end before acceptance unlocks; larger in-page popups are available.
- Neon audit uses one row per submitted search operation, with the user, search, timestamp and matter reference. Candidate/title activity updates that row.

## September 16 UI feedback batch

- Separate Case and Workspace rail views; tab counts; clickable workspace case index.
- Per-case trail/opening time, notes, changes, director filter and search scope. Late results stay with their originating search.
- Comprehensive → Simple → Comprehensive uses the cached graph. Simple-only searches ask before fetching the wider graph; failures preserve Simple.
- Named snapshots, saved/download feedback, bounded collection imports and restore into a separate case. New snapshots do not bleed across separate searches for the same subject.
- Partial names and ampersand/and lookup fallback; numeric identifiers are preserved.
- Documents distinguish confirmed empty from unavailable/unsupported. Societies, trusts, partnerships and charities have verified official browse links; automated document scraping is not implemented for those registers.
- Business details no longer leave the old left-column gap. Company, person and property cards use consistent typography/status cues; property tabs and headings lead with the resolved address.
- Property summaries include supplied owner/title/type/status/district/area/issue-date information and current mortgage/caveat/lease events; covenants remain in detail.
- Brand returns home without unmounting open cases. Removed Open for early access from the top homepage strip.
- All four Nganui spelling/locality variants have address regressions; the user's original query remains in the audit operation.
- Validation passed: TypeScript, production build, full checks, UI feedback checks and all 18 browser tests. Company/person/property cards were visually reviewed. Browser tests use synthetic API responses without LINZ queries or Neon writes.
- Vite excludes generated test reports and scratch files from watching to prevent exported HTML from clearing local sessions.
- This batch stays on `feature/monetization`; it does not activate Production Clerk or publish to main.

## Production remains unchanged

- No merge or push to `main`.
- Live Mitsuketa still uses password environment-variable authentication, so existing users retain access.
- Production Clerk exists and its Vercel variables are scoped to Production only. The branch keeps separate development Clerk variables because Clerk production keys cannot run on a `*.vercel.app` preview.
- Production Clerk is not active in the live deployment.

## Clerk work paused for owner confirmation

After branch testing, obtain a fresh confirmation immediately before these browser actions:

1. Change production Clerk access mode from Open to Invite-only.
2. Rotate the production Clerk secret created during setup and replace the Production-only Vercel secret.
3. Delete the accidental Preview-wide `PROPERTY_CLERK_ADMINS` duplicate. The correct `feature/monetization` variable already maps to the breaker account.
4. Use Clerk's Cloudflare Domain Connect flow to add the five Clerk authentication/email DNS records for `mitsuketa.co.nz`.

Do not send the production invitation until the live Clerk route can receive the signup link. Do not redeploy Production or switch the auth-mode variables without the owner's later main-release approval.

## Main-release scope

Include Simple/Comprehensive search, expanded company records, updated HTML export, Clerk-approved Property access, privacy/terms, and the Neon one-row audit fix.

Exclude the new homepage, annotation overlay and monetisation wording/features. Prepare a selective release from fresh `origin/main`; do not merge this whole branch.

## Council rating valuation investigation

Research is complete in `design/COUNCIL_VALUATION_SPIKE.md`.

A second source-and-licence audit is in `design/COUNCIL_VALUATION_LAWFUL_ROUTES.md`. It finds credible next routes for Taranaki and Whangārei, a free permission-request route for Dunedin, and confirms Hamilton is already covered through Waikato's CC BY source. Auckland, Tauranga and Southland remain link-first unless their commercial reuse position is clarified.

- There is no free public national CV/RV feed available to a private app; LINZ restricts National DVR access.
- A national official-council link layer is practical using the `territorial_authority` that Mitsuketa already receives from LINZ.
- Waimakariri, Horizons, Waikato, Canterbury Maps and Gisborne expose official CC BY 4.0 ArcGIS valuation data and now have automated adapters.
- Other official council APIs can be allowlisted after their reuse rights and matching behaviour are confirmed.
- Do not scrape undocumented council HTML applications. Fall back to the official council search.
- Preserve the structured LINZ address in title reports; `addressOf()` currently discards the address ID and territorial authority.
- Automated values need a high-confidence council rating-unit match because LINZ titles and rating units are not reliably one-to-one.

## Council rating valuation branch implementation

Implemented on `feature/monetization` after the research spike:

- Title reports preserve the selected LINZ address ID, territorial authority and point coordinates.
- Every recognised territorial authority receives an official council website/property-search link.
- Waimakariri, Horizons, Waikato, Canterbury and Gisborne properties query official CC BY 4.0 ArcGIS sources for available CV, LV, improvements, valuation references, source dates and links.
- Cross-boundary Waitomo and Taupo searches try both Waikato and Horizons; Waimakariri retains its council source and falls back to Canterbury Maps.
- Where a source does not publish IV, the report labels the derived figure as `Improvements (CV − LV)`.
- The four non-overlapping regional/unitary datasets currently expose 718,213 rating-unit rows, about 29.9% of Cotality's 2.4 million-property national universe. This is a directional comparison because the record models differ.
- Multiple/weak matches and council API failures fall back to the official council link.
- The report and standalone HTML export show the same valuation block, source, retrieval date, licence and rating-purpose wording.
- Live end-to-end checks passed for `30 Canterbury Street, Ashley` and `10 The Square, Palmerston North`.
- `npm run build`, the adapter check and the password property-flow/export browser test pass.
