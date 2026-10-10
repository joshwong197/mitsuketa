-- Pre-account applications. Additive; does not approve or relink existing users.
BEGIN;
CREATE TABLE IF NOT EXISTS property_application (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    issuer text NOT NULL,
    email citext NOT NULL,
    organisation varchar(160) NOT NULL DEFAULT '',
    purpose varchar(1000) NOT NULL,
    notice_version text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','active','rejected','revoked')),
    requested_at timestamptz NOT NULL DEFAULT now(),
    reviewed_at timestamptz,
    reviewed_by uuid REFERENCES account(id),
    invite_nonce text,
    invitation_id text,
    invitation_state text NOT NULL DEFAULT 'none' CHECK (invitation_state IN ('none','sending','sent','failed')),
    send_lease_until timestamptz,
    expires_at timestamptz,
    expected_subject text,
    account_id uuid UNIQUE REFERENCES account(id),
    activated_at timestamptz,
    UNIQUE(issuer,email)
);
CREATE TABLE IF NOT EXISTS property_application_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES property_application(id),
    action text NOT NULL,
    actor uuid NOT NULL REFERENCES account(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Called only with a server-verified Clerk identity and server-owned metadata.
-- Lock the application for both claim and revoke so a racing claim cannot
-- restore access after revocation. No email-only account linking.
CREATE OR REPLACE FUNCTION property_claim_application(who uuid, identity_issuer text, identity_subject text,
    verified_email text, grant_id text, grant_nonce text, current_notice text) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE application property_application%ROWTYPE;
BEGIN
    SELECT * INTO application FROM property_application a
      WHERE a.issuer=identity_issuer AND a.email=verified_email
        AND a.status='approved' AND a.expires_at > now()
        AND ((a.expected_subject IS NOT NULL AND a.expected_subject=identity_subject)
          OR (a.expected_subject IS NULL AND a.id::text=grant_id AND a.invite_nonce=grant_nonce))
      FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    IF NOT EXISTS(SELECT 1 FROM account WHERE id=who AND auth_issuer=identity_issuer
        AND auth_subject=identity_subject AND email=verified_email) THEN RETURN false; END IF;
    UPDATE property_access SET status='approved',organisation=application.organisation,
      purpose=application.purpose,requested_at=application.requested_at,
      reviewed_at=application.reviewed_at,reviewed_by=application.reviewed_by,
      accepted_notice_version=application.notice_version
      WHERE account_id=who AND status IN ('pending','approved');
    IF NOT FOUND THEN RETURN false; END IF;
    UPDATE property_application SET status='active',account_id=who,activated_at=now() WHERE id=application.id;
    INSERT INTO property_access_history(account_id,status,reviewed_by) VALUES(who,'approved',application.reviewed_by);
    RETURN true;
END $$;

CREATE OR REPLACE FUNCTION property_decide_application(app uuid, identity_issuer text, decision text, reviewer uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE application property_application%ROWTYPE;
BEGIN
    IF decision NOT IN ('rejected','revoked') THEN RAISE EXCEPTION 'invalid decision'; END IF;
    SELECT * INTO application FROM property_application WHERE id=app AND issuer=identity_issuer FOR UPDATE;
    IF NOT FOUND THEN RETURN NULL; END IF;
    UPDATE property_application SET status=decision,invite_nonce=NULL,expected_subject=NULL,
      reviewed_by=reviewer,reviewed_at=now() WHERE id=app;
    IF application.account_id IS NOT NULL THEN
      UPDATE property_access SET status='suspended',reviewed_by=reviewer,reviewed_at=now() WHERE account_id=application.account_id;
      INSERT INTO property_access_history(account_id,status,reviewed_by) VALUES(application.account_id,'suspended',reviewer);
    END IF;
    INSERT INTO property_application_history(application_id,action,actor) VALUES(app,decision,reviewer);
    RETURN application.invitation_id;
END $$;
COMMIT;
