import React, { useEffect, useRef } from 'react';

interface Props {
    onClose: () => void;
}

/* ── shared type styles ─────────────────────────────────────────────── */

const SECTION_HEADER: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.16em',
    fontWeight: 500,
};

const BODY: React.CSSProperties = { fontSize: 16, lineHeight: 1.75 };

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
        document.title = 'About Mitsuketa';
        closeRef.current?.focus({ preventScroll: true });
        return () => { document.title = 'Mitsuketa'; };
    }, []);

    return (
        <main className="about-page bg-paper text-ink" aria-label="About Mitsuketa">
            <div className="about-page-inner">
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
                        className="px-3 py-2 shrink-0 border border-rule text-ink-mid transition-colors hover:border-ink-mid hover:text-ink"
                        aria-label="Back to search"
                    >
                        Back to search →
                    </button>
                </div>

                {/* Content */}
                <div className="about-content px-5 py-5">

                    {/* Lead */}
                    <section className="mb-7">
                        <h3 className="mb-2 text-ink" style={{ ...SERIF, fontWeight: 600, fontSize: 19 }}>
                            About Mitsuketa
                        </h3>
                        <p className="text-ink-mid" style={BODY}>
                            Mitsuketa brings New Zealand register records and their relationships into one
                            workspace. Search companies and people, explore an ownership chart, read the
                            supporting records and save an interactive report. Company and person searches
                            are open to everyone. Property searches require an approved account.
                        </p>
                    </section>

                    {/* What it does */}
                    <section className="mb-7">
                        <SectionHeader>What it does</SectionHeader>
                        <div className="grid gap-px border border-rule bg-rule sm:grid-cols-2">
                            {[
                                {
                                    title: 'Company structures',
                                    body: 'Simple search shows the company and its immediate directors and shareholders. Comprehensive search follows wider connections, with controls for removed companies and former or unverified relationships.',
                                },
                                {
                                    title: 'People',
                                    body: 'Shows company matches returned for a director or shareholder name, with addresses and register checks to help you compare identifying evidence. A matching name alone does not confirm identity.',
                                },
                                {
                                    title: 'Register checks',
                                    body: 'Displays company status, insolvency name matches and director disqualification findings. The chart can appear while checks continue; use the progress indicator to see what is still pending.',
                                },
                                {
                                    title: 'Maps and exports',
                                    body: 'Pan, zoom, and expand branches. Hide directors to read a crowded chart. Keep file notes and snapshots, compare two search subjects, or download an interactive HTML report. Downloads are dated copies and do not update automatically.',
                                },
                                {
                                    title: 'Property titles (restricted)',
                                    body: 'Search the LINZ Record of Title register by address, registered owner, or title reference. Apply for access through the site; property searches unlock only after approval and sign-in.',
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
                            Company borders, status labels and relationship lines help distinguish the search
                            subject, related entities and register findings. Always read the label alongside
                            a colour or symbol.
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
                                A red border, a 紅 chip, and a slowly pulsing ring. Read the finding and compare identifying details. An insolvency name match is not proof that it belongs to the person searched.
                            </LegendRow>
                            <LegendRow
                                swatch={<NodeSwatch border="var(--ink-wash)" faded arrow />}
                            >
                                <strong className="font-bold text-ink">Faded nodes show inactive entities.</strong> Struck-off,
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
                                line means the company is registered. It does not establish financial health
                                or confirm that there are no other alerts. Registered companies have a plain ink border.
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
                                solid ink line represents a shareholding; its label indicates whether the supplied evidence is current, former or unverified.
                                Former roles are labelled and shown when "Include former / unverified relationships" is
                                switched on in a comprehensive chart. Removed companies have a separate toggle.
                                Director lines are dashed even for current roles; check the relationship label.
                                Lines also fade with distance from the search target.
                            </LegendRow>
                        </div>
                    </section>

                    {/* Compare */}
                    <section className="mb-7">
                        <SectionHeader>Compare — is there a link?</SectionHeader>
                        <p className="mb-2 text-ink-mid" style={BODY}>
                            Comparison search, marked{' '}
                            <span className="text-ink" style={{ ...SERIF, fontSize: 14 }}>比</span>, looks for a connection between two subjects. Pick two companies or people — A and B — and
                            Mitsuketa looks for the shortest chain of current registered relationships returned by the search,
                            up to 4 steps deep. If nothing turns up, you can retry deeper, to 6 steps.
                            A Stop button cancels the trace at any point.
                        </p>
                        <p className="mb-2 text-ink-mid" style={BODY}>
                            When a link is found, it opens as its own "A ↔ B" tab: the connecting path is
                            drawn in full ink, and the surrounding context is dimmed almost to nothing so the
                            chain reads at a glance. Right-click the canvas and choose{' '}
                            <strong className="font-bold text-ink">Expand all branches</strong> to bring the dimmed
                            context back.
                        </p>
                        <p className="text-ink-pale" style={{ fontSize: 12, lineHeight: 1.6 }}>
                            Comparison matches people by name and can connect records belonging to
                            different people with the same name. Compare the identifying details before relying on a connection.
                        </p>
                    </section>

                    {/* Property titles — restricted */}
                    <section className="mb-7">
                        <SectionHeader>Property titles — restricted access</SectionHeader>
                        <div
                            className="mb-3 p-3 flex items-start gap-3"
                            style={{ border: '1px solid var(--crit)', background: 'var(--paper)' }}
                        >
                            <span
                                aria-hidden="true"
                                className="shrink-0 grid place-items-center bg-crit"
                                style={{ width: 26, height: 26, fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--paper)' }}
                            >
                                限
                            </span>
                            <p className="text-ink-mid" style={BODY}>
                                <strong className="font-bold text-ink">This function is restricted to named
                                individuals.</strong> <a href="/?access=request" className="text-accent underline">Apply for access</a> and
                                explain your intended use of property data. An application does not grant access.
                                Once approved, follow your invitation and sign in through Clerk.
                            </p>
                        </div>
                        <p className="mb-2 text-ink-mid" style={BODY}>
                            The Property tab, marked{' '}
                            <span className="text-ink" style={{ ...SERIF, fontSize: 14 }}>地</span>, searches the
                            LINZ Record of Title register. It takes three kinds of query:
                        </p>
                        <ul className="mb-2 text-ink-mid" style={{ ...BODY, paddingLeft: 0, listStyle: 'none' }}>
                            {[
                                ['住', 'Address', 'A street address. Where more than one address matches, you are asked which you meant before anything is searched.'],
                                ['名', 'Owner', 'A registered owner — person or company. Results lead with the property address, so you can tell which title is which, with the owner name as filed beneath it.'],
                                ['番', 'Title ref', 'A record of title reference, e.g. NA123A/456. This identifies exactly one record, so it opens the report directly.'],
                            ].map(([kanji, label, body]) => (
                                <li key={label} className="flex items-start gap-2.5 mb-1.5">
                                    <span className="text-accent shrink-0" style={{ ...SERIF, fontSize: 14 }}>{kanji}</span>
                                    <span>
                                        <strong className="font-bold text-ink">{label}</strong> — {body}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className="mb-2 text-ink-mid" style={BODY}>
                            A report covers the owners, the estate, the full memorial history — mortgages,
                            transfers, caveats, leases, easements — and an aerial map of the parcel. It exports
                            as a standalone HTML file whose history can be reordered and filtered by dealing
                            type, and which prints without the background tints.
                        </p>
                        <p className="text-ink-pale" style={{ fontSize: 12, lineHeight: 1.6 }}>
                            Two things to know. The data is a reference copy, not a title search: it can lag
                            the register, and a formal search from LINZ is what you rely on. And every search
                            is logged against the account that ran it, because the owner, mortgagee and
                            caveator names are restricted personal data supplied under the LINZ Licence for
                            Personal Data — which also forbids using it for marketing or any unsolicited
                            approach.
                        </p>
                        <p className="mt-2 text-ink-mid" style={BODY}>
                            Each search requires a matter reference. Council rating values appear where an
                            approved source is available; elsewhere, the report links to the official council
                            search. Rating values are not market valuations.
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
                            up with one click. This recent-search list is stored in your browser, and its
                            Clear control removes the list. Property searches are also logged against your
                            account on the server; clearing the list does not delete those audit records.
                        </p>
                    </section>

                    {/* Data source & terms */}
                    <section className="mb-7">
                        <span id="sources" /><SectionHeader>Data source &amp; terms of use</SectionHeader>
                        <div className="border border-rule p-3.5">
                            <p className="mb-2 text-ink-mid" style={BODY}>
                                Company and person records come from New Zealand Government registers
                                administered by the Ministry of Business,
                                Innovation and Employment (MBIE):
                            </p>
                            <ul className="mb-2 space-y-0.5 text-ink-mid" style={BODY}>
                                <li className="pl-3.5" style={{ textIndent: -14 }}>· New Zealand Business Number (NZBN) Register</li>
                                <li className="pl-3.5" style={{ textIndent: -14 }}>· Companies Office Register</li>
                                <li className="pl-3.5" style={{ textIndent: -14 }}>· New Zealand Insolvency Register</li>
                                <li className="pl-3.5" style={{ textIndent: -14 }}>· Disqualified Directors Register</li>
                            </ul>
                            <p className="mb-2 text-ink-mid" style={BODY}>
                                Property title data comes from LINZ. Council rating values and links identify
                                their council source in the property report. Supported sources include Horizons, Waimakariri, Waikato, Canterbury and Gisborne. A value is shown only when the source and match checks succeed; other searches link to the relevant council. Coverage is not nationwide.
                            </p>
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
                            with retention requirements for Insolvency Register data. Downloaded reports are separate copies. Keep them securely and follow the source terms. Property search audit records are held on the server; clearing your browser does not delete them.
                        </p>
                    </section>
                </div>

                {/* Footer */}
                <div className="border-t border-rule px-5 py-2.5 text-center text-ink-pale" style={{ fontSize: 11 }}>
                    <a href="#/">Search</a> · <a href="/?access=request">Apply for property access</a> · <a href="#/terms">Terms of use</a> · <a href="#/privacy">Privacy notice</a>
                </div>
            </div>
        </main>
    );
};
