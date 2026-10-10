-- Run against a development database after migration 003. The deliberate final
-- exception rolls every synthetic row back; the runner must expect P0001 / PASS.
DO $$
DECLARE reviewer uuid := gen_random_uuid(); who uuid := gen_random_uuid(); app uuid := gen_random_uuid(); ok boolean;
BEGIN
    INSERT INTO account(id,email,auth_issuer,auth_subject) VALUES
      (reviewer,reviewer::text||'@example.test','test-issuer',reviewer::text),
      (who,who::text||'@example.test','test-issuer',who::text);
    INSERT INTO property_access(account_id) VALUES(who);
    INSERT INTO property_application(id,issuer,email,purpose,status,reviewed_by,invite_nonce,expires_at,notice_version)
      VALUES(app,'test-issuer',who::text||'@example.test','Synthetic test','approved',reviewer,'secret',now()+interval '7 days','test-notice');
    ok := property_claim_application(who,'test-issuer',who::text,who::text||'@example.test',app::text,'wrong','test-notice');
    ASSERT NOT ok, 'wrong nonce';
    ok := property_claim_application(who,'wrong-issuer',who::text,who::text||'@example.test',app::text,'secret','test-notice');
    ASSERT NOT ok, 'wrong issuer';
    ok := property_claim_application(who,'test-issuer','wrong-subject',who::text||'@example.test',app::text,'secret','test-notice');
    ASSERT NOT ok, 'wrong identity';
    ok := property_claim_application(who,'test-issuer',who::text,'other@example.test',app::text,'secret','test-notice');
    ASSERT NOT ok, 'wrong email';
    UPDATE property_application SET expires_at=now()-interval '1 day' WHERE id=app;
    ok := property_claim_application(who,'test-issuer',who::text,who::text||'@example.test',app::text,'secret','test-notice');
    ASSERT NOT ok, 'expired invite';
    UPDATE property_application SET expires_at=now()+interval '7 days' WHERE id=app;
    UPDATE property_access SET status='suspended' WHERE account_id=who;
    ok := property_claim_application(who,'test-issuer',who::text,who::text||'@example.test',app::text,'secret','test-notice');
    ASSERT NOT ok, 'suspension must persist';
    UPDATE property_access SET status='pending' WHERE account_id=who;
    ok := property_claim_application(who,'test-issuer',who::text,who::text||'@example.test',app::text,'secret','test-notice');
    ASSERT ok, 'valid invitation activates';
    ASSERT (SELECT status='approved' AND accepted_notice_version='test-notice' FROM property_access WHERE account_id=who), 'approved access';
    ASSERT (SELECT status='active' AND account_id=who FROM property_application WHERE id=app), 'linked application';
    ok := property_claim_application(who,'test-issuer',who::text,who::text||'@example.test',app::text,'secret','test-notice');
    ASSERT NOT ok, 'claim once';
    ASSERT (SELECT count(*)=1 FROM property_access_history WHERE account_id=who), 'idempotent history';
    PERFORM property_decide_application(app,'test-issuer','revoked',reviewer);
    ASSERT (SELECT status='suspended' FROM property_access WHERE account_id=who), 'revoke active access';
    ok := property_claim_application(who,'test-issuer',who::text,who::text||'@example.test',app::text,'secret','test-notice');
    ASSERT NOT ok, 'revocation survives old invite';
    -- An explicitly approved existing immutable subject needs no copied metadata.
    UPDATE property_application SET status='approved',expected_subject=who::text WHERE id=app;
    UPDATE property_access SET status='pending' WHERE account_id=who;
    ok := property_claim_application(who,'test-issuer',who::text,who::text||'@example.test','','','test-notice');
    ASSERT ok, 'explicit existing identity activates';
    RAISE EXCEPTION 'PASS: invitation database gates; all synthetic changes rolled back';
END $$;
