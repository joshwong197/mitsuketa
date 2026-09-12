# Deferred Stripe plan — Mitsuketa

Stripe setup is intentionally on hold pending LINZ approval. Do not run OAuth,
create Products/Prices, add secrets, or activate payment routes yet. This file
records the agreed local contract so later payment setup cannot drift from it.

## Agreed catalogue (NZD)

| Key | Public offer | Price | Stripe shape later |
|---|---|---:|---|
| `payg` | Single property report | $5 | one-time payment; grants 1 pass |
| `passes_10` | 10 report passes | $30 | one-time payment; grants 10 passes |
| `passes_100` | 100 report passes | $200 | one-time payment; grants 100 passes |
| `professional_annual` | Professional | $500/year | annual subscription entitlement |

Professional means unlimited **manual** property reports for one named user.
It excludes automation, bulk/API access, credential sharing, and resale.

The customer-facing term is **report pass**. `credit_ledger`, `credits`, and the
`purchase.credits` column remain internal implementation names to avoid an
unnecessary data migration.

## Local implementation already in place

- `credits.REPORT_PASS_PACKS` is the source of truth for one-time prices.
- `credits.PROFESSIONAL_ANNUAL` is the annual-plan contract.
- `entitlements.authorize_report()` grants active Professional users access
  without decrementing passes; otherwise it atomically consumes one pass.
- `account_entitlement` stores time-bounded annual access for the named account.
- `source_ref` is unique and cannot be moved between accounts, making future
  subscription activation/renewal safe to retry.
- Existing one-time Checkout fulfilment remains idempotent: a purchase changes
  from pending to paid and appends its pass grant in one SQL statement.

## When Stripe work resumes

1. Create three one-time Prices matching `REPORT_PASS_PACKS` and one annual
   recurring Price matching `PROFESSIONAL_ANNUAL` in a Stripe sandbox.
2. Set the one-time Price IDs as `STRIPE_PRICE_ID_PAYG`,
   `STRIPE_PRICE_ID_PASSES_10`, and `STRIPE_PRICE_ID_PASSES_100`.
3. Add subscription Checkout separately from the existing one-time
   `create_checkout_session()` path. Do not represent Professional as credits.
4. On verified subscription lifecycle events, use Stripe's exact current-period
   timestamps and the subscription/term identifier to call
   `entitlements.activate_professional(..., source="stripe")`.
5. Treat cancel-at-period-end as active until `ends_at`; revoke immediately only
   for a genuinely ended/refunded entitlement according to the final policy.
6. Keep one-time webhook fulfilment idempotent and re-retrieve Checkout Sessions
   before granting passes. Keep bad signatures as HTTP 400, processing failures
   as 5xx (so Stripe retries), and verified duplicate/ignored events as HTTP 200.
7. Test duplicate webhook delivery, out-of-order subscription events, expired
   entitlements, named-user isolation, and pass fallback before enabling live
   payments.

No Stripe account or API action was performed while implementing this model.
