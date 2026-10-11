# Chart and individual-record regression review — 11 October 2026

## Where the behaviour came from

| Behaviour | Source | Effect |
| --- | --- | --- |
| Removed companies hidden by default; Simple forcibly hides them | `da2b858`, 22 September, “Improve chart exploration and exports with verified ownership history” | A currently listed shareholder disappears if that shareholder company is removed. Registration status and relationship status were conflated. |
| Wider network initially collapsed to the target and immediate company connections | `da2b858` | History filters alter eligibility but do not expand branches. People were also left out of controlled node state; that separate visibility/drag regression was fixed in PR #15. |
| Duplicate “Identity not confirmed” on the individual card | `08a5a2f`, 16 September, “Widen individual cards and preserve split role seal” | Repeats the existing same-name notice below the card. |
| Insolvency strip opens automatically only for current findings | `5ac9fd9`, 31 July, “Fix person-node bugs, draw directors, and build the role-mark seal” | Historical findings show a count until the user opens the strip, despite detailed records already being available. |

The 10 October release commit `7f41761` carried these rules into main. Comparing the 22 September branch commit with the release shows no differences in `PersonSubjectCard.tsx`, `PersonSearchResults.tsx`, `graphVisibility.ts` or `companyScope.ts`, and no changes to the relevant Simple/removed-filter rules in `App.tsx`. This is not evidence of a merge dropping those features. The local checkout also contains the rules; the exact older browser build and saved-view state the user reviewed cannot be established from source history alone.

## Evergreen evidence

The current public NZBN response for EVERGREEN MODULAR LIMITED (`9429047070509`) lists a 1,000-share allocation to PROPERTY PARTNERS GROUP HOLDINGS LIMITED (`9429047029798`). Its shareholder appointment is 9 October 2018 and `vacationDate` is null. The holder's own entity record says Removed.

Simple should mirror that current register allocation and display the shareholder with its Removed status. This does not establish that the holder is registered, and does not justify including relationships that have ended. The former Sims Pacific Metals relationship must still be excluded from a current-only view.

## Corrections

- Simple retains current immediate holders regardless of their registration status. Comprehensive still applies the separate removed-company filter. The searched target always remains visible.
- Enabling a Comprehensive history filter expands the fetched branches. Each filter still governs its own data; former relationships and removed companies remain separate choices.
- Filter counts use the full fetched graph so a collapsed branch cannot disable a valid filter. “Expand all branches” is available in the sidebar as well as the context menu.
- The downloaded interactive HTML viewer follows the same holder and expansion rules.
- Remove the duplicate individual-card qualification while retaining the same-name notice below it.
- Open historical insolvency matches with their available record details. Include estate number, court when supplied, and an explicit warning if the detail request was unavailable. Person HTML reports include those fields too.

## Verification and limits

- TypeScript check and production build pass.
- Graph scope checks cover a current removed holder, exclusion of former/unverified links from Simple, Comprehensive's removed filter, visible directors, saved-graph repair and drag-position preservation.
- Discovery checks verify Simple remains immediate and Comprehensive still fetches the wider graph.
- Person export checks verify actual record identifiers/dates/court, removal of duplicate header wording and retention of the name-match caveat.
- Actual local browser checks with offline register fixtures verify the removed current holder in Simple and the upstream company/director appearing when Comprehensive's removed filter is enabled.
- Actual individual-component browser check verifies historical record details are visible without opening the strip.
- Browser regression specifications were added for these cases; this review exercised the browser through the connected browser tool, rather than running the Playwright runner.
- The updated HTML report was downloaded successfully. Browser policy blocks direct `file:` navigation, so its standalone file rendering was not visually verified in this pass.

The previous branch checks used a registered shareholder and did not cover a removed company still listed as a current holder. That missing case allowed the filter regression to reach main. Future acceptance checks should use the same scenarios against both a fresh deployed search and restored workspace tabs; a passing local build alone is insufficient.
