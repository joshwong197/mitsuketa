BEGIN;
-- NULL identifies older applications, which must not be treated as having answered this questionnaire.
ALTER TABLE property_application ADD COLUMN IF NOT EXISTS application_details jsonb;
COMMIT;
