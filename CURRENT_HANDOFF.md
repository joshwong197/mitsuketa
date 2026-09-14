# Mitsuketa current handoff — 14 September 2026

## Current branch

- Branch: `feature/monetization`
- Pushed commit: `e414091` (`Add scoped entity reports and Clerk property access`)
- Preview: <https://mitsuketa-git-feature-monetization-joshwong197s-projects.vercel.app/#/app>
- Latest Vercel redeploy is ready and uses the updated branch environment variables.
- Working tree was clean before this handoff file was created.

## Ready for owner testing

- Public company/entity search while signed out.
- Simple and Comprehensive company search.
- Expanded entity record, company history/document links and constitution shortcut.
- Record + Network HTML export.
- Property access through development Clerk.
- `breakerofboundaries@gmail.com` is the branch Property administrator.
- A signed-out browser correctly receives **Sign in** and **Request access** at Property.
- Privacy/terms must both be scrolled to the end before acceptance unlocks; larger in-page popups are available.
- Neon audit uses one row per submitted search operation, with the user, search, timestamp and matter reference. Candidate/title activity updates that row.

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

- There is no free public national CV/RV feed available to a private app; LINZ restricts National DVR access.
- A national official-council link layer is practical using the `territorial_authority` that Mitsuketa already receives from LINZ.
- Waimakariri and Horizons expose official CC BY 4.0 ArcGIS valuation data and are the safest automated pilots.
- Other official council APIs can be allowlisted after their reuse rights and matching behaviour are confirmed.
- Do not scrape undocumented council HTML applications. Fall back to the official council search.
- Preserve the structured LINZ address in title reports; `addressOf()` currently discards the address ID and territorial authority.
- Automated values need a high-confidence council rating-unit match because LINZ titles and rating units are not reliably one-to-one.

## Council rating valuation branch implementation

Implemented on `feature/monetization` after the research spike:

- Title reports preserve the selected LINZ address ID, territorial authority and point coordinates.
- Every recognised territorial authority receives an official council website/property-search link.
- Waimakariri and Horizons-region properties query the official CC BY 4.0 ArcGIS sources for CV, LV, improvements, valuation reference/date and source metadata.
- Multiple/weak matches and council API failures fall back to the official council link.
- The report and standalone HTML export show the same valuation block, source, retrieval date, licence and rating-purpose wording.
- Live end-to-end checks passed for `30 Canterbury Street, Ashley` and `10 The Square, Palmerston North`.
- `npm run build`, the adapter check and the password property-flow/export browser test pass.
