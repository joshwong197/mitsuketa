# Property search — access control plan

Status: **phase 1 built.** Phase 2 (OIDC) still open. Read this before touching
`api/property.ts`.

**Shape as shipped** — one environment variable per person, keyed by slugged
email, holding that person's password:

```
PROPERTY_PW_JANE_DOE_FBU_COM = <that person's password — real values live ONLY in Vercel env vars, never in the repo>
PROPERTY_PW_JOSHWONG197      = <admin account, a bare username rather than an email>
```

Sign in with the address. `npm run property:user -- <email>` prints the variable
name; the value is just the password, set and changed in the Vercel dashboard
with no tooling in the loop. Code: `utils/propertyUsers.ts`, `api/property.ts`.

Passwords were originally scrypt-hashed. That was dropped as too much friction —
every reset had to go through a hashing step the account owner could not run
themselves. A `scrypt.<salt>.<key>` value is still accepted and verified as a
hash, so hashing can return per-account without a migration. The trade being
made: anyone who can read the environment reads the passwords, which is fine for
purpose-made credentials used only here and not fine for a password reused
anywhere else.

**There is no shared password.** `PROPERTY_PASS` was removed rather than kept as
a fallback. Two reasons, the second learned the hard way: a credential that
works for everybody is what per-user accounts exist to end, and as a silent
fallback it made a deployment that could not see the per-user variables look
exactly like "everyone typed their password wrong" — while whoever knew the
shared password signed in fine. That misconfiguration is now a 503 that names
what is missing, and every sign-in logs the credentials it can see.

Why one variable each rather than a `user:pass,user:pass` blob: resetting one
password must not touch anyone else's. With a blob you rewrite the whole string
— from memory, if it is marked Sensitive — and one slip locks out a colleague.

The session cookie is signed with a secret derived from the user's stored
credential, so a reset changes their signing secret and signs out that person
alone. Deleting their variable revokes them on the next request rather than at
cookie expiry, because the credential is looked up every time.

Sign-in is throttled: 10 failures per account and 100 per IP in 15 minutes. The
limits differ because a tight IP limit locks out a whole office sharing one
public address — the first version did exactly that in testing.

Verified against a running server, not by inspection: all six accounts signing
in with their own passwords, every cross-account password refused, an unknown
account refused, the throttle locking one account while another on the same IP
still signs in, and `PROPERTY_PASS` having no effect while present.

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

**It was mandatory *because* the credential was shared.** With one password for
everyone the log could not record *who*, so the reference recorded *why* — aimed
at the LINZ Licence for Personal Data wanting a record of who searched for what.

That has partly changed: the log now carries a per-person account rather than a
free-text name, so the reference is no longer the only accountability there is.
It is still the only record of *why* a search was run, and identity is still
self-asserted rather than proven (§2), so dropping it is now a real choice
rather than an obvious one. Revisit it after phase 2, not before.

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

### Phase 1 — per-person credentials — **BUILT**

See the summary at the top of this document for the shape as shipped. It differs
from what was sketched here: one variable per person rather than a
`PROPERTY_USERS` blob (a blob cannot be edited safely one entry at a time), and
`PROPERTY_PASS` deleted outright rather than kept as a precedence rule.

Limits worth restating: this is an allowlist with a per-person secret, **not
verified identity** — nothing proves the person typing an address owns that
mailbox, which is why the audit log records `verified: false`.

### Phase 2 — OIDC, tenant-restricted

Swap the credential check for an OIDC callback, set `verified: true`, switch on
the domain assertion, delete the `PROPERTY_PW_*` variables. Cookie, session, audit and the
reference gate are all untouched.

**Open question:** is fbu.com on Microsoft 365 / Entra ID or Google Workspace?
Entra is the likely answer and the M365 connector in that session supports it,
but it was never confirmed, and it decides the library and the app-registration
paperwork. The registration (client ID + redirect URI, approved by IT) is
usually the slow part — not the code.

## 4. Testing locally

1. `.env`: `LINZ_API_KEY=...` plus one line per account, e.g.
   `PROPERTY_PW_JANE_DOE_FBU_COM=not-a-real-password` (the untracked local
   `.env` is the only file a real password may ever be typed into).
2. `npm run dev` → localhost:3000 → property tab. The dev API plugin matches
   `PROPERTY_PW_*` by prefix, so new accounts need no plugin change — but note
   it reads `.env` once at startup, so adding an account means a restart.
3. Worth covering: each account with its own password; one account's password
   against another's; an unknown address; and ten failures locking one account
   while a second still signs in.

`vercel logs` shows `[property] N credential(s) configured [...]` on every
sign-in, and names the variable it looked for when an account has none — which
is how a mistyped variable name is told apart from a mistyped password.
