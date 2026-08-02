# Property search — access control plan

Status: **phase 1 built.** Phase 2 (OIDC) still open. Read this before touching
`api/property.ts`.

**Shape as shipped** — one environment variable per user, keyed by slugged
email, holding a scrypt hash:

```
PROPERTY_PW_NITESHNI_SWAMI_FBU_COM = scrypt$<salt>$<key>
```

`npm run property:user -- someone@fbu.com` mints one. Sign in with the full
address. Code: `utils/propertyUsers.ts` (slug, hash, verify, session secret),
`utils/property.pw.ts` (CLI), `api/property.ts` (login + session).

`PROPERTY_PASS` still works when **no** `PROPERTY_PW_*` exists, and is ignored
entirely once one does — leaving both live would make the shared password a
standing bypass around per-user revocation.

Why one variable each rather than a `user:pass,user:pass` blob: resetting one
password must not touch anyone else's. With a blob you rewrite the whole string
— from memory, if it is marked Sensitive — and one slip locks out a colleague.

The session cookie is signed with the user's **stored hash**, so a reset changes
their signing secret and signs out that person alone. Deleting their variable
revokes them immediately rather than at cookie expiry, because `readSession`
looks the hash up on every request.

Passwords are never stored, so the variable does not need the Sensitive flag to
be safe from disclosure — a reader gets a scrypt hash, not a credential. Marking
it Sensitive is still cheap defence in depth, at the cost of not being able to
read the value back.

Verified by direct test, not inspection: correct/wrong/cross-user passwords,
unknown accounts, case and whitespace handling, salting, malformed stored
values, and — the one that matters — that rotating one user changes only that
user's session secret and leaves everyone else authenticating.

---

## 1. What is actually true today (verified, not assumed)

A working assumption in the last conversation was "we aren't capturing property
searches, so the mandatory reference field isn't really needed". Both halves of
that are wrong, and the second one is backwards. Establish these before
re-deciding anything.

**Searches are captured.** `utils/audit.ts` records `sign-in`, `sign-in-failed`,
`search-address`, `search-owner`, `report-opened` and `refused`, each with the
reference, the query typed, the self-declared name and the IP. It writes
`[property-audit] {json}` to stdout — on Vercel that is the platform log, read
with `vercel logs`. Results are deliberately **not** recorded: copying returned
personal data into a second store would give it its own retention story.

**The reference is already mandatory server-side**, not just in the UI —
`api/property.ts` refuses the request with `reference_required`.

**And it is mandatory *because* the credential is shared.** With one shared
password the log cannot record *who*, so the reference records *why*. That is
aimed at the LINZ Licence for Personal Data wanting a record of who searched for
what. Today the reference is the only real accountability the log carries;
removing it would leave searches attributable to a free-text name and an IP.

Once identity is verified (§3) the reference stops being load-bearing and
becomes a genuine product choice. **Do the auth work first, then revisit the
field** — not the other way round.

Caveat worth carrying: captured ≠ auditable. Platform logs only, not queryable
in-app, no stated retention period, no deletion routine. `audit.ts` already
carries a TODO to move to Postgres, which is also what the admin view needs.

## 2. The trap in "eventually only @fbu.com addresses"

**A domain check is only a gate if something verifies the mailbox.**
`PROPERTY_ALLOWED_DOMAINS=fbu.com` checked against a typed-in email plus a
password is *weaker* than the current shared password: anyone who can guess the
address format is through, and the audit log fills with self-asserted
identities.

Domain gating and an IdP are one feature. The domain rule is its second half,
never a standalone step. Do not ship a password-based domain check.

## 3. Two phases, one codebase

Make identity a first-class object from the start so phase 2 is a swap, not a
rewrite:

```ts
identity = { email, verified: false }   // phase 1, password-based
identity = { email, verified: true }    // phase 2, IdP-asserted
```

The audit log records the email **and** the `verified` flag, so interim entries
stay honestly distinguishable from post-SSO ones instead of being silently
conflated. Write the domain-allowlist check now but leave it inert unless
`verified` is true.

### Phase 1 — explicit person allowlist (buildable today)

- `PROPERTY_USERS=email:password,email:password`, e.g.
  `joshwong197@gmail.com:ABC123`. Takes precedence over `PROPERTY_PASS`; fail
  closed if neither is set.
- Login form swaps *name* for *email* — it already requires a name, so it is a
  straight substitution — and the email becomes the `searcher` in the audit log.
- Server lower-cases the email, looks it up, `timingSafeEqual`s the password.
- Cookie keeps its current design but signs with **that user's** password as the
  HMAC key. This preserves the existing "rotate the credential and sessions die"
  property, now per-user: changing one password logs out only that person.
  `readSession` reads the email from the signed payload, looks up that user's
  password, verifies against it.

Limits to state plainly rather than paper over: this is an allowlist with a
per-person shared secret, **not verified identity** — nothing proves the person
typing an address owns that mailbox. Passwords sit in plaintext in an env var,
which is acceptable for a handful of internal users; storing scrypt hashes is
the next increment.

### Phase 2 — OIDC, tenant-restricted

Swap the credential check for an OIDC callback, set `verified: true`, switch on
the domain assertion, delete `PROPERTY_USERS`. Cookie, session, audit and the
reference gate are all untouched.

**Open question:** is fbu.com on Microsoft 365 / Entra ID or Google Workspace?
Entra is the likely answer and the M365 connector in that session supports it,
but it was never confirmed, and it decides the library and the app-registration
paperwork. The registration (client ID + redirect URI, approved by IT) is
usually the slow part — not the code.

## 4. Running the phase-1 test

1. `.env`: `PROPERTY_USERS=joshwong197@gmail.com:ABC123` plus `LINZ_API_KEY`.
2. **Add `PROPERTY_USERS` to `SERVER_ENV_KEYS` in `vite-api-plugin.ts`.** That
   plugin copies an explicit allowlist of vars onto `process.env` to emulate the
   Vercel functions; a var missing from that list is invisible in dev and
   property fails closed. Easy hour to lose.
3. `npm run dev` → localhost:3000 → property tab.
4. Four cases: right email + right password → in; right email + wrong password →
   refused; a non-allowlisted email + `ABC123` → refused; and `[property-audit]`
   lines in the terminal carry the email.
5. On Vercel, add `PROPERTY_USERS` scoped to **Preview only** and redeploy the
   branch. Never Production — `ABC123` must not outlive the test.

The test address is deliberately a gmail one, not `@fbu.com`, so it exercises
the person-allowlist and domain rules as genuinely independent.
