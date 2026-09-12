# Property access and sandbox billing

Implemented on `feature/monetization`; do not merge the entire monetisation branch into production as an audit-only change. Clerk development sign-in is configured for local and monetisation preview use. Other deployments retain their explicitly configured authentication mode. Stripe billing remains off until sandbox keys and its webhook are connected.

## One Mitsuketa account

Clerk verifies a session and its primary email. The server checks the expected issuer and explicitly allowed origins. The `(issuer, subject)` pair maps to a Neon account UUID. Existing email-only accounts are never silently claimed: an email collision requires explicit administrator-assisted linking. Email changes retain the original account and balance; the current verified email is used for the on-screen identity, while the original account email remains the review/contact snapshot for now.

New accounts start `pending`. They submit organisation (optional), intended property-related use and acceptance of the current notice. The administrator reviews applications in the property account panel and can approve, reject or suspend. `PROPERTY_CLERK_ADMINS` lists provider user IDs for this issuer; payment never sets admin permission. Administrators can review applications without being approved to search themselves. They must submit an application and approve it to use property searches too.

The API checks approval for address, owner, title and tile requests on every request. Billing checks do not replace this gate. Suspended users cannot use their remaining passes or start another checkout. Search audits keep the linked account UUID and a `clerk:<issuer>#<subject>` actor; historical password entries retain their original attribution.

## Configure the development instance

1. Create a Clerk development application in the owner's account. Enable email verification and the chosen email sign-in method. Public sign-up can remain open: a new account can only apply for property access, not search or pay. Company searches remain open.
2. Apply `monetization/migrations/002_property_accounts_sandbox.sql` to the intended Neon database. It adds identity columns, approval/history tables and separate sandbox customer/purchase/pass tables. It does not migrate or grant access to password users, and does not change live balances.
3. Set secrets only in ignored `.env.local` and branch-specific Vercel Preview settings:

   - `PROPERTY_AUTH_MODE=clerk` and `VITE_PROPERTY_AUTH_MODE=clerk`
   - `CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`: the same development publishable key
   - `CLERK_SECRET_KEY`: development secret, never VITE-prefixed
   - `CLERK_ISSUER`: exact issuer URL for that Clerk application
   - `CLERK_AUTHORIZED_PARTIES`: exact comma-separated trusted app origins, no trailing slashes. Include localhost origins used for testing and the stable monetisation preview origin. Do not use a wildcard.
   - `PROPERTY_CLERK_ADMINS`: the owner's Clerk `user_...` ID after first sign-up

4. Restart local Vite and redeploy the branch after changing configuration. A Clerk-selected server does not fall back to password authentication. Do not switch modes until both frontend and backend keys are present.

## Connect the existing Stripe sandbox

Use the same Stripe sandbox for the secret key and webhook endpoint:

- `PROPERTY_BILLING_MODE=sandbox` (default is `off`)
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `PROPERTY_APP_ORIGIN`: the exact app origin for checkout returns; local and preview environments each need their own value

Register `/api/stripe-webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `charge.refunded`. For local testing, forward signed events with Stripe CLI; use that listener's signing secret locally. No automatic email/invitation messages are sent by the app.

Checkout creates/reuses one sandbox Stripe customer per Neon account. Prices are server-controlled NZD test offers: one pass $5, ten $30, one hundred $200. Checkout receives account/offer identifiers only, never property searches or matter references. Full card details stay with Stripe.

Only signed test webhooks can grant passes. The server retrieves canonical Checkout state and checks paid status, offer, amount, currency and account binding. A database function records the purchase and grant atomically; replaying the same checkout cannot double-credit. Refunds reverse passes proportionally, rounded up, using cumulative refunded amounts so out-of-order/replayed events do not double-reverse. A refund can make the balance negative if passes have already been used; further reports are blocked until the balance is positive.

One pass is consumed only after a title report is retrieved successfully and before it is returned. A missing title or upstream failure consumes none. The database serialises the last-pass debit and rechecks approval. If another request used the last pass first, the losing request receives no report. Address/owner result lists and already-downloaded exports are not metered. Opening the same title again through a new request uses another pass; each report request has its own audit reference. No durable returned-report cache is created.

`sk_live_` keys and checkout on `VERCEL_ENV=production` are refused. Sandbox passes are in separate tables from existing `credit_ledger`/annual entitlements. Annual subscriptions, real-payment tax/refund terms, chargeback handling and production migration are **not enabled** by this slice.

## Verification

Clerk development application `Mitsuketa` has now been created under the owner's Clerk account and its keys configured locally and for the monetisation preview. Email-code sign-in and signup email verification are enabled. Use the hosted app to create the owner's Mitsuketa user before assigning its immutable `user_...` ID to `PROPERTY_CLERK_ADMINS`. The Clerk dashboard account is separate from the application's user accounts. Stripe remains off.

Signup asks for a password: minimum 8 characters with uppercase, lowercase and a special character; numbers are not required. Email codes remain available for passwordless sign-in. These are Clerk development-instance settings shared by localhost and this preview. `ClerkRoot` supplies hash-route navigation so completing either authentication method can activate the session without waiting for a document unload.

`node scripts/check-clerk-live.mjs [app-origin]` is an opt-in hosted sign-in test. It uses Clerk's official development testing helper, creates a synthetic test user, verifies the real Clerk-to-Neon account path and pending approval gate, submits a test application, then removes that exact test user and account. It does not test human CAPTCHA completion or send real email.

`node scripts/check-clerk-ui.mjs [app-origin]` exercises the actual signup and sign-in modals with a synthetic email: eight-character password signup, email verification, password and email-code sign-in, and session persistence after reloading. The synthetic Clerk and Neon accounts are removed afterward. Unlike the direct sign-in helper, this covers the UI navigation/session handoff; human CAPTCHA and real email delivery remain outside this automated test.

- `npm run check`: includes identity/approval/admin/origin boundaries, no-debit-on-failure, missing-pass handling, webhook signature/tamper tests and test/live separation.
- `npm run check:browser`: full existing password property flow, privacy notice and a synthetic application → review → sandbox-checkout panel journey. The account-panel test does not prove real Clerk sign-in or real Stripe checkout.
- `python -m monetization.check_sandbox_db`: optional live Postgres tests in an isolated randomly named schema, removed afterwards. Verifies duplicate purchases, concurrent last-pass consumption, refunds and suspension without customer data.
- `npm run build`. Repository-wide TypeScript errors inherited from main are tracked separately; changes must introduce none.

Before switching preview auth, test two real Clerk development users, approval and suspension, a Stripe sandbox purchase/webhook replay/refund, and sign-out/account switching. Until keys are configured, these hosted end-to-end tests remain outstanding. Check privacy operator/contact placeholders and agree an actual retention schedule before wider release; automatic audit expiry is not configured.

Sources: [Clerk React](https://clerk.com/docs/react/getting-started/quickstart), [request authentication](https://clerk.com/docs/reference/backend/authenticate-request), [Stripe webhooks](https://docs.stripe.com/webhooks), [Stripe testing](https://docs.stripe.com/billing/testing), [NZ privacy collection transparency](https://www.privacy.org.nz/privacy-principles/3/), [retention](https://www.privacy.org.nz/privacy-principles/9/).
