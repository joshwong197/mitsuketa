# Property access invitations

Company searches remain public. Property access uses an application-first flow:

1. `/?access=request` submits email, organisation, intended use and notice acceptance without a Clerk account.
2. An administrator opens **Review access requests** and chooses **Approve & invite**.
3. Clerk emails a seven-day invitation to `PROPERTY_APP_ORIGIN/?access=invite`.
4. Mitsuketa embeds Clerk signup, then routes to `/?access=complete`. The server verifies the Clerk identity and links the approved application. Normal applicants do not apply or get approved again.
5. Property opens at `/?property=1#/app`. An administrator-created invitation without prior notice acceptance requires the recipient to accept the notice first.

## Configuration

Apply `monetization/migrations/003_property_invitations.sql` after migration 002, before deploying these handlers. It adds application/history tables and atomic claim/revoke functions; it does not migrate or approve existing users.

Set `PROPERTY_APP_ORIGIN` to the exact app origin, also present in `CLERK_AUTHORIZED_PARTIES`. Local emails use `http://localhost:3000`; these can only open the app on a machine running that server. Preview deployment must use its own HTTPS origin. The query-based routes work on the existing SPA entrypoint without new server rewrites.

Configure Clerk **Invite-only** access mode (`auth_access_control.sign_up_mode=restricted`). Instance paths: sign-in `/?access=signin`, sign-up `/?access=invite`, home `/?access=complete`. Explicit invitation and success URLs keep the user inside Mitsuketa. Password policy and email-code sign-in remain as previously configured. Development Clerk settings are shared with this branch's preview; production settings are separate.

## Decisions and failure handling

- Public duplicate requests return a generic receipt and cannot overwrite details or alter a decision. Intake has a soft per-instance/IP limit of five requests per minute.
- Admin endpoints verify immutable Clerk admin IDs, issuer and request origin. Browser-submitted emails, roles or metadata cannot grant access.
- New identities claim using backend-owned invitation metadata, verified email and issuer. Existing Clerk identities are explicitly bound to their immutable subject by the approval service. Legacy email-only collisions and disabled accounts require manual review; they are never silently linked.
- A database send lease prevents simultaneous sends. Failed responses reconcile pending provider invitations by the persisted grant nonce, avoiding duplicate mail on retry. Resend revokes the previous invitation and rotates the nonce.
- Expired or revoked grants cannot activate access. Revocation locks the application and suspends an already-linked account atomically. If Clerk cannot revoke the email itself, the application still prevents property access.
- Invited users become **Active** when the application is linked. Existing accounts managed by an application are excluded from the legacy review controls.
- Privacy acceptance is enforced by the property API, including administrator-created test invitations. The agent must never manufacture a recipient's acceptance.
- Acceptance screens embed the shared privacy/terms documents in keyboard-focusable scroll regions. Both must reach their end before the checkbox unlocks; progress resets on a fresh visit or notice-version change. This is a browser UX gate, not proof of reading or a server-verifiable security control. Existing valid acceptances are retained.

## Verification

`npm run check:property-invitations` tests application/admin/origin/notice gates, redirects, delivery retry, duplicate sends, resend, legacy collisions and existing identities.

`tests/property-invitations.sql` exercises claim/revoke against Postgres. It deliberately raises a `PASS` exception at the end to roll back all synthetic rows; other errors indicate failure.

`npx playwright test tests/browser/property-invitations.spec.ts` checks the public form and error/retry handling with mocked application responses. `npm run check:property-access` checks property API and billing gates.

A local integration check also exercised real Clerk invitation signup with delivery disabled to a synthetic test address, automatic Neon activation, Property landing, and immediate API refusal after revocation. Synthetic users and records were removed afterward. The recipient's final email delivery and signup are a separate manual retest.

References: [Clerk invitations](https://clerk.com/docs/guides/users/inviting), [invite-only access](https://clerk.com/docs/guides/secure/restricting-access), [invitation signup](https://clerk.com/docs/guides/development/custom-flows/authentication/application-invitations).
