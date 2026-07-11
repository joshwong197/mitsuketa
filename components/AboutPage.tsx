import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
    onClose: () => void;
}

/* ── shared type styles ─────────────────────────────────────────────── */

const SECTION_HEADER: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.16em',
    fontWeight: 500,
};

const BODY: React.CSSProperties = { fontSize: 13, lineHeight: 1.65 };

const MONO: React.CSSProperties = {
    fontFamily: 'var(--mono)',
    fontVariantNumeric: 'tabular-nums',
};

const SERIF: React.CSSProperties = { fontFamily: 'var(--serif)' };

/** 10px uppercase tracked ink-pale section header above a rule. */
const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <h4 className="uppercase text-ink-pale border-b border-rule pb-1.5 mb-3" style={SECTION_HEADER}>
        {children}
    </h4>
);

/** Keyboard key cap — bordered mono chip. */
const Key = ({ children }: { children: React.ReactNode }) => (
    <kbd
        className="inline-block border border-rule text-ink px-1.5 align-baseline"
        style={{ ...MONO, fontSize: 10.5, paddingTop: 1, paddingBottom: 1 }}
    >
        {children}
    </kbd>
);

/* ── graph-legend swatches (built from the same tokens as the canvas) ── */

/** Miniature company node: sharp-cornered card on paper with a 2px status border. */
const NodeSwatch = ({
    border,
    faded,
    pulsing,
    arrow,
}: {
    border: string;
    faded?: boolean;
    pulsing?: boolean;
    arrow?: boolean;
}) => (
    <span
        className={`relative inline-flex items-center justify-center shrink-0${pulsing ? ' node-crit' : ''}`}
        style={{
            width: 58,
            height: 24,
            background: 'var(--paper)',
            border: `2px solid ${border}`,
        }}
        aria-hidden="true"
    >
        <span
            style={{
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: faded ? 'var(--ink-pale)' : 'var(--ink)',
            }}
        >
            LTD{arrow ? ' →' : ''}
        </span>
    </span>
);

/** Status chip as it appears on nodes: serif kanji square on a status color. */
const KanjiSwatch = ({ kanji, color }: { kanji: string; color: string }) => (
    <span
        className="inline-grid place-items-center shrink-0"
        style={{
            width: 16,
            height: 16,
            ...SERIF,
            fontSize: 11.5,
            lineHeight: 1,
            color: 'var(--accent-ink)',
            background: color,
        }}
        aria-hidden="true"
    >
        {kanji}
    </span>
);

/** Edge sample: a short stroke, solid or dashed. */
const EdgeSwatch = ({ color, dashed, width = 2 }: { color: string; dashed?: boolean; width?: number }) => (
    <svg width="58" height="8" className="shrink-0" aria-hidden="true">
        <line
            x1="1" y1="4" x2="57" y2="4"
            stroke={color}
            strokeWidth={width}
            strokeDasharray={dashed ? '5 4' : undefined}
        />
    </svg>
);

/** One legend row: fixed-width swatch column, then explainer prose. */
const LegendRow = ({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) => (
    <div className="flex items-start gap-4 py-2.5 border-b border-rule last:border-b-0">
        <div className="flex items-center gap-2 shrink-0 pt-0.5" style={{ width: 128 }}>
            {swatch}
        </div>
        <p className="text-ink-mid" style={BODY}>
            {children}
        </p>
    </div>
);

/* ── page ───────────────────────────────────────────────────────────── */

export const AboutPage: React.FC<Props> = ({ onClose }) => {
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50" role="presentation">
            {/* click-away layer — flat wash, no blur */}
            <div className="absolute inset-0 bg-ink/10" onMouseDown={onClose} aria-hidden="true" />

            <div
                role="dialog"
                aria-modal="true"
                aria-label="About Mitsuketa"
                className="relative mx-auto mt-[6vh] flex max-h-[88vh] w-[min(720px,calc(100vw-32px))] flex-col border border-ink bg-paper"
            >
                {/* Masthead */}
                <div className="flex items-center gap-3 border-b border-rule px-5 py-3.5">
                    <div
                        className="grid h-[26px] w-[26px] shrink-0 place-items-center bg-accent text-accent-ink"
                        style={{ ...SERIF, fontWeight: 700, fontSize: 15, boxShadow: 'inset 0 0 14px oklch(0 0 0/.22)' }}
                        aria-hidden="true"
                    >
                        見
                    </div>
                    <div className="flex min-w-0 flex-1 items-baseline gap-2">
                        <h2 className="text-ink" style={{ ...SERIF, fontWeight: 600, fontSize: 17 }}>
                            Mitsuketa
                        </h2>
                        <span className="text-ink-mid" style={{ ...SERIF, fontSize: 11, letterSpacing: '.24em' }}>
                            見つけた
                        </span>
                        <span className="hidden sm:inline text-ink-pale" style={{ fontSize: 11.5 }}>
                            · "found it"
                        </span>
                    </div>
                    <button
                        ref={closeRef}
                        onClick={onClose}
                        className="grid h-7 w-7 shrink-0 place-items-center border border-rule text-ink-mid transition-colors hover:border-ink-mid hover:text-ink"
                        aria-label="Close"
                    >
                        <X size={15} strokeWidth={1.5} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto px-5 py-5">

                    {/* Lead */}
                    <section className="mb-7">
                        <h3 className="mb-2 text-ink" style={{ ...SERIF, fontWeight: 600, fontSize: 19 }}>
                            Who owns what?
                        </h3>
                        <p className="text-ink-mid" style={BODY}>
                            Mitsuketa draws maps of New Zealand company ownership. Search a company or a
                            person and it reads the public registers — shareholdings, directorships, and
                            insolvency records — and lays out what it finds as a chart you can explore:
                            parents above, subsidiaries below, the people in between. Anyone can use it;
                            no account, no training assumed.
                        </p>
                    </section>

                    {/* What it does */}
                    <section className="mb-7">
                        <SectionHeader>What it does</SectionHeader>
                        <div className="grid gap-px border border-rule bg-rule sm:grid-cols-2">
                            {[
                                {
                                    title: 'Company structures',
                                    body: 'Follows shareholding records to map full corporate webs — upstream parents, downstream subsidiaries, and sibling entities under the same owner.',
                                },
                                {
                                    title: 'People',
                                    body: 'Finds every company a named person is recorded against as a director or shareholder, across the whole Companies Register.',
                                },
                                {
                                    title: 'Risk flags',
                                    body: 'Marks companies in liquidation or receivership, struck-off entities, disqualified directors, and historic personal insolvency as it maps.',
                                },
                                {
                                    title: 'Maps and exports',
                                    body: 'Pan, zoom, and expand branches. Save snapshots of an investigation, or export the chart as an interactive page, PNG, or JSON.',
                                },
                            ].map((f) => (
                                <div key={f.title} className="bg-paper p-3.5">
                                    <h5 className="mb-1 text-ink" style={{ fontSize: 12.5, fontWeight: 700 }}>
                                        {f.title}
                                    </h5>
                                    <p className="text-ink-mid" style={BODY}>{f.body}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* How to read the graph */}
                    <section className="mb-7">
                        <SectionHeader>How to read the graph</SectionHeader>
                        <p className="mb-1 text-ink-mid" style={BODY}>
                            The chart uses ink, not decoration: active entities are plain ink, entities in
                            trouble are dyed, and dead entities fade. Everything fades a little the further
                            it sits from the company you searched for.
                        </p>
                        <div>
                            <LegendRow
                                swatch={<><NodeSwatch border="var(--ink)" /><NodeSwatch border="var(--ink-mid)" /></>}
                            >
                                <strong className="font-bold text-ink">Border weight is distance.</strong>{' '}
                                The company you searched for and its direct connections carry a full-ink
                                border. Entities two or more steps away soften to a lighter grey border —
                                they are context, not the subject.
                            </LegendRow>
                            <LegendRow
                                swatch={<><NodeSwatch border="var(--amber)" /><KanjiSwatch kanji="琥" color="var(--amber)" /></>}
                            >
                                <strong className="font-bold text-amber">Amber</strong> means the company is
                                in external administration — liquidation, receivership, or voluntary
                                administration. It carries an amber border and a small 琥 chip naming the
                                process. Still on the register, but under someone else's control.
                            </LegendRow>
                            <LegendRow
                                swatch={<><NodeSwatch border="var(--crit)" pulsing /><KanjiSwatch kanji="紅" color="var(--crit)" /></>}
                            >
                                <strong className="font-bold text-crit">Red</strong> is reserved for the most
                                serious flags: personal insolvency (bankruptcy) or a disqualified director.
                                A red border, a 紅 chip, and a slowly pulsing ring. It is the only red on
                                the canvas — if you see it, look closely.
                            </LegendRow>
                            <LegendRow
                                swatch={<NodeSwatch border="var(--ink-wash)" faded arrow />}
                            >
                                <strong className="font-bold text-ink">Faded means gone.</strong> Struck-off,
                                removed, or dissolved entities keep their place in the map but fade to pale
                                text and a washed-out border. An amalgamated company adds a small → arrow —
                                it was merged into a successor.
                            </LegendRow>
                            <LegendRow
                                swatch={
                                    <span className="uppercase text-green" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em' }}>
                                        Registered
                                    </span>
                                }
                            >
                                A green <strong className="font-bold text-green">"Registered"</strong> status
                                line means the company is active and in good standing. Active companies get
                                no coloured border — plain ink is the healthy state.
                            </LegendRow>
                            <LegendRow
                                swatch={
                                    <span className="flex flex-col gap-1.5">
                                        <EdgeSwatch color="var(--ink)" />
                                        <EdgeSwatch color="var(--ink-wash)" dashed />
                                    </span>
                                }
                            >
                                <strong className="font-bold text-ink">Lines are relationships.</strong> A
                                solid ink line is a current role — a shareholding or directorship held today.
                                A dashed, washed-out line is a ceased role, shown when "Include inactive" is
                                switched on. Lines also fade with distance from the search target.
                            </LegendRow>
                        </div>
                    </section>

                    {/* Compare */}
                    <section className="mb-7">
                        <SectionHeader>Compare — is there a link?</SectionHeader>
                        <p className="mb-2 text-ink-mid" style={BODY}>
                            The third mode on the Find screen, marked{' '}
                            <span className="text-ink" style={{ ...SERIF, fontSize: 14 }}>比</span>, answers one
                            question: are these two connected? Pick two companies or people — A and B — and
                            Mitsuketa traces the shortest chain of ownership and directorship between them,
                            up to 4 steps deep. If nothing turns up, you can retry deeper, to 6 steps.
                            A Stop button cancels the trace at any point.
                        </p>
                        <p className="mb-2 text-ink-mid" style={BODY}>
                            When a link is found, it opens as its own "A ↔ B" tab: the connecting path is
                            drawn in full ink, and the surrounding context is dimmed almost to nothing so the
                            chain reads at a glance. Right-click the canvas and choose{' '}
                            <strong className="font-bold text-ink">Show all</strong> to bring the dimmed
                            context back.
                        </p>
                        <p className="text-ink-pale" style={{ fontSize: 12, lineHeight: 1.6 }}>
                            One caveat: people are matched by name, because the registers do not publish
                            unique identifiers for individuals. Two different people with the same name
                            cannot be told apart.
                        </p>
                    </section>

                    {/* Command palette */}
                    <section className="mb-7">
                        <SectionHeader>Command palette</SectionHeader>
                        <p className="text-ink-mid" style={BODY}>
                            Press <Key>Ctrl</Key> <Key>K</Key> (<Key>⌘</Key> <Key>K</Key> on Mac) anywhere to
                            open the command palette. From it you can jump between open tabs, re-run a recent
                            search, toggle light and dark, or return to the Find screen — all without touching
                            the mouse. Arrow keys move, <Key>Enter</Key> runs, <Key>Esc</Key> closes.
                        </p>
                    </section>

                    {/* Recent searches */}
                    <section className="mb-7">
                        <SectionHeader>Recent searches</SectionHeader>
                        <p className="text-ink-mid" style={BODY}>
                            The Find screen keeps your last 8 searches so you can pick an investigation back
                            up with one click. They are stored only in this browser — nothing is sent to or
                            kept on any server — and a Clear control removes them whenever you like.
                        </p>
                    </section>

                    {/* Data source & terms */}
                    <section className="mb-7">
                        <SectionHeader>Data source &amp; terms of use</SectionHeader>
                        <div className="border border-rule p-3.5">
                            <p className="mb-2 text-ink-mid" style={BODY}>
                                Everything Mitsuketa shows is sourced directly from publicly accessible New
                                Zealand Government registers administered by the Ministry of Business,
                                Innovation and Employment (MBIE):
                            </p>
                            <ul className="mb-2 space-y-0.5 text-ink-mid" style={BODY}>
                                <li className="pl-3.5" style={{ textIndent: -14 }}>· New Zealand Business Number (NZBN) Register</li>
                                <li className="pl-3.5" style={{ textIndent: -14 }}>· Companies Office Register</li>
                                <li className="pl-3.5" style={{ textIndent: -14 }}>· New Zealand Insolvency Register</li>
                                <li className="pl-3.5" style={{ textIndent: -14 }}>· Disqualified Directors Register</li>
                            </ul>
                            <p className="text-ink-mid" style={BODY}>
                                Mitsuketa does not guarantee the accuracy, completeness, or timeliness of this
                                data — MBIE provides it "as is". You must not knowingly or recklessly use, or
                                attempt to use, this information for any unlawful purpose. This tool is
                                provided for informational and analytical purposes only.
                            </p>
                        </div>
                    </section>

                    {/* Data retention */}
                    <section>
                        <SectionHeader>Person-search data retention</SectionHeader>
                        <p className="text-ink-mid" style={BODY}>
                            Snapshots created from person searches are kept in your browser for the current
                            session only: closing or refreshing the page clears them automatically, to comply
                            with retention requirements for Insolvency Register data. Export a snapshot as
                            JSON during your session if you need to keep it.
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="border-t border-rule px-5 py-2.5 text-center text-ink-pale" style={{ fontSize: 11 }}>
                    Mitsuketa — built in New Zealand
                </div>
            </div>
        </div>
    );
};
