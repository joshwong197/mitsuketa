-- Apply before enabling PROPERTY_LEGAL_RELEASE. Do not backfill inferred consent.
BEGIN;
CREATE TABLE IF NOT EXISTS property_legal_acceptance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES account(id),
 issuer text NOT NULL,
 subject text NOT NULL,
 release text NOT NULL,
 document_set text NOT NULL,
 terms_hash text NOT NULL,
 privacy_hash text NOT NULL,
 linz_version text NOT NULL,
 linz_url text NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,issuer,subject,document_set)
);
-- Preserve the exact published text independently of subsequent deployments.
CREATE TABLE IF NOT EXISTS property_legal_document (
 document_set text PRIMARY KEY,
 terms_html text NOT NULL,
 privacy_html text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS property_privacy_request (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 issuer text NOT NULL,
 account_id uuid REFERENCES account(id),
 kind text NOT NULL CHECK(kind IN ('access','correction','deletion','incident','source-recall')),
 reference text NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in-progress','closed')),
 created_by uuid NOT NULL REFERENCES account(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Retention decisions and holds are reviewed manually; this migration deletes nothing.
COMMIT;
