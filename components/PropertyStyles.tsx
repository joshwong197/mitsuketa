import React from 'react';

/**
 * Hover, focus and layout rules for the 地 property faces that inline styles
 * cannot express. Its own module because both PropertyScreen (search) and
 * PropertyReport (a tab) need it, and neither owns the other.
 *
 * Mounting it twice is harmless — the rules are idempotent — so each face
 * renders it rather than relying on a parent having done so.
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
.property-link:hover, .property-link:focus-visible {
  border-color: var(--accent);
  background: oklch(from var(--accent) l c h / .08);
}

/* Register detail grid — three across, sharing hairlines. */
.property-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.property-fact { border-left: 1px solid var(--rule); border-top: 1px solid var(--rule); }
.property-fact:nth-child(3n + 1) { border-left: none; }
.property-fact:nth-child(-n + 3) { border-top: none; }

/* Chronology: dates sit in a mono gutter against a vertical rule,
   with the category mark straddling it. */
.property-timeline { position: relative; padding-left: 112px; }
.property-timeline::before {
    content: "";
    position: absolute;
    left: 96px; top: 6px; bottom: 10px;
    width: 1px; background: var(--rule);
}
.property-event { position: relative; }
.property-event:first-child { border-top: none !important; }
.property-event-when {
    position: absolute;
    left: -112px; top: 15px;
    width: 74px; text-align: right;
}
.property-event-pip { position: absolute; left: -25px; top: 14px; }

/* Year heading sits in the date gutter, above the first event of that year. */
.property-year {
    position: relative;
    margin: 20px 0 2px -112px;
    padding-bottom: 3px;
    width: 74px;
    text-align: right;
}
.property-year:first-child { margin-top: 0; }
.property-year + .property-event { border-top: none !important; }

/* Jump target highlight — the 'associated events' links land here. */
.property-event-flash::before {
    content: "";
    position: absolute;
    inset: 4px -10px;
    background: oklch(from var(--accent) l c h / .14);
    pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
    .property-loadbar {
        animation: property-loadbar-sweep 1.1s cubic-bezier(.4,0,.2,1) infinite;
    }
    @keyframes property-loadbar-sweep {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(350%); }
    }
    .property-event-flash::before { animation: property-flash 1.4s ease-out; }
    @keyframes property-flash { from { opacity: 1 } to { opacity: 0 } }
}
@media (prefers-reduced-motion: reduce) {
    .property-loadbar { transform: none; }
}

/* Narrow: the gutter collapses and the date leads the row. */
@media (max-width: 720px) {
    .property-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .property-fact:nth-child(3n + 1) { border-left: 1px solid var(--rule); }
    .property-fact:nth-child(-n + 3) { border-top: 1px solid var(--rule); }
    .property-fact:nth-child(2n + 1) { border-left: none; }
    .property-fact:nth-child(-n + 2) { border-top: none; }
}
@media (max-width: 640px) {
    .property-timeline { padding-left: 0; }
    .property-timeline::before { display: none; }
    .property-event-when {
        position: static;
        display: block;
        width: auto;
        text-align: left;
        margin-bottom: 3px;
    }
    .property-event-pip {
        position: static;
        display: inline-block;
        vertical-align: middle;
        margin-right: 7px;
    }
    .property-year { margin-left: 0; width: auto; text-align: left; }
}
    `}</style>
);

export default PropertyStyles;
