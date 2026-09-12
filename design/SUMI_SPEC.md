# Mitsuketa — Sumi Design Spec (build of record)

Approved direction: **sumi ink on washi**, indigo dye, structural kanji. The pixel-truth reference
is `design/mockups/sumi-direction.html` — open it in a browser; it has a theme toggle and accent
switcher. The intro animation reference is `design/mockups/intro-animation.html` (approved, but
must be re-dyed to the tokens below — its hardcoded navy/vermillion palette is outdated).

Read `.impeccable.md` at repo root for audience/brand context. IA, features, and flows do not change.

## 1. Tokens (single source of truth)

Define in `index.css` (new file, real Vite entry — see §5). All colors OKLCH via `light-dark()`.

```css
:root {
  color-scheme: light dark;

  /* accent — 藍 ai-indigo. Swappable dye: keep these two lines the only place it's defined */
  --acc-l: oklch(0.40 0.095 265);
  --acc-d: oklch(0.72 0.085 260);

  --paper:      light-dark(oklch(0.952 0.007 85), oklch(0.185 0.008 75));
  --paper2:     light-dark(oklch(0.930 0.008 85), oklch(0.225 0.009 75));
  --ink:        light-dark(oklch(0.235 0.014 65), oklch(0.905 0.012 85));
  --ink-mid:    light-dark(oklch(0.44 0.012 65),  oklch(0.68 0.012 85));
  --ink-pale:   light-dark(oklch(0.62 0.010 70),  oklch(0.50 0.010 80));
  --ink-wash:   light-dark(oklch(0.78 0.009 75),  oklch(0.35 0.009 75));
  --rule:       light-dark(oklch(0.855 0.008 80), oklch(0.30 0.010 75));
  --accent:     light-dark(var(--acc-l), var(--acc-d));
  --accent-ink: light-dark(oklch(0.965 0.006 85), oklch(0.185 0.008 75));
  --crit:       light-dark(oklch(0.55 0.17 30),  oklch(0.66 0.17 30));
  --amber:      light-dark(oklch(0.60 0.10 78),  oklch(0.72 0.10 78));
  --green:      light-dark(oklch(0.50 0.08 150), oklch(0.68 0.09 150));
}
:root[data-theme="light"] { color-scheme: light }
:root[data-theme="dark"]  { color-scheme: dark }
```

Expose to Tailwind v4 via `@theme inline` so utilities exist (`bg-paper`, `text-ink-mid`, etc.):

```css
@import "tailwindcss";
@theme inline {
  --color-paper: var(--paper);
  --color-paper2: var(--paper2);
  --color-ink: var(--ink);
  --color-ink-mid: var(--ink-mid);
  --color-ink-pale: var(--ink-pale);
  --color-ink-wash: var(--ink-wash);
  --color-rule: var(--rule);
  --color-accent: var(--accent);
  --color-accent-ink: var(--accent-ink);
  --color-crit: var(--crit);
  --color-amber: var(--amber);
  --color-green: var(--green);
}
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

Existing `dark:` utility classes keep working during migration via the custom variant; replace them
with token classes as you touch each component.

### Washi grain
One fixed, pointer-events-none layer on body::before, the SVG-noise data URI from the mockup,
opacity .35 light / .22 dark (a `--grain-op` var). Never on scrolling containers.

### Hard rules
- Red (`--crit`) means danger ONLY: liquidation, receivership, bankruptcy, disqualification.
  Never on buttons, never as brand.
- `--accent` (indigo) carries: hanko/stamp, inkan rings, active-tab underline, focus rings,
  primary-button hover, links.
- No box-shadows (except the stamp's `inset 0 0 14px oklch(0 0 0/.22)`), no gradients,
  no backdrop-blur anywhere, border-radius 0 (exception: inkan/person nodes are circles/pills).
- No emoji in UI. No gradient text. lucide-react icons stay (already a dep), strokeWidth 1.5.
- All motion: transform/opacity only, honor prefers-reduced-motion, 150ms color transitions.

## 2. Typography

Install `@fontsource/shippori-mincho` (500,700) and `@fontsource/zen-kaku-gothic-new` (400,500,700),
import in index.tsx. Families:

```css
--serif:  "Shippori Mincho", "Yu Mincho", serif;      /* mastheads, wordmark, kanji, case-file entity name */
--gothic: "Zen Kaku Gothic New", "Yu Gothic UI", "Segoe UI", system-ui, sans-serif;  /* all UI + data */
--mono:   "Cascadia Mono", Consolas, ui-monospace, monospace;  /* NZBN/NZCN, font-variant-numeric: tabular-nums */
```

Body 14px gothic. Serif only for: wordmark, person/entity mastheads, case-file h3, big numerals.
Kanji always serif (Shippori). NZBN/NZCN always mono + tabular-nums.

## 3. Component specs (match the mockup, screen by screen)

### App nav (52–54px, border-b rule)
Hanko mark: 30px square, `--accent` bg, `--accent-ink` 見 glyph (serif 700), inset shadow.
Wordmark "Mitsuketa" serif 600 18px + 見つけた 11px letter-spacing .24em ink-mid.
Right: register status (7px green square + "Registers · connected"), About link, theme + settings icon buttons.
Keep the existing settings modal + MBIE disclaimer link functionality.

### Graph nodes (components/CustomNodes.tsx)
- Company = meishi card: sharp corners, `--paper` bg, name gothic 700 12.5px, NZBN mono 10.5px.
- Ink depth tiers (data.depth: 0|1|2+): d0 = 2px solid var(--ink) border; d1 = 1px var(--ink-mid);
  d2 = 1px var(--ink-wash) with name in ink-mid, id in ink-pale.
- Target: d0 + the stamp — 32px `--accent` square, 見 in accent-ink, rotate(-6deg), positioned
  -14px top / -12px right, inset shadow. Replaces the TARGET pill.
- Severity: 19px kanji square replaces pill badges — 紅 on `--crit` (liquidation/receivership/
  bankruptcy), 琥 on `--amber` (removal commenced), plus uppercase 10px label text beside in the
  same color. Historic insolvency: 紅 square + "PREV: {type}".
- Hidden-descendants: ink square badge "+N" bottom-right (bg ink, text paper). Capped: same but --crit bg.
- Person = inkan: pill (border-radius 999px), 1px ink-mid border; leading 30px circle with 1px
  `--accent` ring + inner ring at 35% opacity, 印 glyph serif accent-colored; name gothic 12.5px,
  "INDIVIDUAL" 10px uppercase ink-pale.
- Summary node: 1px dashed rule border, ink-mid text.
- Status text: 10px uppercase; "Registered" in --green (d2 tier: ink-pale).

### Edges (set where edges are created/styled)
Default bezier (no type), stroke var(--ink) via CSS or inline oklch — depth-tiered:
depth1 width 2 opacity .85, depth2+ width 1.3 opacity .45, person edges 1.6/.7.
Sibling edges: ink-wash. Arrowheads ink at .6 opacity. Edge labels 10.5px ink-mid on paper.

### Case-file panel (replaces sidebar content column, ~270px)
Header: "CASE FILE" 10.5px uppercase ink-pale, entity name serif 17px, NZBN + opened time mono 11px.
Stats strip: 3 equal cells sharing 1px rule borders — Entities / Depth / Flags (serif 20px numerals;
Flags numeral in --crit when > 0).
Trail: timestamped log rows (mono time + gothic text) fed by the events the app already logs
(search mapped, node expanded, flags found, snapshot saved). Store as simple state array.
Footer: exports — primary btn (bg ink, text paper, hover bg accent) "Export interactive chart",
secondary bordered "Snapshot · PNG · JSON" (opens the existing options).
Snapshots list moves into the rail's Snapshots view (or a section under trail — keep it accessible).

### Icon rail (64px, left of case file)
Search / Snapshots / Console / (spacer) / Settings. Active item: 2px accent bar on the left edge.
lucide icons 17px.

### Find screen (landing, replaces empty state)
Full-bleed centered: brushed enso ring (SVG circle, stroke ink, opacity .10, draw-in animation once),
serif h2 "Who owns what?", gloss line: 見つけた mitsuketa · "found it" — search the NZ registers and
say it yourself. Big search input (border ink-mid, focus accent) + ink Search button (hover accent),
live suggestions styled as bordered rows (hit highlighted with accent at 12% alpha), Companies/People
mode toggle, Ctrl+K hint. This wires to the EXISTING search logic/state — it's a re-skin of the entry
point, not new search behavior. After a search maps a graph, the normal canvas layout shows.

### Intro animation (components/IntroAnimation.tsx)
Port design/mockups/intro-animation.html into a React component:
- Full-screen fixed overlay; plays once per session (sessionStorage key mitsuketa_intro_seen),
  click-anywhere or Escape skips, prefers-reduced-motion jumps to final state then dismisses.
- RE-DYE: bg = var(--paper) radial to paper2 (NOT the old navy), web lines = ink-wash/ink-mid,
  nodes = ink-pale fills, seal + ripples + MITSUKETA title = var(--accent) (NOT #e04e39),
  tagline ink-mid. Magnifying glass strokes = ink.
- Ends by fading the overlay out to reveal the Find screen. No replay button in-app.

### Loading
Replace spinner overlays with a 2px accent bar sweeping at the top of the canvas area
(one element, transform animation). Keep per-node expanding indicator minimal.

## 4. Person results + KYD (components/PersonSearchResults.tsx, KydVerificationPanel.tsx)
Masthead: name serif 40px, meta line gothic 12.5px ink-mid, KYD button bordered (印 glyph accent).
Register checks as cards: 34px severity kanji square + bold title + body — including an explicit
green 青 "clear" card when no records found.
Company cards: meishi style like graph nodes (name/NZBN/role in accent/status or severity square).
Address comparison: verdict line (green all-match / amber N addresses), bordered address blocks.
Signatures: bordered figures, white bg for the PNG crops, caption row.
Keep ALL existing functionality: sort/filter/pagination, KYD fetching, PDF modal.

## 5. Build plumbing (do FIRST — everything depends on it)
index.html currently loads Tailwind from CDN + an esm.sh importmap + a dead /index.css link.
- Remove the CDN tailwind <script>, the tailwind.config inline script, the importmap, the
  reactflow CDN css link, and the dead /index.css link.
- Add `@tailwindcss/vite` plugin to vite.config.ts (tailwindcss v4 is already a devDep;
  install @tailwindcss/vite). Create real `index.css` with the token sheet (§1) + fonts (§2)
  + grain + base styles; import it and `reactflow/dist/style.css` from index.tsx.
- Theme: keep the existing light/dark toggle state, but apply it as
  document.documentElement.dataset.theme AND keep setting the `dark` class during migration.
- `graph.html` (MCP viewer) and the export bundle keep their own styling for now — out of scope.
- Verify: `npm run build` passes and `npx tsc --noEmit 2>&1 | wc -l` does not exceed the count
  on main before your change (~68 pre-existing errors; add none).

## 6. Non-negotiables
- No feature/IA changes. Every existing handler, modal, console, snapshot flow keeps working.
- WCAG AA contrast in both themes. Visible :focus-visible (2px accent outline) everywhere.
- aria-labels on all icon-only buttons.
- Performance: no new re-render paths in React Flow nodes; CSS-only visual changes to node internals.
- Both themes checked before calling anything done.
