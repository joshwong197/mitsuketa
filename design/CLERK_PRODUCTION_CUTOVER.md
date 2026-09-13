# Clerk production cutover

## Goal

Move the five existing password users to approved production Clerk accounts without an avoidable loss of Property access. Company and entity searches remain public. Keep the password configuration available for a short rollback window, but never enable both sign-in systems in one deployment.

## Before invitations

1. Prepare the release from a fresh `origin/main` checkout. Select the company scope, entity record/export, Clerk access, privacy, and search-audit changes. Leave the new homepage, annotation overlay, and monetisation material out.
2. Create or select the production Clerk instance. Set it to invite-only. Configure the Mitsuketa sign-in, invitation, and completion URLs on a stable HTTPS preview origin first.
3. Configure the preview deployment with production Clerk keys, the production issuer, the preview origin in `CLERK_AUTHORIZED_PARTIES`, and `PROPERTY_APP_ORIGIN` set to that preview origin. Set both auth-mode variables to `clerk` in the same build.
4. Apply migrations 002, 003, and 004 to the destination Neon database. Migration 004 is already applied to the currently configured Neon endpoint; whether that endpoint is the intended production database has not been verified.
5. Check the five exact emails against both Clerk and Neon. Resolve any email already linked to a development Clerk issuer before sending a production invitation. The code refuses to relink that collision automatically.
6. Bootstrap one production administrator, record that immutable Clerk user ID in `PROPERTY_CLERK_ADMINS`, and verify that **Review access requests** opens on the preview deployment.

## Move the five users

1. Import one pending `property_application` per existing user under the production Clerk issuer. Use an internal migration purpose and leave `notice_version` empty; this prevents the import from claiming that the user accepted the new notice.
2. From **Review access requests**, choose **Approve & invite** for each user. Do not create passwords for them.
3. Each user opens the emailed link, creates their Clerk credentials, reaches Mitsuketa, reads the current privacy notice and terms to the end, accepts them, and opens Property.
4. Confirm in Neon that each application is `active`, its account has the production Clerk issuer and subject, Property access is `approved`, and the current notice version is accepted.
5. Run one property search per migrated user using a clearly identified cutover matter reference. Confirm one audit row per submitted search with the user's email, timestamp, mode/query, matter reference, and any title references opened.

## Production switch

1. Do not switch until all users who need uninterrupted access are active on the preview deployment.
2. Set `PROPERTY_APP_ORIGIN` and `CLERK_AUTHORIZED_PARTIES` to include the production origin. Configure the production invitation and completion routes.
3. Set `PROPERTY_AUTH_MODE=clerk` and `VITE_PROPERTY_AUTH_MODE=clerk` together and deploy the reviewed release.
4. Test company search while signed out, then sign in as the production administrator and run one Property search. Verify its single audit row.
5. Keep the five `PROPERTY_PW_*` values for 48 hours as rollback material. They are ignored in Clerk mode. If a critical issue appears, set both auth-mode variables back to `password` and redeploy the same release.
6. After the acceptance window, remove the old password variables and any development Clerk keys from production.

## Information needed from the owner

- The five exact email addresses.
- Which one or more users should be Property administrators.
- The final production origin and the HTTPS preview origin used for the overlap period.
- Confirmation whether the current Neon database is the intended production database or a development branch.
