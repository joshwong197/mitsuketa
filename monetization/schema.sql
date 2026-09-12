-- Mitsuketa monetisation schema (Neon Postgres)
--
-- Four record types:
--   purchase       finance/tax log        (IRD wants business records ~7 years)
--   credit_ledger  report-pass balance    (append-only; balance = SUM(delta))
--   entitlement    annual named-user access (no report-pass consumption)
--   search_audit   LINZ input log         (who searched what, when; NOT results)
--
-- What is deliberately NOT here: the owner/mortgagee/caveator names a title
-- search returns. Those are never stored (the one "reason not to store").
--
-- Apply with:  psql "$DATABASE_URL" -f schema.sql   (or db.apply_schema())

CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive email

-- ── accounts ────────────────────────────────────────────────────────────────
-- Identity + the Stripe customer link. Authentication itself lives elsewhere
-- (Basic auth today; real sign-in later) — this table just needs a stable id
-- to hang credits and purchases off.
CREATE TABLE IF NOT EXISTS account (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email               citext      UNIQUE NOT NULL,
    stripe_customer_id  text        UNIQUE,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── credit ledger ───────────────────────────────────────────────────────────
-- Append-only. A purchase writes a positive delta, a search writes -1, an
-- expiry or manual fix writes its own row. Never UPDATE or DELETE a row here;
-- balance is SUM(delta). This keeps a full, auditable money trail.
CREATE TABLE IF NOT EXISTS credit_ledger (
    id          bigserial   PRIMARY KEY,
    account_id  uuid        NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    delta       integer     NOT NULL,               -- + granted, - consumed
    reason      text        NOT NULL CHECK (reason IN
                              ('purchase','search','adjustment','expiry','grant')),
    ref         text,                               -- stripe id, search id, note
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_account_idx ON credit_ledger (account_id, created_at);

-- Current balance per account. A view so the balance is only ever derived,
-- never a mutable column that can drift from the ledger.
CREATE OR REPLACE VIEW account_balance AS
    SELECT a.id AS account_id,
           COALESCE(SUM(l.delta), 0)::integer AS balance
    FROM account a
    LEFT JOIN credit_ledger l ON l.account_id = a.id
    GROUP BY a.id;

-- ── account entitlements ───────────────────────────────────────────────────
-- Professional is unlimited only for manual report generation by this named
-- account. UI/API callers enforce the manual-use boundary; this table records
-- the time-bounded access term. source_ref makes activation/renewal idempotent.
CREATE TABLE IF NOT EXISTS account_entitlement (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id       uuid        NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    entitlement_key  text        NOT NULL CHECK (entitlement_key IN
                                  ('professional_annual')),
    status           text        NOT NULL DEFAULT 'active' CHECK (status IN
                                  ('active','cancelled','expired')),
    starts_at        timestamptz NOT NULL,
    ends_at          timestamptz NOT NULL,
    source           text        NOT NULL DEFAULT 'manual' CHECK (source IN
                                  ('manual','stripe')),
    source_ref       text        UNIQUE NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS account_entitlement_active_idx
    ON account_entitlement (account_id, entitlement_key, ends_at)
    WHERE status = 'active';

-- ── purchases (finance/tax log) ─────────────────────────────────────────────
-- One row per Stripe checkout. No owner names, so it can be kept the ~7 years
-- IRD expects without holding any LINZ personal data.
CREATE TABLE IF NOT EXISTS purchase (
    id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id                  uuid        NOT NULL REFERENCES account(id),
    stripe_checkout_session_id  text        UNIQUE,     -- idempotency key for the webhook
    stripe_payment_intent       text,
    amount_cents                integer     NOT NULL,   -- what was charged
    currency                    text        NOT NULL DEFAULT 'nzd',
    credits                     integer     NOT NULL,   -- internal report passes granted
    status                      text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','paid','refunded','failed')),
    created_at                  timestamptz NOT NULL DEFAULT now()
);

-- ── search audit (LINZ input log) ───────────────────────────────────────────
-- The LINZ licence wants a trail of what was searched. Input only: the mode and
-- the query the user typed, never the names that came back. Retention + deletion
-- run on this table (see monetization/audit.py:purge_older_than).
CREATE TABLE IF NOT EXISTS search_audit (
    id          bigserial   PRIMARY KEY,
    account_id  uuid        REFERENCES account(id) ON DELETE SET NULL,
    mode        text        NOT NULL CHECK (mode IN ('address','owner','title')),
    query       text        NOT NULL,
    title_no    text,                               -- when known (title mode / report view)
    ip          inet,                               -- coarse origin; optional
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_audit_created_idx ON search_audit (created_at);
CREATE INDEX IF NOT EXISTS search_audit_account_idx ON search_audit (account_id);

-- Additive migration for existing databases. actor describes the authenticated
-- credential (e.g. basic:operator), not a proven individual when shared.
ALTER TABLE search_audit ADD COLUMN IF NOT EXISTS actor text;
ALTER TABLE search_audit ADD COLUMN IF NOT EXISTS matter_ref varchar(120);

-- Historical references remain AUD-<id>; new inserts receive opaque UUIDs.
ALTER TABLE search_audit ADD COLUMN IF NOT EXISTS audit_reference uuid;
ALTER TABLE search_audit ALTER COLUMN audit_reference SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS search_audit_reference_idx ON search_audit (audit_reference);
