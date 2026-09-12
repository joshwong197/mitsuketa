import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { PropertyStyles } from './PropertyStyles';
import { TitleMap } from './TitleMap';
import type { TitleReport } from '../services/propertyService.js';
import { heldFor, type MemorialEvent } from '../utils/memorials.js';
import {
    buildTitleView, closedVerb, formatDate, markFor, matchesFilter, yearOf,
    FILTER_LABELS, type FilterKey, type Tone,
} from '../utils/titleReport.js';

/**
 * 地 — one title, typeset as a register extract.
 *
 * The layout is a document, not a dashboard: one spine rule runs the height of
 * the page with kanji section markers hanging in the margin beside it, data
 * sits in ruled ledger rows, and there is exactly one stamp — the status hanko
 * in the masthead. Sections carry the register's own vocabulary (登記 register,
 * 所有 ownership, 現況 current state, 履歴 history, 負担 burdens) because that is
 * what each one actually is.
 *
 * Every line is derived from register fields by utils/titleReport.ts. No
 * commentary is written by a model and none should be — the colophon promises
 * exactly that, and it is why the output is defensible.
 */

const TONE_BG: Record<Tone, string> = {
    accent: 'var(--accent)',
    green: 'var(--green)',
    amber: 'var(--amber)',
    ink: 'var(--ink)',
    wash: 'var(--ink-wash)',
};

/**
 * Glyph colour flips with the theme on the ink grounds: --ink and --ink-wash
 * are dark in light mode and light in dark mode, so a fixed --accent-ink glyph
 * goes dark-on-dark the moment the theme flips.
 */
const TONE_FG: Record<Tone, string> = {
    accent: 'var(--accent-ink)',
    green: 'var(--accent-ink)',
    amber: 'var(--accent-ink)',
    ink: 'var(--paper)',
    wash: 'var(--ink)',
};

const KanjiSquare: React.FC<{ event: MemorialEvent; size: number }> = ({ event, size }) => {
    const { glyph, tone } = markFor(event);
    return (
        <span
            aria-hidden="true"
            className="inline-grid place-items-center flex-shrink-0"
            style={{
                width: size, height: size,
                background: TONE_BG[tone], color: TONE_FG[tone],
                fontFamily: 'var(--serif)', fontSize: Math.round(size * 0.62), lineHeight: 1,
            }}
        >
            {glyph}
        </span>
    );
};

/** Section: kanji marker in the margin, serif heading, optional right-hand aside. */
const Section: React.FC<{
    mark: string;
    title: string;
    aside?: React.ReactNode;
    children: React.ReactNode;
}> = ({ mark, title, aside, children }) => (
    <section className="sec">
        <span className="sec-mark" aria-hidden="true">{mark}</span>
        <h4 className="sec-head">
            <span>{title}</span>
            {aside}
        </h4>
        {children}
    </section>
);

/** State marker on a row — quiet, because the masthead carries the loud one. */
const State: React.FC<{ children: React.ReactNode; live?: boolean }> = ({ children, live }) => (
    <span
        style={{
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.06em',
            textTransform: 'uppercase', whiteSpace: 'nowrap',
            color: live ? 'var(--accent)' : 'var(--ink-pale)',
        }}
    >
        {children}
    </span>
);

const EventRow: React.FC<{ event: MemorialEvent; onJump: (id: string) => void }> = ({ event, onJump }) => {
    const [open, setOpen] = useState(false);
    const closed = !!event.closed_by;
    // memorials.ts already records the discharge/withdrawal pairing and the
    // same-batch siblings in `related` — nothing is added here, or every paired
    // instrument would be listed twice.
    const links = event.related;

    return (
        <article id={`ev-${event.id}`} className="ev">
            <span className="ev-when">{formatDate(event.date, event.undated)}</span>
            <span className="ev-pip"><KanjiSquare event={event} size={16} /></span>

            <h5
                className="ev-head"
                style={{ fontWeight: closed ? 500 : 600, color: closed ? 'var(--ink-mid)' : 'var(--ink)' }}
            >
                <span>{event.headline}</span>
                {event.current && <State live>Live</State>}
                {closed && <State>{`${closedVerb(event)} · ${heldFor(event)}`}</State>}
                {event.instrument && (
                    <span
                        className="text-ink-pale"
                        style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}
                    >
                        {event.instrument}
                    </span>
                )}
            </h5>

            <p className="ev-note">{event.commentary}</p>

            <div className="flex flex-wrap items-center" style={{ gap: '4px 14px', marginTop: 7 }}>
                <button
                    onClick={() => setOpen(!open)}
                    aria-expanded={open}
                    className="property-quiet text-ink-pale transition-colors duration-150"
                    style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em' }}
                >
                    {open ? '− Register text' : '+ Register text'}
                </button>
                {links.map((l, i) => (
                    <button
                        key={`${l.target.id}-${i}`}
                        type="button"
                        onClick={() => onJump(l.target.id)}
                        className="property-link text-ink-mid"
                    >
                        <KanjiSquare event={l.target} size={12} />
                        {l.relation}
                        <span className="text-ink-pale" style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>
                            {l.target.instrument ?? l.target.label}
                        </span>
                    </button>
                ))}
            </div>

            {open && (
                <>
                    <p className="ev-memo">{event.text || '(no memorial text)'}</p>
                    {event.notations?.map((n, i) => (
                        <p key={i} className="ev-memo" style={{ color: 'var(--ink-pale)', fontSize: 10.5 }}>{n}</p>
                    ))}
                </>
            )}
        </article>
    );
};

export interface PropertyReportProps {
    report: TitleReport;
    onBack?: () => void;
    onExport?: () => void;
    isExporting?: boolean;
}

export const PropertyReport: React.FC<PropertyReportProps> = ({
    report, onBack, onExport, isExporting,
}) => {
    const view = useMemo(() => buildTitleView(report), [report]);
    const [filter, setFilter] = useState<FilterKey>('all');
    // Oldest first, the way a title is read. The toggle flips it.
    const [newestFirst, setNewestFirst] = useState(false);

    const rows = useMemo(() => {
        const kept = view.chronology.filter(e => matchesFilter(e, filter));
        return newestFirst ? kept.slice().reverse() : kept;
    }, [view.chronology, filter, newestFirst]);

    // Year rules are emitted when the year changes, so they follow the sort.
    const withYears = useMemo(() => {
        const out: { year: string | null; event: MemorialEvent }[] = [];
        let last: string | null = null;
        for (const event of rows) {
            const y = yearOf(event);
            out.push({ year: y === last ? null : y, event });
            last = y;
        }
        return out;
    }, [rows]);

    const jump = (eventId: string) => {
        const el = document.getElementById(`ev-${eventId}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ev-flash');
        setTimeout(() => el.classList.remove('ev-flash'), 1400);
    };

    const shownBurdens = view.burdens.filter(e => matchesFilter(e, filter));
    const isLive = (view.status ?? '').toLowerCase().startsWith('live');

    return (
        <div className="doc text-left">
            <PropertyStyles />

            <div className="flex items-center justify-between flex-wrap" style={{ gap: 12, marginBottom: 22 }}>
                {onBack ? (
                    <button
                        onClick={onBack}
                        className="property-quiet text-ink-pale inline-flex items-center gap-1.5 transition-colors duration-150"
                        style={{ fontSize: 12 }}
                    >
                        <ArrowLeft size={12} strokeWidth={1.75} /> Back to property search
                    </button>
                ) : <span />}
                {onExport && (
                    <button
                        onClick={onExport}
                        disabled={isExporting}
                        className="property-btn bg-ink text-paper inline-flex items-center gap-2 transition-colors duration-150"
                        style={{ padding: '7px 15px', fontSize: 12, opacity: isExporting ? 0.45 : 1 }}
                    >
                        <Download size={12} strokeWidth={1.75} />
                        {isExporting ? 'Exporting…' : 'Export report · HTML'}
                    </button>
                )}
            </div>

            {report.audit_reference && <p className="text-ink-mid" style={{ fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 14 }}>
                Search reference: {report.audit_reference}
                {report.matter_reference && <> · Matter: {report.matter_reference}</>}
            </p>}

            {/* Masthead — the title number is this document's proper noun, and the
                hanko is the one stamp on the page. */}
            <header
                className="flex items-start justify-between flex-wrap"
                style={{ gap: 20, borderBottom: '2px solid var(--ink)', paddingBottom: 14, marginBottom: 4 }}
            >
                <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                        className="text-ink-pale"
                        style={{ fontSize: 11.5, letterSpacing: '.02em', margin: '0 0 4px' }}
                    >
                        <span style={{ fontFamily: 'var(--serif)', letterSpacing: '.2em', marginRight: 8, color: 'var(--ink-mid)' }}>
                            登記簿
                        </span>
                        Record of title · LINZ Title Register
                    </p>
                    <h3
                        style={{
                            fontFamily: 'var(--serif)', fontSize: 'clamp(30px, 5vw, 42px)', fontWeight: 600,
                            margin: 0, lineHeight: 1.05, letterSpacing: '.01em',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {view.titleNo}
                    </h3>
                    {view.address && (
                        <p style={{ fontSize: 14, margin: '8px 0 0' }}>{view.address}</p>
                    )}
                    <p className="text-ink-mid" style={{ fontSize: 12.5, margin: '3px 0 0' }}>{view.meta}</p>
                </div>
                <div className="flex flex-col items-center" style={{ gap: 7, paddingTop: 4 }}>
                    <span className={`hanko${isLive ? ' hanko-stamp' : ''}`} aria-hidden="true">
                        {isLive ? '現' : '地'}
                    </span>
                    <span
                        style={{
                            fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '.1em',
                            textTransform: 'uppercase',
                            color: isLive ? 'var(--accent)' : 'var(--ink-pale)',
                        }}
                    >
                        {view.status ?? 'Status unknown'}
                    </span>
                </div>
            </header>
            {/* Double rule under the masthead — a printing convention, not a border. */}
            <div style={{ borderTop: '1px solid var(--ink)', marginBottom: 30 }} />

            <div className="doc-body">
                {report.bbox && report.geometry && (
                    <Section mark="地図" title="Parcel">
                        <TitleMap geometry={report.geometry} bbox={report.bbox} />
                    </Section>
                )}

                <Section mark="登記" title="Register detail">
                    <dl className="ledger">
                        {view.facts.map(f => (
                            <React.Fragment key={f.label}>
                                <dt>{f.label}</dt>
                                <dd
                                    style={{
                                        fontFamily: f.mono ? 'var(--mono)' : undefined,
                                        fontVariantNumeric: f.mono ? 'tabular-nums' : undefined,
                                    }}
                                >
                                    {f.value}
                                </dd>
                            </React.Fragment>
                        ))}
                    </dl>
                </Section>

                {view.owners.length > 0 && (
                    <Section
                        mark="所有"
                        title={`Registered owner${view.owners.length === 1 ? '' : 's'}`}
                        aside={<span className="count">{view.owners.length}</span>}
                    >
                        {view.owners.map((o, i) => (
                            <div key={`${o.name}-${i}`} className="entry">
                                <span
                                    aria-hidden="true"
                                    className="inline-grid place-items-center flex-shrink-0"
                                    style={{
                                        width: 30, height: 30, border: '1px solid var(--accent)',
                                        fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)',
                                        alignSelf: 'flex-start',
                                    }}
                                >
                                    {o.initials}
                                </span>
                                <span className="entry-main">
                                    <span className="entry-name">{o.name}</span>
                                    <span className="entry-sub">
                                        {[
                                            o.shares.length > 0 ? `Share ${o.shares.join(', ')}` : null,
                                            ...o.estateLines,
                                        ].filter(Boolean).join(' · ') || '—'}
                                    </span>
                                </span>
                                <State>{o.corporate ? 'Corporation' : 'Individual'}</State>
                            </div>
                        ))}
                    </Section>
                )}

                {/* 現況 — live dealings only. Standing burdens are a permanent
                    characteristic of the land, not something anyone is about to
                    discharge, so they sit in 負担 rather than crowding this out. */}
                <Section
                    mark="現況"
                    title="Currently registered"
                    aside={<span className="count">{view.live.length}</span>}
                >
                    {view.live.length === 0 ? (
                        <p className="text-ink-mid" style={{ fontSize: 13, margin: 0 }}>
                            No live mortgages, caveats or leases on this title.
                        </p>
                    ) : (
                        view.live.map(e => (
                            <div key={e.id} className="entry">
                                <span style={{ alignSelf: 'flex-start', marginTop: 2 }}>
                                    <KanjiSquare event={e} size={19} />
                                </span>
                                <span className="entry-main">
                                    <span className="entry-name">{e.headline}</span>
                                    <span className="entry-sub">
                                        {[e.instrument, formatDate(e.date, e.undated)].filter(Boolean).join(' · ')}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => jump(e.id)}
                                    className="property-quiet text-ink-pale flex-shrink-0 transition-colors duration-150"
                                    style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.06em' }}
                                    aria-label={`Show ${e.headline} in the history`}
                                >
                                    In history ↓
                                </button>
                            </div>
                        ))
                    )}
                </Section>

                <Section
                    mark="履歴"
                    title="History"
                    aside={
                        <span className="flex items-baseline text-ink-mid" style={{ gap: 2, fontSize: 11.5 }}>
                            {([
                                { newest: false, label: 'Oldest first' },
                                { newest: true, label: 'Newest first' },
                            ] as const).map((opt, i) => (
                                <React.Fragment key={opt.label}>
                                    {i > 0 && <span className="text-ink-wash">·</span>}
                                    <button
                                        type="button"
                                        onClick={() => setNewestFirst(opt.newest)}
                                        aria-pressed={newestFirst === opt.newest}
                                        className="transition-colors duration-150"
                                        style={{
                                            borderBottom: `1px solid ${newestFirst === opt.newest ? 'var(--accent)' : 'var(--rule)'}`,
                                            padding: '2px 1px', margin: '0 6px',
                                            color: newestFirst === opt.newest ? 'var(--ink)' : 'var(--ink-mid)',
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                </React.Fragment>
                            ))}
                        </span>
                    }
                >
                    <div className="filters" style={{ marginBottom: 10 }}>
                        {FILTER_LABELS.filter(f => f.key === 'all' || view.counts[f.key] > 0).map((f, i) => (
                            <React.Fragment key={f.key}>
                                {i > 0 && <span className="sep" aria-hidden="true">·</span>}
                                <button
                                    type="button"
                                    onClick={() => setFilter(f.key)}
                                    aria-pressed={filter === f.key}
                                >
                                    {f.label}
                                    <span className="n">{view.counts[f.key]}</span>
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    {rows.length === 0 ? (
                        <p className="text-ink-mid" style={{ fontSize: 13, margin: 0 }}>
                            No dealings match this filter.
                        </p>
                    ) : (
                        withYears.map(({ year, event }) => (
                            <React.Fragment key={event.id}>
                                {year && <div className="ev-year"><span>{year}</span></div>}
                                <EventRow event={event} onJump={jump} />
                            </React.Fragment>
                        ))
                    )}
                </Section>

                {shownBurdens.length > 0 && (
                    <Section
                        mark="負担"
                        title="Standing burdens"
                        aside={<span className="count">{shownBurdens.length}</span>}
                    >
                        <p className="text-ink-pale" style={{ fontSize: 11.5, margin: '-4px 0 8px', maxWidth: '64ch' }}>
                            Easements, covenants and statutory conditions. These sit on the land
                            indefinitely rather than happening at a moment.
                        </p>
                        {shownBurdens.map(e => (
                            <div key={e.id} id={`ev-${e.id}`} className="entry">
                                <span style={{ alignSelf: 'flex-start', marginTop: 2 }}>
                                    <KanjiSquare event={e} size={19} />
                                </span>
                                <span className="entry-main">
                                    <span className="entry-name" style={{ fontWeight: 500 }}>{e.headline}</span>
                                    <span className="entry-sub">
                                        {[e.instrument, e.date ? e.date.getUTCFullYear() : null]
                                            .filter(Boolean).join(' · ')}
                                    </span>
                                </span>
                                {e.current && <State live>Live</State>}
                            </div>
                        ))}
                    </Section>
                )}
            </div>

            {/* Colophon */}
            <p
                className="text-ink-pale"
                style={{
                    fontSize: 11, lineHeight: 1.65, marginTop: 40,
                    borderTop: '1px solid var(--ink-wash)', paddingTop: 14, maxWidth: '78ch',
                }}
            >
                <span style={{ fontFamily: 'var(--serif)', letterSpacing: '.18em', marginRight: 8, color: 'var(--ink-mid)' }}>
                    注記
                </span>
                Reference copy of the LINZ Title Register, not a title search. It may lag the
                register and is not legal advice. Every line above is taken from the register's own
                fields — no interpretation has been added. Obtain a formal search from LINZ before
                relying on it.
            </p>
        </div>
    );
};

export default PropertyReport;
