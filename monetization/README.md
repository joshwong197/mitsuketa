# Monetisation spine

The paid layer for the property site: accounts, report passes, named-user annual
entitlements, the LINZ search audit, and deferred Stripe billing. Everything is **env-gated** — with no `DATABASE_URL`
and no `STRIPE_SECRET_KEY` the site runs exactly as it does now (fixtures, no
billing). Turn it on one env var at a time.

```
schema.sql   Neon tables (account, ledger, entitlement, purchase, search audit)
db.py        connection + PgStore (the production ledger) + apply_schema()
credits.py   report-pass prices + internal ledger: balance / grant / consume
entitlements.py  annual access + the unified report-authorisation decision
audit.py     search-input log (LINZ obligation) + retention/erasure
billing.py   Stripe Checkout session + webhook -> grant credits
test_monetization.py   ledger self-check, no DB needed
test_billing.py        mocked Checkout/webhook tests, no Stripe or DB needed
test_entitlements.py   pass/annual/manual-use tests, no Stripe or DB needed
```

## The model

Three records, per the handoff. **Owner/mortgagee/caveator names are never
stored** — only the search input is.

- **`purchase`** — one row per Stripe checkout. Finance/tax record (IRD ~7yr), no
  personal data.
- **`credit_ledger`** — append-only. A purchase writes `+N`, a report writes `-1`.
  Balance is `SUM(delta)` (the `account_balance` view). Never updated in place.
- **`account_entitlement`** — a time-bounded Professional term attached to one
  account (the account's unique email is the named user). It is idempotent by
  `source_ref` and does not create or store LINZ result data.
- **`search_audit`** — mode + query + title number, per search. Retention and
  per-subject deletion live in `audit.py`.

Customers see **report passes**; `credit_ledger` retains the internal name for a
small, safe migration. `authorize_report()` first checks active Professional
access, otherwise consumes one pass. It refuses non-manual access. `PgStore`
serialises consumption per account with a Postgres advisory lock and performs
the balance check and debit in one database transaction.

## Agreed launch pricing (NZD)

| Offer | Price | Entitlement |
|---|---:|---|
| PAYG | $5 | 1 report pass |
| 10 report passes | $30 | 10 reports ($3 each) |
| 100 report passes | $200 | 100 reports ($2 each) |
| Professional annual | $500/year | Unlimited manual reports for one named user |

The public UI should never call these "credits". Professional does not include
automation, bulk/API access, credential sharing, or resale. Search/result-list
preview policy is separate; the metered action is generating the property
report.

## Turning it on

1. **Neon** — create a project, copy the connection string:
   ```bash
   export DATABASE_URL="postgres://...neon.tech/...?sslmode=require"
   pip install "psycopg[binary]>=3.1"
   python -c "from monetization import db; db.apply_schema()"  # creates the tables
   ```
2. **Stripe — deferred.** Do not create products, run OAuth, or set payment
   secrets until the owner resumes payment setup. At that point, test mode uses:
   ```bash
   export STRIPE_SECRET_KEY=sk_test_...
   export STRIPE_WEBHOOK_SECRET=whsec_...        # from `stripe listen`
   export SITE_URL=http://localhost:8000
   export STRIPE_PRICE_ID_PAYG=price_...
   export STRIPE_PRICE_ID_PASSES_10=price_...
   export STRIPE_PRICE_ID_PASSES_100=price_...
   export STRIPE_TAX_ENABLED=0                   # switch to 1 only when required
   pip install "stripe>=9"
   ```
   Point a webhook at `POST /billing/webhook` for
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   and `charge.refunded`. Set the account-wide statement descriptor to
   `MITSUKETA` in Stripe Dashboard. The three one-time Price IDs are read from
   the environment; inline prices remain a local/test fallback.

Run the local checks from the project root:
```bash
python -m monetization.test_monetization
python -m unittest discover -s monetization -p 'test_*.py' -v
```

## Wiring into the site (`site/app.py`)

The search-input audit and read-only `/audit` viewer are wired. Billing and
per-search metering are not. The remaining touch points are:

Live verification and current logging behaviour are recorded in
`LIVE_AUDIT_CHECK.md`. Searches expose `AUD-<id>` and accept an optional matter
reference. The viewer includes the authenticated Basic credential; individual
account attribution awaits the Clerk integration proposed in `AUTH_PLAN.md`.
Existing databases need the additive actor/matter_ref migration at the end of
`schema.sql` before running the updated application.

- **Meter the paid action.** Before returning a title report in `title_page()`:
  ```python
  from monetization import db, entitlements
  if db.available():
      access = entitlements.authorize_report(
          db.store, db.entitlement_store, acc, ref=title_no, manual=True
      )
      if not access.allowed:
          return paywall_page()      # no pass / annual access -> buy or subscribe
  ```
  (Decide which action costs a credit: the report view is the natural one; the
  results list stays free.)
- **Billing routes.** Add `GET /billing` (show `credits.REPORT_PASS_PACKS`,
  `credits.PROFESSIONAL_ANNUAL`, and balance),
  `POST /billing/checkout` (`billing.create_checkout_session` -> redirect), and
  `POST /billing/webhook` (`billing.handle_webhook`).

## Still stubbed (needs your input / review)

- **Accounts / sign-in.** `account` is the identity table, but authentication is
  still the site's single-user Basic auth. Real per-user sign-in is the next
  piece; `acc` above is a placeholder for the signed-in account id.
- **Professional Stripe lifecycle.** The local entitlement and database model
  are ready, but subscription Checkout and subscription webhooks are deferred
  with all Stripe account/product work. Future webhook activation should call
  `entitlements.activate_professional()` using the subscription/term id as its
  idempotent `source_ref` and use Stripe's exact period timestamps.
- **Stripe Price IDs and secrets.** Deliberately not created or configured yet.
- **GST.** Off below $60k turnover; `billing.py` charges GST-exclusive. Revisit
  at the threshold.
