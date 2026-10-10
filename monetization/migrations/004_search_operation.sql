BEGIN;

ALTER TABLE search_audit ADD COLUMN IF NOT EXISTS operation_id uuid;
ALTER TABLE search_audit ADD COLUMN IF NOT EXISTS opened_titles text[] NOT NULL DEFAULT '{}'::text[];

UPDATE search_audit SET opened_titles=ARRAY[title_no]
WHERE title_no IS NOT NULL AND cardinality(opened_titles)=0;

CREATE UNIQUE INDEX IF NOT EXISTS search_audit_actor_operation_idx
ON search_audit (actor, operation_id) WHERE operation_id IS NOT NULL;

COMMIT;
