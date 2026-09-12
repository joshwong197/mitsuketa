# Monetisation preview: Mitsuketa end to end

The monetisation branch incorporates the current `main` application, including
the Sumi interface, Compare and property reports. `npm run dev` serves that
application and its Vercel-compatible API handlers together on port 3000. The
separate Python prototype under the ignored local `site/` directory is not part
of this deployment.

## Configuration

Use the existing `ORG_*`, `LINZ_API_KEY`, optional `LINZ_BASEMAPS_KEY`, and
`PROPERTY_PW_*` credentials. Add `DATABASE_URL` for the shared Neon database.
`PROPERTY_AUDIT_ADMINS` is a comma-separated list of credential usernames allowed
to read the audit viewer; empty means nobody. It is checked server-side on each
request, and does not grant property sign-in by itself.

Keep local values in ignored `.env.local`/`.env` files. For branch previews,
configure Vercel Preview overrides for `feature/monetization`; production
environment settings and the production branch are separate.

The existing Neon database needs `search_audit.actor` and
`search_audit.matter_ref` (the two additive ALTER statements at the end of
`monetization/schema.sql`). The complete schema is for a fresh database; do not
recreate it merely to deploy the web app.

## Manual acceptance check

1. Open Mitsuketa and choose **Start searching**.
2. Choose **Property**, sign in using an existing provisioned credential, and
   accept the property-use notice.
3. Enter an optional matter reference and the approved test address:
   `810 Great South Road, Penrose, Auckland 1061`.
4. The results display `AUD-<id>`. Open a title; the report shows its own audit
   reference and the same matter reference.
5. Return to property search. For an administrator, **Search audit** opens the
   latest 200 inputs, with an optional username filter. Find the matter
   reference and confirm the credential and query.

Do this once locally and once on the branch preview. A local success does not
prove the deployed environment is configured.

## Logging contract

Search-address, search-owner and report-opened actions are inserted into
`search_audit` before the LINZ request. A failed insert blocks the request with
503. The durable reference is returned in JSON and `X-Search-Reference`.
Matter references are optional, at most 100 characters, and bound to the
submitted results so editing the next search cannot relabel an old result.

`actor=password:<username>` records the credential, not verified mailbox
ownership. `account_id` remains unset until provider-backed accounts are wired.
Only inputs are stored; names returned by LINZ are not copied into the log.
Audit rows are attempts, not success/failure records. Authentication/refusal
events still use platform logs. Exporting an already-open report in the browser
does not make another LINZ request or create another search row.

## Checks

`npm run check` exercises memorial analysis, LDS matching/geometry, NZBN linking
and the audit/auth boundary. `npm run check:browser` runs the full UI journey
using synthetic responses (install Chromium with `npx playwright install chromium`).
The browser test does not use real secrets, call LINZ or write Neon.

`npm run build` produces the same frontend that Vercel builds. The repo-wide
typecheck currently has pre-existing GraphEdge/KYD/shareholding errors also
reproduced on `main`; those are separate from this integration.

No payment routes are enabled, no report passes are charged, and the LINZ
commercial-approval and Clerk work remain deferred.
