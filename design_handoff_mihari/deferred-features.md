# Mihari — Deferred Product Ideas

Features surfaced during design exploration that are **not currently in the product** but worth considering post-launch. Tracked here so the design doesn't drift into implying capabilities that don't exist.

---

## From Watchlist design (2026-01)

### ✅ Kept in design
- `All entities` / `Watch closely` / `Muted` list grouping — simple, no new data model needed beyond per-entity flags.

### 🕯 Parked — need product + engineering decision before we promise them in UI

1. **Named custom lists / tags per entity**
   - Originally shown as *Trade creditors* and *Loan portfolio* chips.
   - Requires: new `watchlist_tags` table (user-scoped), many-to-many join to entities, CRUD UI, inclusion in CSV export, and filter persistence.
   - Value: lets a user cross-slice their 50 entities by how they relate to the business (receivables vs lending vs prospect). High signal for credit teams.
   - Deferred because: we don't have multi-tenant tagging yet, and the bare watch-list works without it.

2. **Bulk actions**
   - UI shows: *Mute for 7 days*, *Move to list…*, *Mark all read*, *Remove from watchlist*.
   - Requires: batch endpoints + snooze/mute scheduling (per-entity timer that auto-expires).
   - *Move to list* depends on (1) landing first.
   - *Mark all read* requires a read-state table on `alerts` or a per-user alert_recipients row (we already have the latter — cheap to wire up).

3. **Severity tally per entity (last 7 days)**
   - The 紅/琥/青 counts shown per row.
   - Requires: a rolling-window aggregate query. Either compute on read (fine at 42 entities, breaks at 500+) or materialise nightly.

4. **7-day sparkline**
   - Tiny bar chart of alert volume per day.
   - Same aggregate as (3); same scaling concern.

5. **Inline row expansion → last 3 events + side actions**
   - Pattern works visually; requires the API to return recent alerts keyed by entity (we have this) and an entity-details endpoint for the right-hand metadata panel.

6. **"Add entity" live NZBN search drawer**
   - Typeahead against the live NZBN index.
   - Requires: proxy + caching layer in front of NZBN's search API, plus quota enforcement against the user's plan tier (shown as 42 / 50).

7. **Export CSV** (header button)
   - Needs: server-side job that snapshots the current visible filter into a CSV with NZBN, name, status, last event, 7-day tallies. Small scope but currently non-existent.

8. **Plan-tier capacity line** ("Roster capacity · 50 / plan tier · Ledger")
   - Implies billing tiers exist. We should either:
     - confirm the Ledger tier name + cap in pricing, or
     - remove this footer line before any demo.

---

## From Alerts design (2026-01)

### Parked
- **Per-director name redaction** — the original draft surfaced director names in alert bodies. We've since removed them (Privacy Act / access-to-information concern). The design now says *"A director of this entity is also a director of …"* without naming the person. Keep this rule in future screens: **never render natural-person names from registry data inline.** Link out to the Companies Office public record instead.
- **Cross-reference engine** — alerts of type `cross_entity_risk` (trigger #65). Requires: a graph over all watchlists' entities + their director counts, updated on every director_change event. Computationally cheap; data-model change is small.
- **AI risk summary line** — the short synthesised paragraph on each alert detail. Needs an LLM call per alert on creation; shown as `ai_risk_summary` in the alert schema. Discuss cost + factuality guarantees before rolling out.
