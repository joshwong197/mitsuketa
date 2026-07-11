# Handoff: Mihari — NZ Credit Watch Platform

> **Tagline:** 見張り — the watchman. A quiet watch over your ledger.

Mihari is a credit-intelligence product for NZ businesses. It continuously monitors the Companies Office / NZBN register and the NZ Gazette for signals on entities a user cares about (trade creditors, loan portfolio, prospects, etc.) and sends email alerts when a watched entity's status, directors, shareholders, addresses, filings, or gazetted notices change.

This handoff covers **seven screens** (landing, dashboard, watchlist, alerts, entity detail, preferences, auth-adjacent), a **full design system**, and the **data + recipient routing model** implied by the designs.

---

## About the Design Files

The files in this bundle (`*.html`, `screens/*.jsx`, `shared/system.jsx`, `variations/*.jsx`) are **design references created in HTML+JSX for prototyping only** — they show intended look, layout, copy, interactions, and data shape. They are **not production code** to copy directly.

The implementation task is to **recreate these designs in a real codebase**, wired to real data (NZBN API, NZ Gazette RSS, Postgres, email delivery). If no codebase exists yet, the recommended stack is:

- **Framework:** Next.js (App Router) or Remix — both fit the SSR-heavy, email-delivery nature of the product.
- **DB:** Postgres with a migration tool (Drizzle or Prisma).
- **Auth:** Clerk or Auth.js.
- **Email:** Resend or Postmark (supports templated HTML with good deliverability for transactional mail).
- **Cron / workers:** A platform-native cron (Vercel Cron, Railway cron) calling worker routes that hit the NZBN API and diff snapshots.
- **Deployment:** Vercel or Railway.

The design system is framework-agnostic — the tokens, typography, and component specs translate to any React/Vue/Svelte setup without change.

## Fidelity

**High fidelity.** These are pixel-level mockups with final colour tokens, typography scale, spacing values, exact copy, and specified interaction behaviour. Recreate them faithfully — the restraint of the visual system is the product's defining characteristic and must not drift.

---

## The Visual System — in one paragraph

Mihari is **Japanese editorial × NZ credit intelligence**: sumi-e restraint, editorial masthead typography, structural kanji used as meaningful glyphs (not decoration), and a single vermillion *hanko* seal (見) as the only saturated colour on the page. No rounded corners. No drop shadows. No gradients. No emoji. No hand-drawn SVG illustrations. No cozy-editorial cream. Two modes: **lacquer-black dark (default)** and **cool-stone light** — both cool, never warm. See `design.md` in this bundle for the full design system and the forbidden-patterns list.

---

## Screens

### 1. Landing page (`Mihari Landing.html`)
**Purpose:** Marketing. Explain what Mihari watches, why, and how.
**Layout:** Single-column editorial, ~1440px max width, 80–96px horizontal gutters. Alternating `bg` / `panel` surfaces between sections for rhythm. Sections (in order): nav + status strip → hero (huge serif headline with one italic emphasis word, hanko seal mark, primary CTA) → premise → what we watch (14 trigger categories in a grid) → how the watch works (3-movement *jo-ha-kyū* block) → severity explainer (紅/琥/青) → sample alert email preview → pricing (single tier, NZD) → footer.
**Key components:** `<Label>` (roman numeral · mincho kanji · gothic text), `<Hanko>` at 320px for hero, 110px for CTA footer.

### 2. Dashboard (`Mihari Dashboard.html`)
**Purpose:** The morning check-in. "What did the watchman see overnight?"
**Layout:** Left 240px sidebar (nav) + main content. Top strip: four metric tiles (entities watched, alerts today, red this week, next sweep). Below: today's alert feed (hero), grouped by severity with kanji-square leaders. Right-rail: sweep status log.
**State:** Current user, 42 entities watched, "good morning" greeting with date in NZ locale.

### 3. Watchlist (`Mihari Watchlist.html`)
**Purpose:** The roster of entities being watched. Manage the watch, not the alerts.
**Layout:** Sidebar + main. Top: masthead ("The roster — 42 on watch"), filter tabs (*All entities · Watch closely · Muted*), search, "+ Add entity" CTA.
**Table:** counter kanji (52px mincho vermillion) · entity name (serif 22) + NZBN (mincho 12) · status kanji square · 7-day severity tally (紅 琥 青 counts) · 7-day sparkline · last event time · expand arrow.
**Row expand:** three-column grid — gutter · recent events list · side panel with details + actions (Open entity · See all alerts · Mute for 7 days).
**Recipients strip** (NEW — the feature just added): sits at the top of the expanded row, spanning full width. Shows: 宛先 Recipients label · override status badge (*using default* vs *overrides default*, vermillion) · chip list of computed recipients (solid vermillion border = added for this entity; dashed strikethrough = removed from default) · *Edit overrides →* action · *Reset to default* action (when overridden).
**Add entity drawer:** right-hand slide-in, live NZBN search typeahead, plan capacity indicator.

### 4. Alerts (`Mihari Alerts.html`)
**Purpose:** The full alert feed. Every triggered event, grouped by day.
**Layout:** Sidebar + main. Sticky date headers in serif. Each alert row: severity kanji square (40px) · serif headline · gothic meta line (`source · trigger # · time ago`) · serif body description · optional AI risk summary paragraph under a `ruleSoft` divider.
**Filters:** severity (Red/Amber/Green), entity, trigger category, date range.
**Detail view:** large kanji + italic severity word + source citation block + timeline showing `prev → next` state snapshot.

### 5. Entity detail (`Mihari Entity.html`)
**Purpose:** Read-only ledger for one watched entity. Currently prototyped with Kōwhai Logistics Ltd as the example.
**Layout:** Left TOC rail (wide ≥1280px) + main editorial column with narrow-screen chip TOC fallback. Masthead: entity name in serif 72/300, NZBN in mincho 14, status in ai blue.
**Sections (numbered roman, with kanji anchor):**
1. Overview (概) — particulars strip: industry, registered office, on watch since, last sweep
2. Timeline (歴) — ledger of every alert-triggering event, oldest last; each expandable to show `prev → next` field diff
3. Directors (役) — **counts only, no natural-person names** (Privacy Act compliance)
4. Shareholders (株) — counts + top-holding concentration only
5. Addresses (所) — registered / service / postal, with history rows
6. Filings (届) — annual return / financial statements status
7. **Recipients (宛)** (NEW) — inline-editable per-entity override panel (see below)
8. Notes (記) — private textarea, autosaved

**Recipients panel (entity detail) — the core pattern:**
- **Banner:** green `既定` seal + "Using your default recipients" OR vermillion `例外` seal + "This entity overrides the default recipients" + N added/N removed count + *Reset to default* button + *Edit defaults →* link to Preferences.
- **Table rows:** address + primary badge (on `josh@mihari.nz`) · 3 severity toggle squares (紅 琥 青) · source tag (● Inherited from default / ● Added for this entity) · Remove button.
- **Suppressed defaults** render as a dimmed, strikethrough row with a *Restore* button.
- **Add row** at bottom: `＋` vermillion glyph · email input · "Add to this entity" button.
- Footer caveat: "Per-entity overrides apply only here. If you remove a default, that recipient continues to receive alerts for every other entity on your watchlist — silenced on this one alone."

### 6. Preferences (`Mihari Preferences.html`)
**Purpose:** Global settings. Four tabs: *Recipients · Triggers · Delivery · Preview*.

**Recipients tab — renamed "Default recipients":**
- Heading: "Default recipients." (h2, serif 34/300)
- Intro copy: *"New entities inherit this list. Any entity on your Watchlist can override these defaults — add a credit officer for one borrower, route gazette notices on a specific company to legal, mute a noisy one entirely. The primary address always hears everything."*
- **Override summary strip:** `例外` mincho label · "3 entities currently override these defaults" · list of entity names · *Manage on watchlist →* link.
- **Table columns:** Address · Severity (3 kanji squares) · Default scope ("All entities" + "Overridden on 3 entities" sub-line) · Cadence · Edit.
- Primary badge on `josh@mihari.nz`. Verified/pending state per address.
- *+ Add recipient* button opens right-side drawer.

**Triggers tab:** 14 alert categories (from the design system: entity_status_change, company_insolvency, personal_insolvency, director_change, officer_role_change, shareholder_change, name_change, address_change, gazette_notice, filing_compliance, contact_change, business_profile, disqualified_director, cross_entity_risk). Each category expandable to per-trigger detail (e.g. `#13 Liquidator appointed`, `#14 Receiver appointed`, etc.). Per-trigger on/off toggles. Severity inherent to each trigger.

**Delivery tab:** digest vs real-time routing, quiet hours (start/end time inputs), timezone selector.

**Preview tab:** cool-stone email template rendered at 560px. Always cool-stone light even in dark mode.

### 7. Shell / Auth patterns
The sidebar nav is shared across Dashboard, Watchlist, Alerts, Entity, Preferences. Items: **Dashboard · Alerts · Watchlist · Preferences**. Hanko mark (34px) at top. Active state: `ink` text, `vermillion` 2px left border. Sign-out link at bottom in `gothic` 11/500.

Auth screens (sign-in, sign-up, verify-email) not in this handoff but should use: single-column layout, serif headline + ai italic accent word, square inputs, `ink`-on-`bg` primary button, hanko at 80px above the form, NZ-style plainspoken copy.

---

## Data Model

The design implies this schema. A Claude Code implementer should wire these tables in Postgres (snake_case column names, camelCase in TS):

```sql
-- Core: entities watched by any user
entity (
  nzbn               text primary key,     -- NZ Business Number, 13 digits
  name               text not null,
  status             text not null,        -- 'Registered' | 'In Liquidation' | 'Removed' | 'Struck off' | ...
  industry           text,                 -- ANZSIC + free-text suffix, e.g. "Road freight · Auckland"
  registered_office  text,
  service_address    text,
  postal_address     text,
  incorporated_on    date,
  last_sweep_at      timestamptz not null,
  created_at         timestamptz default now()
);

-- A user's watchlist
watchlist_item (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth_user(id),
  entity_nzbn        text not null references entity(nzbn),
  list_id            text not null,        -- 'all' | 'watch_closely' | 'muted' (v1); custom lists deferred
  added_on           timestamptz default now(),
  muted_until        timestamptz,          -- null = not muted
  notes              text,                 -- private per-user notes on this entity
  unique (user_id, entity_nzbn)
);

-- Default recipients (global per user)
user_recipient_default (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth_user(id),
  email              text not null,
  label              text,                 -- "Primary · me", "Accounts payable", etc.
  is_primary         boolean default false,
  verified           boolean default false,
  severities         text[] not null,      -- {'red','amber','green'} — array of severities this recipient should get
  cadence            text not null,        -- 'realtime' | 'daily_09' | 'weekly_mon_08'
  created_at         timestamptz default now(),
  unique (user_id, email)
);

-- Per-entity recipient overrides
-- Stored as delta: what's added and what's removed relative to the user's defaults.
watchlist_item_recipient_override (
  id                 uuid primary key default gen_random_uuid(),
  watchlist_item_id  uuid not null references watchlist_item(id) on delete cascade,
  email              text not null,
  kind               text not null,        -- 'add' | 'remove'
  severities         text[],               -- only meaningful for 'add'; null for 'remove'
  created_at         timestamptz default now(),
  unique (watchlist_item_id, email)
);

-- Trigger toggles (14 categories × N triggers per category)
-- Defaults set at user creation; overrides stored sparsely.
user_trigger_toggle (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth_user(id),
  trigger_code       text not null,        -- '#13', '#14', '#26', etc. from the trigger catalog
  enabled            boolean not null,
  unique (user_id, trigger_code)
);

-- Events that fire alerts
alert_event (
  id                 uuid primary key default gen_random_uuid(),
  entity_nzbn        text not null references entity(nzbn),
  trigger_code       text not null,        -- '#13'
  category           text not null,        -- 'company_insolvency'
  severity           text not null,        -- 'red' | 'amber' | 'green'
  title              text not null,        -- "Liquidator appointed"
  description        text,
  source             text not null,        -- 'Companies Office / NZBN' | 'NZ Gazette' | 'Mihari · baseline snapshot'
  source_ref         text,                 -- e.g. gazette notice ID
  prev_state         jsonb,                -- snapshot of fields before
  next_state         jsonb,                -- snapshot of fields after
  ai_risk_summary    text,                 -- optional LLM-generated short paragraph (deferred feature)
  occurred_at        timestamptz not null,
  created_at         timestamptz default now()
);

-- Per-recipient delivery log (drives read-state on the Alerts feed)
alert_recipient (
  id                 uuid primary key default gen_random_uuid(),
  alert_event_id     uuid not null references alert_event(id) on delete cascade,
  user_id            uuid not null references auth_user(id),
  email              text not null,
  delivered_at       timestamptz,
  read_at            timestamptz,
  unique (alert_event_id, user_id, email)
);

-- Delivery preferences
user_delivery_pref (
  user_id            uuid primary key references auth_user(id),
  digest_mode        text default 'realtime_red_daily_others',   -- 'realtime' | 'daily_09' | 'weekly_mon_08' | 'realtime_red_daily_others'
  quiet_hours_from   text default '20:00',
  quiet_hours_to     text default '07:00',
  timezone           text default 'Pacific/Auckland'
);
```

### The recipient-resolution function

This is the core business logic. When an `alert_event` is created for a watched entity, the system must compute the list of recipients:

```ts
function resolveRecipients(userId: string, watchlistItemId: string, severity: 'red'|'amber'|'green'): Recipient[] {
  const defaults = db.user_recipient_default.findMany({ where: { user_id: userId } });
  const overrides = db.watchlist_item_recipient_override.findMany({ where: { watchlist_item_id: watchlistItemId } });

  const removed = new Set(overrides.filter(o => o.kind === 'remove').map(o => o.email));
  const added = overrides.filter(o => o.kind === 'add');

  const inheritedDefaults = defaults
    .filter(d => !removed.has(d.email))
    .filter(d => d.severities.includes(severity))
    .filter(d => d.is_primary || true);   // primary always included (enforced by UI; also guard here)

  const entityOverrides = added
    .filter(a => a.severities?.includes(severity) ?? true);

  // Dedupe by email; entity override wins (can tighten severities for an inherited address).
  const byEmail = new Map<string, Recipient>();
  for (const d of inheritedDefaults) byEmail.set(d.email, { ...d, source: 'inherited' });
  for (const a of entityOverrides) byEmail.set(a.email, { ...a, source: 'override' });

  // Primary always included regardless of severity/mute, except globally opted out.
  const primary = defaults.find(d => d.is_primary);
  if (primary && !byEmail.has(primary.email)) byEmail.set(primary.email, { ...primary, source: 'primary_forced' });

  return [...byEmail.values()];
}
```

Pair with `user_delivery_pref` to decide whether to send immediately, queue into a digest, or defer past quiet hours.

---

## Ingestion Pipeline

Not shown in the designs but implied:

1. **Nightly sweep** — for every `watchlist_item`, fetch the current NZBN record for `entity_nzbn`, compare to a cached snapshot, and emit `alert_event` rows for every diff that maps to a tracked trigger. NZBN API: `https://api.business.govt.nz/gateway/nzbn/v5/` (requires API key + quota mgmt).
2. **Gazette poll** — hourly RSS pull of `https://gazette.govt.nz/notice/rss`, filter for `company_insolvency` / `gazette_notice` triggers, match notice subject to watched entities by NZBN + name fuzzy-match.
3. **Delivery worker** — every minute: pick up un-delivered `alert_recipient` rows that are past quiet-hours and within cadence window; build email from the template; send via Resend; mark `delivered_at`.
4. **Digest worker** — daily at 09:00 per-user timezone: collate all `daily_09`-cadence recipients' un-delivered alerts into one email per recipient.

---

## Design Tokens (exact values)

### Colours
```css
/* Dark (default) */
--bg: #0b0c0e;        --panel: #111317;     --panel2: #16191e;
--ink: #e8e6df;       --inkDim: #8d8d85;    --inkFaint: #4a4a45;
--rule: #23262c;      --ruleSoft: #1a1d22;
--ai: #8fb5e0;        --aiDeep: #4a77a8;
--vermillion: #e3594a; --amber: #d9a54a;    --green: #7fc28f;

/* Light (cool stone — NOT cream) */
--bg: #eceeef;        --panel: #f4f5f6;     --panel2: #e3e5e7;
--ink: #14161a;       --inkDim: #5e6168;    --inkFaint: #a8abb0;
--rule: #c6c9ce;      --ruleSoft: #d8dbdf;
--ai: #2a4d7a;        --aiDeep: #1a3558;
--vermillion: #b82f21; --amber: #a87623;    --green: #3a6f4a;
```

### Typography
```css
--serif: "Source Serif 4", Georgia, serif;                              /* display + body */
--mincho: "Shippori Mincho", "Noto Serif JP", serif;                    /* kanji only */
--gothic: "Zen Kaku Gothic New", "Helvetica Neue", system-ui, sans-serif; /* UI labels, tabular */
```

Import:
```
https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,400&family=Shippori+Mincho:wght@400;500;600;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap
```

Scale (role · family · size · weight · letter-spacing · line-height):
- Display XL (hero): serif, 96–120px, 300, -0.035em, 1.0
- Display L (section): serif, 56–72px, 300, -0.03em, 1.05
- Display M (card title): serif, 32–42px, 400, -0.02em, 1.1
- H3: serif, 24–28px, 400, -0.015em, 1.2
- Body L: serif, 18–20px, 400, -0.005em, 1.6
- Body: serif, 15–16px, 400, 0, 1.65
- Metric numeral: serif, 44–56px, 300, -0.03em, 1.0
- UI label: gothic, 12–14px, 500, 0.02em, 1.5
- Table data: gothic, 12–13px, 500, 0, 1.5
- Caption: gothic, 11px, 500, 0, 1.5
- Kanji decorative: mincho, 52–260px, 700–800, -0.06em, 0.9
- Kanji inline label: mincho, 13–22px, 500, 0.2–0.3em, 1

Italic is a **signal**, never running body copy. Reserved for: hero emphasis words, romaji glosses beside kanji, Latin abbreviations (*n.*, *v.*, *ii.*).

### Spacing
- Page gutters: 80–96px on wide, 48px on dense terminals / sidebars, 20px on narrow.
- Section vertical rhythm: 120–180px (marketing), 48–72px (product).
- Card padding: 28–48px depending on density.
- Table row padding: 24–30px vertical.

### Borders & radius
- Border: always `1px solid var(--rule)`. For nested dividers inside cards/tables: `1px solid var(--ruleSoft)`.
- **Radius is zero everywhere.** No rounded corners on anything.
- Vermillion left-border (3px) is the one exception, used to mark an override state or severity ingestion banner.

### Shadows
- Forbidden, with one exception: the hanko at hero size carries `inset 0 0 60px rgba(0,0,0,0.25)` and nothing else.

---

## Components

### `<Label>` (the eyebrow replacement)
`[italic roman numeral] [mincho kanji · wide-tracked] ─── [gothic label]`

Every section starts with one. Number across a page with roman numerals: `i. ii. iii. iv. v.`

### `<Hanko>` (brand mark)
Vermillion square + bg-coloured inset border (only at ≥60px) + white-inset 見 kanji in mincho 62% of size.
Sizes: hero 320–340px · CTA footer 110px · nav 34px (no inset border) · favicon 14–20px.

### `<SevKanji>` (severity badge)
Coloured square (vermillion/amber/green) with the severity kanji in mincho, bg-coloured.
- `紅` Red — insolvency, liquidation, disqualification, gazetted distress
- `琥` Amber — director / shareholding / related-entity movement
- `青` Green — routine filings
No left-border accents, no filled rows, no pill badges. The kanji square *is* the badge.

### Button
```
Primary:   bg=ink,  color=bg,   padding 18×32px, gothic 14/500, radius 0
Secondary: bg=transparent, border 1px rule, color=ink, same metrics
Ghost:     text-only in ink, optional "→" arrow suffix
```
Hover: primary → `aiDeep`; secondary → `rule` becomes `ink`.

### Card
1px rule border, no shadow, no radius, `bg` or `panel` fill, 28–48px padding.

### Metric tile (4×N grid)
```
label  (gothic 12/500, inkDim)
value  (serif 56/300, ai)
sub    (serif 14, inkDim)
```
Cells share 1px rule borders, form one table.

### Ledger row
Grid `80px 1fr 140px 140px`. First col: counter kanji mincho 52px vermillion. Second: serif 26 + mincho 13 subtitle. Right: `ai` frequency in gothic 12/500.

### Input
Square, rule border, panel fill, serif 16 inside, placeholder in inkDim. Focus: border → ai.

### Toggle / checkbox
Square 18px box, rule border, **vermillion** fill when on. No rounded switches.

---

## Interactions & Behaviour

- **Theme toggle:** `ink`/`bg` tokens swap; 200ms transition on `background` + `color` at root. Persisted in localStorage.
- **Sidebar nav:** active state = `vermillion` 2px left border + `ink` text color.
- **Sort / filter pills:** gothic 12/500, 2px vermillion border on active, rule border on inactive.
- **Row expand (Watchlist):** Click row body → toggles expanded state for that row only. Chevron rotates 90°. 150ms transition on grid-template-rows.
- **Recipients override editing (Watchlist row):** Click *Edit overrides →* → inline mode flips `editing` state. Adding/removing a chip immediately mutates the `override` object on that item. Enter key submits the input.
- **Recipients override editing (Entity detail):** Full CRUD on rows inline. Severity toggles click-to-flip. Removed defaults render struck through with *Restore* button.
- **Add entity drawer:** 520px right slide-in. NZBN typeahead 200ms debounce. Esc to close. Click-outside to close.
- **Loading:** A single `ai`-coloured 1px bar sweeping horizontally at the top of viewport. No spinners.
- **The hanko never animates.**

---

## Voice & Copy

- Quiet, confident, plainspoken. Never hype.
- Uses: "the watchman", "the watch", "the registers", "a trace", "a signal", "you hear".
- NZ spelling: *organisation, behaviour, colour, recognise, specialise.*
- Numerals in body copy: spelled out up to ten, digits above. Specs and data always digits.
- No exclamation marks. No "unlock", "revolutionise", "AI-powered", "supercharge".
- Occasional single italic clause for emphasis: *That is the whole product.*
- Japanese terms introduced in roman + glossed, then kanji-only: *jo·ha·kyū (序破急) — the classical three-movement pattern.*

---

## Privacy rules (must carry forward)

1. **Never render natural-person names from registry data inline.** Directors and shareholders are shown as counts and movement only. The designs explicitly reflect this — do not add names to rows even if the NZBN API returns them.
2. For director-linked alerts, phrase as *"A director of this entity is also a director of …"* without naming the person. Link out to the Companies Office public record.
3. No user-level social surface (no other users' watchlists, no "trending" etc.).

---

## Files in this bundle

### Design reference files (for visual / copy reference)
- `Mihari Landing.html` — marketing landing
- `Mihari Dashboard.html` — morning check-in dashboard
- `Mihari Watchlist.html` — roster with the recipients-strip pattern
- `Mihari Alerts.html` — full alert feed
- `Mihari Entity.html` — single entity detail with Recipients panel
- `Mihari Preferences.html` — global settings with Default recipients
- `screens/dashboard.jsx`, `screens/watchlist.jsx`, `screens/alerts.jsx`, `screens/entity.jsx`, `screens/preferences.jsx`, `screens/shell.jsx` — JSX source for each screen
- `shared/system.jsx` — colour tokens, `<Label>`, `<Hanko>`, `<SevKanji>`, `useMihariTheme` hook

### Spec files
- `design.md` — the full Mihari design system (authoritative — read first)
- `deferred-features.md` — features surfaced during design but not in v1 scope; useful to avoid implying capabilities that don't exist yet
- `README.md` — this file

### What's *not* in this bundle (but you'll need)
- Auth screens (sign-in, sign-up, verify). Follow the design system; single-column, serif headline, square inputs, hanko at 80px.
- Email templates (HTML for Resend/Postmark). Cool-stone light only. 560px centred. See Preferences → Preview tab for the reference rendering.
- Admin surfaces (billing, plan tier management). Out of scope for v1.

---

## Trigger catalog (the 14 categories)

These are the event types the ingestion pipeline must detect and emit as `alert_event`s. Numbers correspond to the `trigger_code` column.

| Category | Severity | Triggers (examples) |
|---|---|---|
| Entity status change | Red | `#1` Struck off, `#2` Restored, `#3` Removed |
| Company insolvency | Red | `#13` Liquidator appointed, `#14` Receiver appointed, `#15` VA commenced, `#16` Winding up application, `#17` Court liquidation, `#18` Statutory manager, `#19` Deed of company arrangement, `#20` Creditors' compromise |
| Personal insolvency | Red | `#21` Director bankruptcy, `#22` NAP, `#23` Discharge |
| Director change | Amber | `#26` Director ceased, `#27` Director appointed |
| Officer role change | Amber | `#31` Partner added, `#32` Trustee changed |
| Shareholder change | Amber | `#41` Shareholding restructure, `#42` UHC changed, `#43` Beneficial owner listed |
| Name change | Amber | `#30` Entity renamed, `#33` Trading name |
| Address change | Amber | `#5` Registered office, `#12` Service address, `#8` Postal address |
| Gazette notice | Red | `#71` Statutory demand · s289, `#79` Winding up notice, `#80` Creditors' meeting |
| Filing & compliance | Green | `#20` Annual return filed, `#25` Financials filed, `#28` Overdue |
| Contact change | Green | `#50` Phone, `#51` Email, `#52` Website |
| Business profile | Green | `#55` ANZSIC, `#56` Trading area, `#57` GST |
| Disqualified director | Red | `#60` Director appears on disq. list |
| Cross-entity risk | Amber | `#65` Director linked to distress, `#66` Shared address w/ distressed, `#67` Same postcode cluster |

Trigger `#0` is a special *baseline* type emitted when an entity is first added to the watchlist (non-alerting; shown as a baseline row in the entity timeline).

---

## Suggested implementation order

1. **Auth + shell** — sidebar nav, theme toggle, base layout. Wire colour tokens + fonts.
2. **Watchlist (read-only)** — list entities, no add/remove, no recipients strip. Just render the table from seeded data.
3. **NZBN ingestion** — "Add entity" flow. Pull entity record, store baseline snapshot. Nightly sweep job.
4. **Alert events + feed** — emit alerts on diff. Build Alerts screen against real data.
5. **Email delivery** — default recipients only (no overrides). Wire Resend + template.
6. **Preferences → Default recipients tab** — CRUD for `user_recipient_default`.
7. **Preferences → Triggers tab** — 14-category toggle grid.
8. **Preferences → Delivery tab** — cadence, quiet hours, timezone.
9. **Per-entity recipient overrides** — the `watchlist_item_recipient_override` table + the Watchlist row strip + Entity detail panel. Update the resolver function.
10. **Entity detail** — full read-only ledger view with timeline.
11. **Dashboard** — the morning check-in metrics + today's feed.
12. **Landing page + marketing** — last.

---

## Questions for the implementer

These are decisions the design defers to product + engineering:

- Plan tier naming + cap. The design shows "Roster capacity · 50 / plan tier · Ledger" — if Ledger isn't the confirmed tier name, this footer line must be removed before any demo.
- AI risk summary (deferred) — if rolling out, what model, what cost budget per alert, what factuality guarantees.
- Custom tags / lists on entities (deferred) — currently only `all` / `watch_closely` / `muted` buckets. The original design floated `Trade creditors` / `Loan portfolio` as user-defined chips; parked pending multi-tenant tagging.
- CSV export (deferred) — server-side snapshot job.
- Cross-entity graph (for trigger `#65`, `#66`, `#67`) — cheap data model, but needs product sign-off on the privacy shape.

Read `deferred-features.md` for the full list.
