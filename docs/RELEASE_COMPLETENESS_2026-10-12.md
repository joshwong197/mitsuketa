# Release completeness — 12 October 2026

## Changes

- Search is the landing page. About has its own route; navigation preserves open files and their saved state.
- Property applications collect name, role, intended use, search volume, sharing, recipients and information safeguards, with an accuracy confirmation. Administrators review the answers before granting access.
- Privacy and terms appear in one continuous reader. Its larger view stays in the same tab and shares reading completion with the inline view.
- Property reports use a wide indigo card with a kanji mark and a sans-serif title. Exported reports carry the equivalent presentation, LINZ attribution and `noindex` metadata.
- Current liquidation records have a red record spine.
- Address cleanup removes only the exact delimiter artifacts, deduplicates repeated addresses and preserves source information. Repeated email addresses are also deduplicated.
- Workspace copy uses “File” and “Open files”. Property scrolling no longer clips content. The header uses neutral register-source wording.
- Existing graph rendering fixes are preserved.

## Legal controls and database

The legal-controls code is included. `PROPERTY_LEGAL_RELEASE` and `PROPERTY_AUDIT_REVIEW_DAYS` remain unset until the final terms are approved. Published terms are unchanged. Retention review does not automatically delete records.

Additive migrations `005_legal_acceptance.sql` and `006_property_application_details.sql` were applied and verified in the production database. No existing account data was deleted, and no consent or acceptance was invented for existing accounts.

## Verification

Passed in this release worktree:

- Council valuation routing, licensed adapters and safe fallback (`utils/councilValuation.check.ts`).
- Compare ownership evidence and bounded verification (`services/compareService.check.ts`).
- Case persistence, quota handling, notes, snapshots and filters (`utils/caseStore.check.ts`).
- Register evidence parsing, document grouping and safe source URLs (`utils/registerEvidence.check.ts`).
- TypeScript validation (`tsc --noEmit`).
- Release lead checks: graph, property access, invitations, legal acceptance, application questionnaire, entity profile and production build.

Browser CI tests were updated but not executed. They now cover direct search entry, Open files, the combined reader, the full application payload, both confirmations, retry behavior, current notice and LINZ acceptance, and the absence of payment actions. Actual browser checks confirmed the direct search landing, separate About route, desktop/390px mobile About and property card fit, one larger combined reader, and scroll-to-end acceptance unlocking. Independent screenshot review passed after clarifying Comparison name matching. Screenshots are in the isolated checkout's ignored tmp folder.

## Morning checks

1. Open the deployed root URL; confirm search opens immediately. Open a company file, visit About and return; confirm the file and its state remain.
2. Submit a synthetic property application with all answers. Confirm acceptance unlocks only at the end of the combined document and that the larger reader stays in the tab. Review the answers as an administrator.
3. Check a property report on desktop and mobile: the full card, title, scroll area and final actions must be reachable. Export it and confirm presentation, LINZ attribution and `noindex` metadata.
4. Check a company with current liquidation evidence, repeated addresses and repeated emails: confirm the red spine, clean deduplicated values and retained source information.
5. Confirm File labels and the neutral register-source header. Confirm property access offers no payment checkout.
6. Keep the legal release and retention settings unset until the final terms are approved; complete the release configuration only after that decision.
