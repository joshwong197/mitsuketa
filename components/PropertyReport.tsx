import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import { PropertyStyles } from './PropertyStyles';
import type { TitleReport } from '../services/propertyService.js';
import { heldFor, type MemorialEvent } from '../utils/memorials.js';
import {
    buildTitleView, closedVerb, formatDate, markFor, matchesFilter,
    yearOf, FILTER_LABELS, type FilterKey, type Tone,
} from '../utils/titleReport.js';

/**
 * 地 — one title's report. Rendered as a tab, not inside the search face, so it
 * behaves like a company chart or a person result: it gets a chip, it survives
 * switching to another mode, and it can be exported.
 *
 * Everything here is derived from register fields by utils/titleReport.ts. No
 * commentary is written by a model and none should be — the disclaimer at the
 * foot promises exactly that, and it is why the output is defensible.
 */

const rule = '1px solid var(--rule)';

const TONE_BG: Record<Tone, string> = {
    accent: 'var(--accent)',
    green: 'var(--green)',
    amber: 'var(--amber)',
    ink: 'var(--ink)',
    wash: 'var(--ink-wash)',
};

/**
 * Glyph colour has to flip with the theme on the ink grounds: --ink and
 * --ink-wash are dark in light mode and light in dark mode, so a fixed
 * --accent-ink glyph goes dark-on-dark the moment the theme flips.
 */
const TONE_FG: Record<Tone, string> = {
    accent: 'var(--accent-ink)',
    green: 'var(--accent-ink)',
    amber: 'var(--accent-ink)',
    ink: 'var(--paper)',
    wash: 'var(--ink)',
};

const Eyebrow: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
    <div
        className="text-ink-pale"
        style={{
            fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
            letterSpacing: '.09em', ...style,
        }}
    >
        {children}
    </div>
);

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

const Badge: React.FC<{ children: React.ReactNode; accent?: boolean }> = ({ children, accent }) => (
    <span
        style={{
            fontFamily: 'var(--mono)', fontSize: 9.5, textTransform: 'uppercase',
            letterSpacing: '.07em', padding: '1px 6px',
            border: `1px solid ${accent ? 'var(--accent)' : 'var(--rule)'}`,
            color: accent ? 'var(--accent)' : 'var(--ink-pale)',
            whiteSpace: 'nowrap',
        }}
    >
        {children}
    </span>
);

/** One dealing on the timeline. */
const EventRow: React.FC<{ event: MemorialEvent; onJump: (id: string) => void }> = ({ event, onJump }) => {
    const [open, setOpen] = useState(false);
    const closed = !!event.closed_by;
    // memorials.ts already records the discharge/withdrawal pairing and the
    // same-batch siblings in `related`, so this is the sample report's
    // "associated events" with no new derivation — and nothing added here, or
    // every paired instrument would be listed twice.
    const links = event.related;

    return (
        <article id={`ev-${event.id}`} className="property-event" style={{ borderTop: rule, padding: '13px 0' }}>
            <span
                className="property-event-when text-ink-pale"
                style={{ fontFamily: 'var(--mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
            >
                {formatDate(event.date, event.undated)}
            </span>
            <span className="property-event-pip"><KanjiSquare event={event} size={17} /></span>

            <h5
                className="flex items-baseline gap-2.5 flex-wrap"
                style={{
                    margin: 0, fontSize: 13.5,
                    fontWeight: closed ? 500 : 600,
                    color: closed ? 'var(--ink-mid)' : 'var(--ink)',
                }}
            >
                {event.headline}
                {event.current && <Badge accent>Live</Badge>}
                {closed && <Badge>{`${closedVerb(event)} · ${heldFor(event)}`}</Badge>}
                {event.batch_size && event.batch_size > 1 && <Badge>{`Batch of ${event.batch_size}`}</Badge>}
            </h5>

            <p className="text-ink-mid" style={{ fontSize: 12, margin: '4px 0 0', maxWidth: '66ch' }}>
                {event.commentary}
            </p>

            {links.length > 0 && (
                <div className="flex flex-wrap items-center" style={{ gap: 6, marginTop: 7 }}>
                    <Eyebrow style={{ fontSize: 9.5 }}>Associated</Eyebrow>
                    {links.map((l, i) => (
                        <button
                            key={`${l.target.id}-${i}`}
                            type="button"
                            onClick={() => onJump(l.target.id)}
                            className="property-link inline-flex items-center transition-colors duration-150"
                            style={{ gap: 6, border: rule, padding: '2px 8px', fontSize: 11 }}
                        >
                            <KanjiSquare event={l.target} size={13} />
                            <span className="text-ink-mid">{l.relation}</span>
                            <span>{l.target.instrument ?? l.target.label}</span>
                        </button>
                    ))}
                </div>
            )}

            <button
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className="property-quiet text-ink-pale transition-colors duration-150"
                style={{
                    marginTop: 6, fontFamily: 'var(--mono)', fontSize: 10,
                    textTransform: 'uppercase', letterSpacing: '.07em',
                }}
            >
                {open ? '− Register text' : '+ Register text'}
            </button>
            {open && (
                <>
                    <p
                        className="text-ink-mid"
                        style={{ fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.6, marginTop: 7, whiteSpace: 'pre-wrap' }}
                    >
                        {event.text || '(no memorial text)'}
                    </p>
                    {event.notations?.map((n, i) => (
                        <p
                            key={i}
                            className="text-ink-pale"
                            style={{ fontFamily: 'var(--mono)', fontSize: 10.5, lineHeight: 1.6, marginTop: 6 }}
                        >
                            {n}
                        </p>
                    ))}
                </>
            )}
        </article>
    );
};

export interface PropertyReportProps {
    report: TitleReport;
    /** Back to the property search. Omitted when there is nowhere to go. */
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

    // Year headings: emitted when the year changes, so they follow the sort.
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
        el.classList.add('property-event-flash');
        setTimeout(() => el.classList.remove('property-event-flash'), 1400);
    };

    const shownBurdens = view.burdens.filter(e => matchesFilter(e, filter));

    return (
        <div className="text-left" style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 60px' }}>
            <PropertyStyles />
            <div className="flex items-center justify-between flex-wrap" style={{ gap: 12, marginBottom: 16 }}>
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

            {/* Masthead */}
            <div style={{ borderBottom: rule, paddingBottom: 15, marginBottom: 18 }}>
                <div className="flex items-start gap-3.5 flex-wrap">
                    <span
                        aria-hidden="true"
                        className="inline-grid place-items-center flex-shrink-0"
                        style={{
                            width: 34, height: 34, marginTop: 5,
                            background: 'var(--accent)', color: 'var(--accent-ink)',
                            fontFamily: 'var(--serif)', fontSize: 19, lineHeight: 1,
                            boxShadow: 'inset 0 0 14px oklch(0 0 0/.22)',
                        }}
                    >
                        地
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h3
                            style={{
                                fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 600,
                                margin: 0, lineHeight: 1.1, letterSpacing: '.01em',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {view.titleNo}
                        </h3>
                        <p className="text-ink-mid" style={{ fontSize: 12.5, margin: '5px 0 0' }}>{view.meta}</p>
                        {view.address && (
                            <p className="text-ink" style={{ fontSize: 13, margin: '6px 0 0' }}>{view.address}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Register detail — everything the title row and estate rows carry. */}
            <div
                className="property-facts"
                style={{ border: rule, marginBottom: 22 }}
            >
                {view.facts.map(f => (
                    <div key={f.label} className="property-fact" style={{ padding: '9px 13px' }}>
                        <Eyebrow style={{ fontSize: 9 }}>{f.label}</Eyebrow>
                        <div
                            style={{
                                fontSize: 12.5, marginTop: 3,
                                fontFamily: f.mono ? 'var(--mono)' : undefined,
                                fontVariantNumeric: f.mono ? 'tabular-nums' : undefined,
                            }}
                        >
                            {f.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Owners */}
            {view.owners.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                    <Eyebrow style={{ marginBottom: 8 }}>
                        Registered owner{view.owners.length === 1 ? '' : 's'}
                    </Eyebrow>
                    <div style={{ border: rule }}>
                        {view.owners.map((o, i) => (
                            <div
                                key={`${o.name}-${i}`}
                                className="flex items-center gap-3.5"
                                style={{ padding: '12px 14px', borderTop: i === 0 ? 'none' : rule }}
                            >
                                <span
                                    aria-hidden="true"
                                    className="inline-grid place-items-center flex-shrink-0"
                                    style={{
                                        width: 34, height: 34, border: '1px solid var(--accent)',
                                        fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)',
                                    }}
                                >
                                    {o.initials}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <span className="block" style={{ fontSize: 14, fontWeight: 600 }}>{o.name}</span>
                                    <span
                                        className="block text-ink-pale"
                                        style={{ fontFamily: 'var(--mono)', fontSize: 10.5, marginTop: 2 }}
                                    >
                                        {[
                                            o.shares.length > 0 ? `Share ${o.shares.join(', ')}` : null,
                                            ...o.estateLines,
                                        ].filter(Boolean).join(' · ') || '—'}
                                    </span>
                                </span>
                                <Badge>{o.corporate ? 'Corporation' : 'Individual'}</Badge>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Currently registered — the answer to "what is on this title now". */}
            <div style={{ marginBottom: 24 }}>
                <Eyebrow style={{ marginBottom: 8 }}>
                    Currently registered — {view.live.length}
                </Eyebrow>
                {view.live.length === 0 ? (
                    <p className="text-ink-mid" style={{ border: rule, padding: '12px 14px', fontSize: 12.5, margin: 0 }}>
                        Nothing is currently registered against this title.
                    </p>
                ) : (
                    <div style={{ border: rule }}>
                        {view.live.map((e, i) => (
                            <div
                                key={e.id}
                                className="flex items-start gap-3.5"
                                style={{ padding: '11px 14px', borderTop: i === 0 ? 'none' : rule }}
                            >
                                <span style={{ marginTop: 1 }}><KanjiSquare event={e} size={19} /></span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <span className="block" style={{ fontSize: 13, fontWeight: 600 }}>{e.headline}</span>
                                    <span
                                        className="block text-ink-pale"
                                        style={{ fontFamily: 'var(--mono)', fontSize: 10.5, marginTop: 2 }}
                                    >
                                        {[e.instrument, formatDate(e.date, e.undated)].filter(Boolean).join(' · ')}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => jump(e.id)}
                                    className="property-quiet text-ink-pale flex-shrink-0 transition-colors duration-150"
                                    style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.06em' }}
                                    aria-label={`Show ${e.headline} in the chronology`}
                                >
                                    ↓
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center" style={{ gap: 6, marginBottom: 12 }}>
                {FILTER_LABELS.filter(f => f.key === 'all' || view.counts[f.key] > 0).map(f => {
                    const on = filter === f.key;
                    return (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => setFilter(f.key)}
                            aria-pressed={on}
                            className="transition-colors duration-150"
                            style={{
                                border: `1px solid ${on ? 'var(--accent)' : 'var(--rule)'}`,
                                color: on ? 'var(--ink)' : 'var(--ink-mid)',
                                background: on ? 'oklch(from var(--accent) l c h / .10)' : 'transparent',
                                padding: '4px 10px', fontSize: 11.5,
                            }}
                        >
                            {f.label}
                            <span className="text-ink-pale" style={{ fontFamily: 'var(--mono)', fontSize: 10, marginLeft: 6 }}>
                                {view.counts[f.key]}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Chronology */}
            <div
                className="flex items-baseline justify-between flex-wrap"
                style={{ gap: 12, marginBottom: 8 }}
            >
                <Eyebrow>
                    Chronology — {rows.length} of {view.chronology.length} dealing{view.chronology.length === 1 ? '' : 's'}
                </Eyebrow>
                <div className="flex items-center text-ink-mid" style={{ gap: 2, fontSize: 11.5 }}>
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
                                    padding: '2px 1px', margin: '0 7px',
                                    color: newestFirst === opt.newest ? 'var(--ink)' : 'var(--ink-mid)',
                                }}
                            >
                                {opt.label}
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {rows.length === 0 ? (
                <p className="text-ink-mid" style={{ borderTop: rule, paddingTop: 13, fontSize: 12.5 }}>
                    No dealings match this filter.
                </p>
            ) : (
                <div className="property-timeline">
                    {withYears.map(({ year, event }) => (
                        <React.Fragment key={event.id}>
                            {year && (
                                <div
                                    className="property-year text-ink-pale"
                                    style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.08em' }}
                                >
                                    {year}
                                </div>
                            )}
                            <EventRow event={event} onJump={jump} />
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* Standing burdens */}
            {shownBurdens.length > 0 && (
                <div style={{ marginTop: 26, borderTop: rule, paddingTop: 18 }}>
                    <Eyebrow style={{ marginBottom: 10 }}>Standing burdens — {shownBurdens.length}</Eyebrow>
                    <div style={{ border: rule }}>
                        {shownBurdens.map((e, i) => (
                            <div
                                key={e.id}
                                id={`ev-${e.id}`}
                                className="flex items-center gap-3.5"
                                style={{ padding: '10px 13px', borderTop: i === 0 ? 'none' : rule }}
                            >
                                <KanjiSquare event={e} size={19} />
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <span className="block" style={{ fontSize: 12.5 }}>{e.headline}</span>
                                    {e.instrument && (
                                        <span
                                            className="block text-ink-pale"
                                            style={{ fontFamily: 'var(--mono)', fontSize: 11, marginTop: 1 }}
                                        >
                                            {e.instrument}
                                        </span>
                                    )}
                                </span>
                                {e.current && <Badge accent>Live</Badge>}
                                <span
                                    className="text-ink-pale flex-shrink-0"
                                    style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}
                                >
                                    {e.date ? e.date.getUTCFullYear() : '—'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <p
                className="text-ink-pale"
                style={{ fontSize: 11, lineHeight: 1.6, marginTop: 24, borderTop: rule, paddingTop: 13 }}
            >
                Reference copy of the LINZ Title Register, not a title search. It may lag the
                register and is not legal advice. Every line above is taken from the register's own
                fields — no interpretation has been added.
            </p>
        </div>
    );
};

export default PropertyReport;
