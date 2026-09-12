# Mihari — Design System

**Tagline:** 見張り — the watchman. A quiet watch over your ledger.

The visual language is **Japanese editorial × NZ credit intelligence**: sumi-e restraint, editorial masthead typography, structural kanji, and a single vermillion hanko seal as the brand anchor. No cozy-editorial cream, no Fraunces italic, no `§ I — THE PREMISE` eyebrows. No emoji. No hand-drawn SVG illustrations.

Apply this system across the landing page, dashboard, watchlist, alerts, entity detail, settings, auth, and email templates.

---

## 1. Colour

Two modes. Dark is the default across the product; light is a full parity toggle. Both are cool — **never warm**.

### Dark (default)
| Token | Hex | Use |
|---|---|---|
| `bg` | `#0b0c0e` | Page background (lacquer black) |
| `panel` | `#111317` | Alternating section bg, cards |
| `panel2` | `#16191e` | Nested cards, hover rows |
| `ink` | `#e8e6df` | Primary text |
| `inkDim` | `#8d8d85` | Secondary text, labels |
| `inkFaint` | `#4a4a45` | Tertiary, disabled, dividers in text |
| `rule` | `#23262c` | Hairline borders |
| `ruleSoft` | `#1a1d22` | Inner dividers inside cards/tables |
| `ai` | `#8fb5e0` | Ai-iro (Japan blue) — interactive, links, metrics, cool accent |
| `aiDeep` | `#4a77a8` | Hover / pressed state of ai |
| `vermillion` | `#e3594a` | **Hanko only** — the seal, severity Red, decorative kanji |
| `amber` | `#d9a54a` | Severity Amber |
| `green` | `#7fc28f` | Severity Green / system-ok signal |

### Light (cool stone — **not cream**)
| Token | Hex | Use |
|---|---|---|
| `bg` | `#eceeef` | Page background (cool stone white) |
| `panel` | `#f4f5f6` | Alternating section bg, cards |
| `panel2` | `#e3e5e7` | Nested cards |
| `ink` | `#14161a` | Primary text |
| `inkDim` | `#5e6168` | Secondary text |
| `inkFaint` | `#a8abb0` | Tertiary |
| `rule` | `#c6c9ce` | Hairline borders |
| `ruleSoft` | `#d8dbdf` | Inner dividers |
| `ai` | `#2a4d7a` | Ai-iro, links, metrics |
| `aiDeep` | `#1a3558` | Hover / pressed |
| `vermillion` | `#b82f21` | Hanko seal, severity Red |
| `amber` | `#a87623` | Severity Amber |
| `green` | `#3a6f4a` | Severity Green |

### Usage rules
- **Vermillion is sacred.** Only used for: the hanko logo mark, Red severity, and one or two decorative kanji glyphs per page. Never for generic buttons, never for fills, never as an underline.
- **Ai-iro is the interactive blue.** Links, focus rings, metric numbers, "ok" status indicators, hover accents.
- Primary buttons are `ink` on `bg` (dark text on light bg, or vice-versa) — not vermillion, not blue.
- Secondary buttons are transparent with a `rule` border.
- Pure white backgrounds are banned. Pure black is banned. Always use the stone-white or lacquer-black tokens.
- No gradients. No drop shadows beyond at most `inset 0 0 60px rgba(0,0,0,0.25)` on the hanko seal itself.

---

## 2. Typography

Three families. No more.

```css
--serif:  "Source Serif 4", Georgia, serif;                       /* display + body */
--mincho: "Shippori Mincho", "Noto Serif JP", serif;              /* kanji only */
--gothic: "Zen Kaku Gothic New", "Helvetica Neue", system-ui, sans-serif; /* UI labels, tabular data, small copy */
```

Google Fonts import:
```
https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,400&family=Shippori+Mincho:wght@400;500;600;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap
```

### Type scale
| Role | Family | Size | Weight | Letter-spacing | Line-height |
|---|---|---|---|---|---|
| Display XL (hero) | serif | 96–120px | 300 | -0.035em | 1.0 |
| Display L (section) | serif | 56–72px | 300 | -0.03em | 1.05 |
| Display M (card title) | serif | 32–42px | 400 | -0.02em | 1.1 |
| H3 | serif | 24–28px | 400 | -0.015em | 1.2 |
| Body L | serif | 18–20px | 400 | -0.005em | 1.6 |
| Body | serif | 15–16px | 400 | 0 | 1.65 |
| Metric numeral | serif | 44–56px | 300 | -0.03em | 1.0 |
| UI label | gothic | 12–14px | 500 | 0.02em | 1.5 |
| Table data | gothic | 12–13px | 500 | 0 | 1.5 |
| Caption | gothic | 11px | 500 | 0 | 1.5 |
| Kanji decorative | mincho | 52–260px | 700–800 | -0.06em | 0.9 |
| Kanji inline label | mincho | 13–22px | 500 | 0.2–0.3em | 1 |

### Italic is a signal
Serif italic is reserved for: hero emphasis words, the `em` inside an `h1`/`h2`, romaji beside kanji (e.g. *Jo*, *Ha*, *Kyū*), and the Latin abbreviations (*n.*, *v.*, *ii.*). Never italicise running body copy.

### Forbidden
- Fraunces, Playfair, DM Serif, Instrument Serif.
- IBM Plex (any cut), Inter, Roboto, system-ui as display.
- JetBrains Mono or any monospace for UI labels. *(Monospace may appear only as technical copy inside a code block — e.g. an API response sample — and nowhere else.)*
- All-caps letter-spaced tracking `0.18em+` on tiny mono labels — the "Claude eyebrow" pattern.
- Emoji.

---

## 3. The Label component

This replaces the standard "eyebrow" label. It's how every section title is introduced.

```
[italic roman numeral]  [mincho kanji · wide-tracked]  ─── [gothic label]
      ii.                         仕組み                     How the watch works
```

Reference implementation (React):
```jsx
const Label = ({ num, jp, children, color }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 14,
    fontFamily: "var(--gothic)", fontSize: 12,
    color: color || "var(--inkDim)",
    letterSpacing: "0.02em", fontWeight: 500,
  }}>
    {num && <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 22, color: color || "var(--inkDim)" }}>{num}</span>}
    {jp && <span style={{ fontFamily: "var(--mincho)", fontSize: 14, letterSpacing: "0.25em", fontWeight: 500 }}>{jp}</span>}
    <span style={{ width: 24, height: 1, background: color || "var(--rule)" }} />
    <span>{children}</span>
  </div>
);
```

Use one `<Label>` per section. Number with roman numerals across the page (`i. ii. iii. iv. v.`).

---

## 4. The Hanko — brand mark

A vermillion square with a white-inset 見 kanji. Only shape allowed to "break" the editorial grid.

```jsx
const Hanko = ({ size = 340, bg = "var(--bg)" }) => (
  <div style={{ position: "relative", width: size, height: size }}>
    <div style={{ position: "absolute", inset: 0, background: "var(--vermillion)",
      boxShadow: "inset 0 0 60px rgba(0,0,0,0.25)" }} />
    <div style={{ position: "absolute", inset: "6%",
      border: `3px solid ${bg}`,
      fontFamily: "var(--mincho)", fontWeight: 800, color: bg,
      fontSize: size * 0.58, lineHeight: 1,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>見</div>
  </div>
);
```

**Sizes in use:**
- Hero: 320–340px
- CTA footer: 110px
- Nav mark: 34px (no inset border — solid kanji)
- Favicon / tiny: 14–20px (no inset border)

The inset border is `bg`-coloured (not white) so the seal punches out of whatever surface it sits on.

---

## 5. Kanji system

Kanji are typographic structure, not decoration. Rules:

- **Counter kanji** — use the formal numerals for lists of registers / steps / etc: `一 二 三 四 五`.
- **Section kanji** — each section has one defining kanji shown small in the `<Label>` and, optionally, huge in the layout:
  - `語` word · `仕組み` how it works · `登記所` what is read · `段階` severity · `諸元` specs · `約束` pledge · `信用` credit · `監視` monitor · `警報` alert · `名簿` roster/watchlist
- **Behind-type ghost kanji** — a single massive `mincho` glyph at ~600–720px, opacity 0.14 (dark) or 0.22 (light), centred behind a pledge or hero block. Use at most once per page. Good choices: `守` (guard), `静` (quiet), `知` (know), `見` (see).
- Never hand-draw kanji in SVG. Always live text with `lang="ja"`.

---

## 6. Layout

- **Max width:** 1440px canvas design target. Content sits in an editorial grid with 80–96px horizontal gutters on wide layouts (48px on nav / dense terminals).
- **Vertical rhythm:** 120–180px between sections on marketing; 48–72px on product screens.
- **Grid:** hairline `1px solid rule` borders everywhere — tables, card sections, metric tiles, the three-movement block. No rounded corners anywhere. Radius is `0`.
- **Ma (breathing room):** the hero, pledge, and definition spreads must stay airy. Do not fill whitespace with decorative elements.
- **Alternating surfaces:** long marketing pages alternate `bg` and `panel` between sections to create rhythm without colour.
- **Dividers inside copy:** short 24px `rule` line inside `<Label>`; long 80px `ai`-coloured rule for editorial separators.

### Page top strip
A thin status strip above the nav. Shows environment meta, not live user data. Example:
```
● Aotearoa New Zealand │ Credit watch · 信用監視 │ Open for early access    v0.4 │ Registrars · all ok
```
Uses `gothic` 11px, `inkDim`.

### Nav
Serif wordmark + `見張り` mincho tag underneath. Right-aligned links in `gothic` 14/500. Primary CTA is `ink` on `bg`; theme toggle is bordered; "Sign in" is an unbordered text link.

---

## 7. Severity

Three levels, always in this order: **Red → Amber → Green**. Each has a defining kanji.

| Severity | Kanji | Colour token | Use |
|---|---|---|---|
| Red | 紅 | `vermillion` | Insolvency, liquidation, disqualification, gazetted distress |
| Amber | 琥 | `amber` | Director / shareholding / related-entity movement |
| Green | 青 | `green` | Routine filings |

### Severity treatment (canonical)
- Leading **vermillion/amber/green square** 40–52px with the kanji in `mincho`, `bg`-coloured.
- Label in serif 26px beside.
- Supporting meta in `gothic` 12/500.
- When shown in a row, the kanji square is 24–28px inline.

No left-border accents, no filled rows, no pill badges. The kanji square *is* the badge.

---

## 8. Components

### Button
```
Primary:   bg=ink, color=bg, padding 18×32px, gothic 14/500, no radius
Secondary: transparent, 1px rule border, color=ink, same metrics
Ghost:     just text in ink, optional "→" arrow suffix
```
All buttons square. Hover: primary → `aiDeep`; secondary → `rule` becomes `ink`.

### Card
- 1px `rule` border, no shadow, no radius, `bg` or `panel` fill.
- Padding: 28–48px depending on density.
- Title in serif 34/400, body in serif 16, spec list in gothic 12/500 under a `ruleSoft` divider.

### Metric tile (4×N grid)
```
label  (gothic 12/500, inkDim)
value  (serif 56/300, ai)
sub    (serif 14, inkDim)
```
Grid cells share 1px `rule` borders, form one table. No gaps.

### Table / ledger row
Grid template e.g. `80px 1fr 140px 140px`. First column: counter kanji in `mincho` 52px, `vermillion`. Second: serif 26 + mincho 13 subtitle. Right: `ai` frequency label in `gothic` 12/500. Row padding 24–30px vertical; `rule` top-border, no bottom except last.

### Input
Square, `rule` border, `panel` fill, `serif` 16 inside, placeholder in `inkDim`. Focus: border becomes `ai`.

### Toggle / checkbox
Square 18px box, `rule` border, `vermillion` fill when on. No rounded switches.

### Badge
Gothic 11/500, 2–4px square, `rule` border or `panel` fill. No coloured pill backgrounds except severity.

---

## 9. Motion

- Hover states: 150ms colour transition on `border-color` and `color`. No transforms, no scales.
- Theme toggle: 200ms `background` + `color` transition on root.
- Loading: a single ai-coloured 1px bar sweeping horizontally at the top of the viewport. No spinners.
- The hanko never animates.

---

## 10. Voice

- Quiet, confident, plainspoken. Never hype.
- Uses "the watchman", "the watch", "the registers", "a trace", "a signal", "you hear".
- Numerals in body copy: spelled out up to ten; digits above. Specs and data always digits.
- NZ spelling: *organisation, behaviour, colour, recognise.*
- No exclamation marks. No "unlock", "revolutionise", "AI-powered", "supercharge".
- Occasional single-clause italic line for emphasis: *That is the whole product.*
- Japanese terms are introduced in roman, glossed on first use, then kanji-only: *jo·ha·kyū (序破急) — the classical three-movement pattern.*

---

## 11. Product-screen patterns

When applied to dashboard / alerts / watchlist / entity / settings:

### Shell
- Left sidebar 240px, `panel` fill, `rule` right-border. Serif nav labels 15/400, gothic sub-labels, hanko mark at top.
- Top bar: breadcrumb in serif, right-side status strip condensed.
- Main content in 48–80px gutter.

### Dashboard
- Four-column metric grid at top (Metric tile component).
- Section `<Label>` then body.
- Alert list uses severity kanji squares as row leader.

### Watchlist
- Table row: `counter kanji | entity name serif 22 + nzbn mincho 12 | severity kanji squares summary | last event time ai | …`
- Inline rename, no modal dialogs where a field edit will do.

### Alerts
- Feed grouped by day with serif date headers.
- Each alert: kanji severity square, serif headline, gothic meta line (`source · trigger # · time`), serif body description.
- Detail view: large kanji + italic severity word + source citation block.

### Entity detail
- Editorial masthead: entity name in serif 72/300, NZBN in mincho 14 below, status in ai.
- Timeline of changes reads like a ledger: date | event | severity | source.

### Settings / Auth
- Single-column, serif headings, gothic form labels, square inputs, `ink` primary button.
- No card-of-form-inside-hero. The page is the form.

### Email template
- Cool stone white only (no dark-mode email).
- 560px wide, centred, serif throughout, kanji severity square at top left, serif headline, plain paragraph body, single `ai` "Open in Mihari →" link at the bottom.
- No images beyond the hanko mark.

---

## 12. Forbidden patterns (the "do not" list)

- Cozy-editorial cream / terracotta palette.
- Rounded corners on anything other than the eye-of-a-kanji.
- Tailwind `shadow-*` utilities — any drop shadow beyond the hanko inset.
- Cards with a coloured left border as severity indicator.
- Full-bleed coloured rows to indicate severity.
- Hand-drawn SVG illustrations. Stripes and plain shapes only; use monospace labels inside placeholders where real imagery should sit.
- Emoji anywhere in the product.
- Live user data on the marketing pages. No fake tickers, no fake feeds, no dummy "alerts today: 14" counters that imply other users.
- Ellipses in section headings.
- Any metric rendered larger than the hero — the hero is always the largest type on the page.

---

## 13. Files + naming

- Design files: `Mihari Landing.html`, `Mihari Dashboard.html`, etc.
- Per-screen JSX: `variations/<screen>.jsx`, attached to `window` at the bottom.
- All screens share the same `<Label>`, `<Hanko>`, and colour-token function. Factor these into `shared/system.jsx` when the next screen lands.
