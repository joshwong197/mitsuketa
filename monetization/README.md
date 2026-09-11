# Monetisation spine

The paid layer for the property site: accounts, a credit ledger, the LINZ search
audit, and Stripe billing. Everything is **env-gated** — with no `DATABASE_URL`
and no `STRIPE_SECRET_KEY` the site runs exactly as it does now (fixtures, no
billing). Turn it on one env var at a time.

```
schema.sql   Neon Postgres tables (account, credit_ledger, purchase, search_audit)
db.py        connection + PgStore (the production ledger) + apply_schema()
credits.py   the ledger rule: balance / grant / consume, plus MemStore + bundles
audit.py     search-input log (LINZ obligation) + retention/erasure
billing.py   Stripe Checkout session + webhook -> grant credits
test_monetization.py   money-path self-check, no DB needed  (python test_monetization.py)
```

## The model

Three records, per the handoff. **Owner/mortgagee/caveator names are never
stored** — only the search input is.

- **`purchase`** — one row per Stripe checkout. Finance/tax record (IRD ~7yr), no
  personal data.
- **`credit_ledger`** — append-only. A purchase writes `+N`, a search writes `-1`.
  Balance is `SUM(delta)` (the `account_balance` view). Never updated in place.
- **`search_audit`** — mode + query + title number, per search. Retention and
  per-subject deletion live in `audit.py`.

`consume()` draws a credit only if the balance covers it and never goes negative;
`PgStore` serialises it per account with a Postgres advisory lock so two
concurrent searches can't both spend the last credit.

## Turning it on

1. **Neon** — create a project, copy the connection string:
   ```bash
   export DATABASE_URL="postgres://...neon.tech/...?sslmode=require"
   pip install "psycopg[binary]>=3.1"
   python -c "import db; db.apply_schema()"      # creates the tables
   ```
2. **Stripe** (test mode first) — after the account exists:
   ```bash
   export STRIPE_SECRET_KEY=sk_test_...
   export STRIPE_WEBHOOK_SECRET=whsec_...        # from `stripe listen`
   export SITE_URL=http://localhost:8000
   pip install "stripe>=9"
   ```
   Point a webhook at `POST /billing/webhook` for `checkout.session.completed`.
   Bundles + prices live in `credits.BUNDLES` (prices are placeholders — set them).

## Wiring into the site (`site/app.py`)

Not wired yet, so review the spine first. When you are ready, the three touch
points are:

- **Audit every search.** In `search()` and `title_page()`, after the query is
  known:
  ```python
  from monetization import audit
  audit.record_search(mode, query, title_no=title_no, account_id=acc, ip=client_ip)
  ```
  This is safe to add now, before billing — the LINZ trail should exist
  regardless.
- **Meter the paid action.** Before returning a title report in `title_page()`:
  ```python
  from monetization import credits, db
  if db.available() and not credits.consume(db.store, acc, ref=title_no):
      return paywall_page()          # out of credits -> buy more
  ```
  (Decide which action costs a credit: the report view is the natural one; the
  results list stays free.)
- **Billing routes.** Add `GET /billing` (show `credits.BUNDLES` + balance),
  `POST /billing/checkout` (`billing.create_checkout_session` -> redirect), and
  `POST /billing/webhook` (`billing.handle_webhook`).

## Still stubbed (needs your input / review)

- **Accounts / sign-in.** `account` is the identity table, but authentication is
  still the site's single-user Basic auth. Real per-user sign-in is the next
  piece; `acc` above is a placeholder for the signed-in account id.
- **Prices** in `credits.BUNDLES` are placeholders.
- **GST.** Off below $60k turnover; `billing.py` charges GST-exclusive. Revisit
  at the threshold.
