-- Optional Clerk + approval + sandbox billing. No changes to existing users,
-- live credit balances or entitlements. Apply before enabling Clerk mode.
BEGIN;
ALTER TABLE account ADD COLUMN IF NOT EXISTS auth_issuer text;
ALTER TABLE account ADD COLUMN IF NOT EXISTS auth_subject text;
CREATE UNIQUE INDEX IF NOT EXISTS account_auth_identity_idx ON account(auth_issuer, auth_subject);
CREATE TABLE IF NOT EXISTS property_access (
    account_id uuid PRIMARY KEY REFERENCES account(id),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
    organisation varchar(160) NOT NULL DEFAULT '',
    purpose varchar(1000) NOT NULL DEFAULT '',
    requested_at timestamptz,
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES account(id),
    accepted_notice_version text
);
CREATE TABLE IF NOT EXISTS property_access_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES account(id),
    status text NOT NULL,
    reviewed_by uuid NOT NULL REFERENCES account(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sandbox_purchase (
    checkout_id text PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES account(id),
    payment_intent text UNIQUE NOT NULL,
    passes integer NOT NULL CHECK (passes > 0),
    amount_cents integer NOT NULL CHECK (amount_cents > 0),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sandbox_customer (
    account_id uuid PRIMARY KEY REFERENCES account(id),
    customer_id text UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS sandbox_pass_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES account(id),
    delta integer NOT NULL,
    ref text UNIQUE NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sandbox_pass_account_idx ON sandbox_pass_ledger(account_id);

-- Both purchases and report debits lock the account row. A concurrent request
-- cannot spend the same last pass. Approval is rechecked at the point of debit.
CREATE OR REPLACE FUNCTION sandbox_consume_pass(who uuid, reference text) RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM 1 FROM account WHERE id=who FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM property_access WHERE account_id=who AND status='approved') THEN RETURN false; END IF;
    IF EXISTS (SELECT 1 FROM sandbox_pass_ledger WHERE ref=reference AND account_id=who AND delta=-1) THEN RETURN true; END IF;
    IF (SELECT COALESCE(SUM(delta),0) FROM sandbox_pass_ledger WHERE account_id=who) < 1 THEN RETURN false; END IF;
    INSERT INTO sandbox_pass_ledger(account_id,delta,ref) VALUES(who,-1,reference);
    RETURN true;
END $$;

CREATE OR REPLACE FUNCTION sandbox_fulfill(checkout text, who uuid, intent text, count_passes integer, amount integer) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM 1 FROM account WHERE id=who FOR UPDATE;
    INSERT INTO sandbox_purchase(checkout_id,account_id,payment_intent,passes,amount_cents)
        VALUES(checkout,who,intent,count_passes,amount) ON CONFLICT(checkout_id) DO NOTHING;
    IF NOT FOUND THEN RETURN; END IF;
    INSERT INTO sandbox_pass_ledger(account_id,delta,ref) VALUES(who,count_passes,'checkout:' || checkout);
END $$;

-- Cumulative refund amount makes retries and out-of-order refund events safe.
CREATE OR REPLACE FUNCTION sandbox_refund(intent text, refunded integer) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE purchase sandbox_purchase%ROWTYPE; already_removed integer; target integer;
BEGIN
    SELECT * INTO purchase FROM sandbox_purchase WHERE payment_intent=intent;
    IF NOT FOUND THEN RAISE EXCEPTION 'purchase not yet fulfilled'; END IF;
    PERFORM 1 FROM account WHERE id=purchase.account_id FOR UPDATE;
    target := LEAST(purchase.passes, CEIL(purchase.passes::numeric * refunded / purchase.amount_cents)::integer);
    SELECT -COALESCE(SUM(delta),0) INTO already_removed FROM sandbox_pass_ledger
        WHERE account_id=purchase.account_id AND ref LIKE 'refund:' || intent || ':%';
    IF target > already_removed THEN
        INSERT INTO sandbox_pass_ledger(account_id,delta,ref)
            VALUES(purchase.account_id,-(target-already_removed),'refund:' || intent || ':' || target);
    END IF;
END $$;
COMMIT;
