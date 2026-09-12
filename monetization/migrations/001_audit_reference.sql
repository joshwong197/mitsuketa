-- Preserve historical AUD-<id> references; only new rows get random UUIDs.
BEGIN;
ALTER TABLE search_audit ADD COLUMN IF NOT EXISTS audit_reference uuid;
ALTER TABLE search_audit ALTER COLUMN audit_reference SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS search_audit_reference_idx ON search_audit (audit_reference);
COMMIT;
