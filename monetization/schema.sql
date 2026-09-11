-- Mitsuketa monetisation schema (Neon Postgres)
--
-- Three record types, per MONETIZATION_HANDOFF.md §5:
--   purchase       finance/tax log        (IRD wants business records ~7 years)
--   credit_ledger  the credit balance     (append-only; balance = SUM(delta))
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
    credits                     integer     NOT NULL,   -- credits granted for it
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
