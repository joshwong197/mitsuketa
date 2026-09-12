# Individual sign-in — implementation decision

Prepared 2026-09-12. Recommended provider: **Clerk**, with email-code sign-in to
start. Keep Neon for accounts, report passes, annual access and search audits.
No provider account has been created and no login integration is active yet.

## Why this choice

The project has a React app and a separate Starlette property site. Clerk has
React UI components and an official Python backend SDK, so one identity system
can support both. Use Clerk-managed sign-in and session handling rather than
implementing passwords or emailing our own codes. Python must verify every
protected request; hiding a React button is not access control.

WorkOS AuthKit is the strongest alternative for the Python site, with hosted
sign-in and MFA. Its free user allowance is generous, but a custom domain is
currently $99/month. Clerk includes a custom domain in Hobby; MFA requires Pro
(currently $25/month, or $20/month billed annually). Budget for MFA before
production administrator access. Prices are provider-listed dollars, not NZD
quotes. Supabase is unnecessary for this stack and is not the owner's preference.

Sources checked 2026-09-12:
- [Clerk pricing](https://clerk.com/pricing)
- [WorkOS pricing](https://workos.com/pricing)
- [Clerk Python integration](https://clerk.com/articles/how-to-add-authentication-to-a-python-backend)
- [Clerk session validation](https://clerk.com/docs/guides/sessions/manual-jwt-verification)
- [Clerk synchronization guidance](https://clerk.com/docs/guides/development/webhooks/syncing)

## Concrete implementation contract

1. Start with a development instance and email codes. Keep trial access
   invitation-only while commercial launch remains deferred. Sign-in does not
   itself grant property access, Professional access or report passes.
2. Integrate the official SDK on the Starlette site, with managed sign-in UI
   and session refresh. Test direct report navigation, redirects and downloads,
   not just React API fetches. Validate signature, issuer, expiry and allowed
   origins; never accept a subject or account ID from request parameters.
3. Add an identity mapping keyed uniquely by `(provider, issuer, subject)` to
   the existing Neon account UUID. Issuer separates development and production
   identities. The UUID continues to own purchases, entitlements and audits.
   Provision transactionally on the first verified sign-in so delayed webhooks
   cannot break the first search. Only accept verified provider email data.
4. Do not merge existing accounts solely because an email matches. Keep
   linking explicit; an email change must not transfer passes or create a new
   owner for an existing balance. Provider IDs, not email, identify sessions.
5. Resolve `account_id` once server-side and supply it to audit and report
   authorization. Basic-auth test records retain their original attribution;
   do not retroactively claim an individual performed them.
6. Store administrator permission server-side, defaulting new users to no
   admin access. `/audit` is admin-only; paying for Professional does not make
   someone an administrator. Do not use client-editable metadata for roles.
7. Use an explicit auth mode. When Clerk is selected, missing/bad configuration
   fails closed; never fall back to public or shared Basic-auth access. Retain
   Basic auth only as the current development mode until migration is tested.
8. Keep billing deferred. Clerk provides authentication only; continue using
   the existing Stripe/Neon billing model when payment work resumes.

## Verification required before switching

Two distinct users must produce distinct Neon account IDs and correctly
attributed audit rows. Verify expired/forged tokens are rejected, ordinary
users cannot read `/audit`, failed identity provisioning never yields a report,
and email changes preserve balances. Test sign-out/session refresh on the
server-rendered site, cross-app redirects, simultaneous first sign-ins and
the absence of all Clerk credentials. No live paid access during these tests.

## Owner setup needed

Create a Clerk development application under the owner's account. Store its
development publishable key as `CLERK_PUBLISHABLE_KEY` and secret key as
`CLERK_SECRET_KEY` in the ignored project `.env.local`; never paste the secret
into chat. The React integration can use a separate
`VITE_CLERK_PUBLISHABLE_KEY` when wired. The secret must never have a VITE prefix.
These names are the proposed configuration contract, not currently active code.

The login provider does not receive property queries, matter references or
returned title data. Those inputs stay in the application/Neon audit path.
