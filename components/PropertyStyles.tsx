import React from 'react';

/**
 * Styling for the 地 property faces that inline styles cannot express.
 *
 * The report is typeset as a DOCUMENT, not assembled as a dashboard: one
 * continuous spine rule runs the full height with kanji section markers hanging
 * in the margin beside it, and data sits in ruled ledger rows rather than
 * bordered cards. That is the difference between a register extract and a stack
 * of panels, and it is the whole point of the layout below.
 *
 * Its own module because both PropertyScreen (search) and PropertyReport (a
 * tab) need it, and neither owns the other. Mounting it twice is harmless.
 */
export const PropertyStyles: React.FC = () => (
    <style>{`
.property-btn:hover:not(:disabled) { background: var(--accent); color: var(--accent-ink); }
.property-row:hover, .property-row:focus-visible {
  background: oklch(from var(--accent) l c h / .10);
}
.property-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.property-quiet:hover, .property-quiet:focus-visible { color: var(--ink); }
.property-bigsearch:focus-within { border-color: var(--accent); }
.property-ref:focus { outline: none; border-bottom-color: var(--accent); }

/* ── The document ────────────────────────────────────────────────────────
   MARGIN is the width of the left column that carries section kanji and
   lodgement dates; the spine rule sits at its right edge. Every offset below
   is derived from these two numbers, so the whole page moves together. */
.doc {
  --margin: 84px;
  --gap: 22px;
  max-width: 880px;
  margin: 0 auto;
  padding: 30px 26px 72px;
}
.doc-body { position: relative; padding-left: calc(var(--margin) + var(--gap)); }
.doc-body::before {
  content: "";
  position: absolute;
  left: var(--margin);
  top: 4px;
  bottom: 0;
  width: 1px;
  background: var(--rule);
}

/* Section marker: kanji hanging in the margin, on the spine. */
.sec { position: relative; margin-top: 34px; }
.sec:first-child { margin-top: 0; }
.sec-mark {
  position: absolute;
  left: calc((var(--margin) + var(--gap)) * -1);
  top: 0;
  width: var(--margin);
  text-align: right;
  font-family: var(--serif);
  font-size: 15px;
  line-height: 1.45;
  letter-spacing: .12em;
  color: var(--accent);
}
.sec-head {
  font-family: var(--serif);
  font-size: 16.5px;
  font-weight: 600;
  margin: 0 0 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--ink-wash);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.sec-head .count {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  color: var(--ink-pale);
  letter-spacing: 0;
}

/* ── Ledger: label column, value column, hairline between rows ──────────── */
.ledger { display: grid; grid-template-columns: 152px minmax(0, 1fr); }
.ledger dt, .ledger dd {
  margin: 0;
  padding: 7px 0;
  border-top: 1px solid var(--rule);
  font-size: 13px;
}
.ledger dt {
  color: var(--ink-pale);
  padding-right: 18px;
  text-align: right;
  font-size: 12px;
}
.ledger dt:first-of-type, .ledger dt:first-of-type + dd { border-top: none; }

/* ── Ledger rows for owners, live interests, burdens ────────────────────── */
.entry {
  display: flex;
  align-items: baseline;
  gap: 13px;
  padding: 10px 0;
  border-top: 1px solid var(--rule);
}
.entry:first-child { border-top: none; }
.entry-main { flex: 1; min-width: 0 }
.entry-name { display: block; font-size: 13.5px; font-weight: 600; }
.entry-sub {
  display: block;
  font-family: var(--mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-pale);
  margin-top: 2px;
}

/* ── Hanko: the one stamp on the page, and the one shadow the spec allows ─ */
.hanko {
  display: inline-grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex: none;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--serif);
  font-size: 25px;
  line-height: 1;
  box-shadow: inset 0 0 14px oklch(0 0 0 / .22);
}
.hanko-stamp {
  transform: rotate(-7deg);
  width: 42px;
  height: 42px;
  font-size: 21px;
  letter-spacing: 0;
}

/* ── Filters: a ruled row of words, not a tray of buttons ───────────────── */
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 4px;
  font-size: 12.5px;
  margin-bottom: 4px;
}
.filters button {
  padding: 2px 1px;
  margin: 0 7px;
  border-bottom: 1px solid var(--rule);
  color: var(--ink-mid);
  transition: color .15s, border-color .15s;
}
.filters button:hover { color: var(--ink); }
.filters button[aria-pressed="true"] { border-bottom-color: var(--accent); color: var(--ink); }
.filters .n {
  font-family: var(--mono);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-pale);
  margin-left: 5px;
}
.filters .sep { color: var(--ink-wash); }

/* ── Chronology: dates hang in the same margin as the section kanji ─────── */
.ev { position: relative; border-top: 1px solid var(--rule); padding: 12px 0; }
.ev:first-child { border-top: none; }
.ev-when {
  position: absolute;
  left: calc((var(--margin) + var(--gap)) * -1);
  top: 13px;
  width: var(--margin);
  /* Stops the right-aligned date short of the category mark, which straddles
     the spine and would otherwise sit on top of the last few characters. */
  padding-right: 18px;
  text-align: right;
  font-family: var(--mono);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-pale);
}
/* The category mark straddles the spine — half in the margin, half out. */
.ev-pip { position: absolute; left: calc(var(--gap) * -1 - 8px); top: 12px; }
.ev-head { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; margin: 0; font-size: 13.5px; }
.ev-note { font-size: 12px; color: var(--ink-mid); margin: 4px 0 0; max-width: 64ch; }
.ev-memo {
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--ink-mid);
  border-left: 2px solid var(--rule);
  padding-left: 12px;
  margin: 8px 0 0;
}

/* A year sets a rule across the spine — the register's own chapter break. */
.ev-year {
  position: relative;
  margin: 26px 0 0;
  font-family: var(--serif);
  font-size: 13px;
  letter-spacing: .1em;
  color: var(--ink-mid);
}
.ev-year::before {
  content: "";
  position: absolute;
  left: calc((var(--margin) + var(--gap)) * -1);
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--ink-wash);
}
.ev-year span { position: relative; background: var(--paper); padding-right: 12px; }
.ev-year:first-child { margin-top: 0; }
.ev-year + .ev { border-top: none; }

.property-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid var(--rule);
  padding: 1px 0;
  font-size: 11px;
  transition: border-color .15s, color .15s;
}
.property-link:hover, .property-link:focus-visible { border-bottom-color: var(--accent); color: var(--ink); }

/* Jump target highlight — the associated-instrument links land here. */
.ev-flash::after {
  content: "";
  position: absolute;
  inset: 2px -12px;
  background: oklch(from var(--accent) l c h / .14);
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .property-loadbar { animation: property-loadbar-sweep 1.1s cubic-bezier(.4,0,.2,1) infinite; }
  @keyframes property-loadbar-sweep {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }
  .ev-flash::after { animation: property-flash 1.4s ease-out; }
  @keyframes property-flash { from { opacity: 1 } to { opacity: 0 } }
}
@media (prefers-reduced-motion: reduce) { .property-loadbar { transform: none } }

/* ── Narrow: the margin collapses, the spine goes, dates lead their row ─── */
@media (max-width: 700px) {
  .doc { padding: 24px 18px 60px }
  .doc-body { padding-left: 0 }
  .doc-body::before { display: none }
  .sec-mark { position: static; width: auto; text-align: left; display: block; margin-bottom: 2px }
  .ledger { grid-template-columns: minmax(0, 1fr) }
  .ledger dt { text-align: left; padding: 8px 0 0; border-top: 1px solid var(--rule) }
  .ledger dd { padding: 1px 0 8px; border-top: none }
  .ledger dt:first-of-type + dd { border-top: none }
  .ev-when { position: static; display: block; width: auto; padding-right: 0; text-align: left; margin-bottom: 3px }
  .ev-pip { position: static; display: inline-block; vertical-align: middle; margin-right: 8px }
  .ev-year::before { left: 0 }
}
    `}</style>
);

export default PropertyStyles;
