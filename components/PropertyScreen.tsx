import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Lock, Search as SearchIcon } from 'lucide-react';
import {
    fetchTitleReport, login, logout, searchAddress, searchOwner,
    PropertyError,
    type AddressResult, type OwnerResult, type TitleReport, type TitleSummary,
} from '../services/propertyService.js';
import {
    acknowledge, getSession, setReference, signIn, subscribe,
} from '../utils/propertySession.js';
import { analyse, heldFor, visible, type MemorialEvent } from '../utils/memorials.js';

/**
 * 地 — the LINZ Title Register feature. Four faces, in order:
 *
 *   1. locked        sign in with your name + the shared password
 *   2. notice        the privacy/acceptable-use check, every session
 *   3. search        by property address or registered owner
 *   4. report        the memorial history of one title
 *
 * The unlock lives in utils/propertySession.ts, in memory only. Leaving this
 * screen for a company or an individual and coming back keeps you signed in;
 * a reload or a new tab does not. See that file for why.
 *
 * Visual vocabulary is the app's, not this screen's own: the fused search bar
 * and shared-hairline result rows come from FindScreen, the serif masthead from
 * PersonSearchResults, the stats strip from CasePanel, and the kanji square
 * from CustomNodes — reused here as a *category* mark, never a severity one.
 * Red (--crit) stays reserved for danger and appears nowhere on this screen.
 */

const ruleStyle = { border: '1px solid var(--rule)' };

const Field: React.FC<{
    label: string;
    hint?: string;
    children: React.ReactNode;
}> = ({ label, hint, children }) => (
    <label className="block text-left" style={{ marginBottom: 14 }}>
        <span
            className="block text-ink-mid"
            style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}
        >
            {label}
        </span>
        {children}
        {hint && (
            <span className="block text-ink-pale" style={{ fontSize: 11, marginTop: 4 }}>
                {hint}
            </span>
        )}
    </label>
);

const inputClass = 'w-full bg-paper text-ink';
const inputStyle: React.CSSProperties = {
    ...ruleStyle, padding: '9px 11px', fontSize: 13, outline: 'none',
};

/** Uppercase mono eyebrow — the app's section label. */
const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div
        className={`text-ink-pale ${className ?? ''}`}
        style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em' }}
    >
        {children}
    </div>
);

const Button: React.FC<{
    children: React.ReactNode;
    disabled?: boolean;
    busy?: boolean;
    onClick?: () => void;
    type?: 'button' | 'submit';
}> = ({ children, disabled, busy, onClick, type = 'button' }) => (
    <button
        type={type}
        disabled={disabled || busy}
        onClick={onClick}
        className="bg-ink text-paper inline-flex items-center gap-2 transition-colors duration-150 property-btn"
        style={{
            padding: '9px 20px', fontSize: 12.5,
            opacity: disabled || busy ? 0.45 : 1,
            cursor: disabled || busy ? 'not-allowed' : 'pointer',
        }}
    >
        {busy && <Loader2 size={12} className="animate-spin" />}
        {children}
    </button>
);

const ErrorNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p
        className="text-left"
        style={{ ...ruleStyle, borderLeft: '2px solid var(--accent)', padding: '9px 12px', fontSize: 12, marginTop: 14 }}
    >
        {children}
    </p>
);

/** The 地 mark, at whatever size the face needs. */
const LandMark: React.FC<{ size: number }> = ({ size }) => (
    <span
        aria-hidden="true"
        className="inline-grid place-items-center flex-shrink-0"
        style={{
            width: size, height: size,
            background: 'var(--accent)', color: 'var(--accent-ink)',
            fontFamily: 'var(--serif)', fontSize: Math.round(size * 0.56), lineHeight: 1,
            boxShadow: 'inset 0 0 14px oklch(0 0 0/.22)',
        }}
    >
        地
    </span>
);

/**
 * Hover, focus and layout rules that inline styles cannot express. Mounted once
 * by the shell, so every face below can use these class names.
 */
const PropertyStyles: React.FC = () => (
    <style>{`
.property-btn:hover:not(:disabled) { background: var(--accent); color: var(--accent-ink); }
.property-row:hover, .property-row:focus-visible {
  background: oklch(from var(--accent) l c h / .10);
}
.property-row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.property-quiet:hover, .property-quiet:focus-visible { color: var(--ink); }
.property-bigsearch:focus-within { border-color: var(--accent); }
.property-ref:focus { outline: none; border-bottom-color: var(--accent); }


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

@media (prefers-reduced-motion: no-preference) {
    .property-loadbar {
        animation: property-loadbar-sweep 1.1s cubic-bezier(.4,0,.2,1) infinite;
    }
    @keyframes property-loadbar-sweep {
        0%   { transform: translateX(-100%); }
        100% { transform: translateX(350%); }
    }
}
@media (prefers-reduced-motion: reduce) {
    .property-loadbar { transform: none; }
}

/* Narrow: the gutter collapses and the date leads the row. */
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
}
            `}</style>
);

// ── 1. Sign in ───────────────────────────────────────────────────────────────

const SignIn: React.FC = () => {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const firstField = useRef<HTMLInputElement>(null);

    useEffect(() => { firstField.current?.focus(); }, []);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !password || busy) return;
        setBusy(true);
        setError(null);
        try {
            signIn(await login(name.trim(), password));
        } catch (err) {
            setError(err instanceof PropertyError ? err.message : 'Sign-in failed.');
            setPassword('');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} style={{ maxWidth: 380, margin: '0 auto' }}>
            <div className="flex flex-col items-center" style={{ marginBottom: 26 }}>
                <LandMark size={44} />
                <h3
                    style={{ fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 600, margin: '14px 0 0' }}
                >
                    Property titles
                </h3>
                <p className="text-ink-mid text-center" style={{ fontSize: 12.5, marginTop: 5 }}>
                    LINZ Title Register. Restricted to named team members.
                </p>
            </div>

            <Field label="Your name" hint="Recorded against every search you run.">
                <input
                    ref={firstField}
                    className={inputClass}
                    style={inputStyle}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                    placeholder="Josh Wong"
                />
            </Field>
            <Field label="Password">
                <input
                    className={inputClass}
                    style={inputStyle}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                />
            </Field>

            <div className="flex items-center gap-3" style={{ marginTop: 18 }}>
                <Button type="submit" busy={busy} disabled={!name.trim() || !password}>
                    <Lock size={12} strokeWidth={1.75} /> Unlock
                </Button>
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
        </form>
    );
};

// ── 2. Privacy notice ────────────────────────────────────────────────────────

const Notice: React.FC<{ searcher: string }> = ({ searcher }) => {
    const [agreed, setAgreed] = useState(false);

    return (
        <div style={{ maxWidth: 560, margin: '0 auto' }} className="text-left">
            <div className="flex flex-col items-center" style={{ marginBottom: 22 }}>
                <LandMark size={30} />
                <h3
                    style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, margin: '12px 0 0' }}
                >
                    Before you search
                </h3>
                <p className="text-ink-mid" style={{ fontSize: 12, marginTop: 4 }}>
                    Signed in as {searcher}
                </p>
            </div>

            <ul
                className="text-ink-mid"
                style={{ ...ruleStyle, listStyle: 'none', padding: '18px 20px', margin: 0, fontSize: 12.5, lineHeight: 1.65 }}
            >
                {[
                    <>This service returns <strong className="text-ink">personal information</strong> — the
                        names of registered owners, mortgagees and caveators — supplied under the
                        LINZ Licence for Personal Data.</>,
                    <>You may use it only for a <strong className="text-ink">lawful purpose connected with
                        the property itself</strong>, such as conveyancing, lending, valuation or due
                        diligence.</>,
                    <>You must <strong className="text-ink">not</strong> use it to locate, profile, contact
                        or harass an individual, to build a marketing list, or for any form of
                        unsolicited approach.</>,
                    <>You must <strong className="text-ink">not</strong> republish it or pass it to anyone
                        who has not accepted equivalent terms, and must handle it in line with the
                        <strong className="text-ink"> Privacy Act 2020</strong>.</>,
                    <>The data is a <strong className="text-ink">reference copy, not a title search</strong>.
                        It may lag the register and is not legal advice. Obtain a formal search from
                        LINZ before relying on it.</>,
                    <><strong className="text-ink">Every search you run is logged</strong> — your name, the
                        time, what you typed, and the reference you give it. The log is visible to
                        the administrator.</>,
                ].map((item, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 9 }}>
                        <span className="text-accent" style={{ fontFamily: 'var(--serif)', flexShrink: 0 }}>—</span>
                        <span>{item}</span>
                    </li>
                ))}
            </ul>

            <label
                className="flex items-start gap-3"
                style={{ marginTop: 18, fontSize: 12.5, cursor: 'pointer' }}
            >
                <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    style={{ marginTop: 2, width: 15, height: 15, accentColor: 'var(--accent)', flexShrink: 0 }}
                />
                <span>
                    I have read the above and confirm my searches will be for a lawful
                    property-related purpose, consistent with the Privacy Act 2020 and the LINZ
                    Licence for Personal Data.
                </span>
            </label>

            <div style={{ marginTop: 18 }}>
                <Button disabled={!agreed} onClick={acknowledge}>Agree and continue</Button>
            </div>
        </div>
    );
};

// ── 4. Report ────────────────────────────────────────────────────────────────

/**
 * The category mark for one memorial: a serif kanji square, the same device the
 * graph nodes use for status. Colour encodes *what kind of interest* and
 * whether it is still live — never severity, so --crit is not in this table.
 */
const markFor = (e: MemorialEvent): { glyph: string; bg: string } => {
    if (e.burden) {
        if (e.kind.includes('Easement') || e.kind.includes('Right of Way')) {
            return { glyph: '役', bg: 'var(--ink-wash)' };   // 地役権 — easement
        }
        if (e.kind.includes('Covenant') || e.kind.includes('Consent Notice')) {
            return { glyph: '約', bg: 'var(--ink-wash)' };   // 約款 — covenant
        }
        return { glyph: '他', bg: 'var(--ink-wash)' };       // 他 — other
    }
    switch (e.category) {
        case 'mortgage':
            return { glyph: '抵', bg: e.current ? 'var(--accent)' : 'var(--ink-wash)' };
        case 'discharge':
            return { glyph: '済', bg: 'var(--green)' };      // 済 — settled, done
        case 'transfer':
            return { glyph: '譲', bg: 'var(--ink)' };        // 譲渡 — conveyance
        case 'caveat':
            return { glyph: '警', bg: e.current ? 'var(--amber)' : 'var(--ink-wash)' };
        case 'lease':
            return { glyph: '借', bg: e.current ? 'var(--accent)' : 'var(--ink-wash)' };
        default:
            return { glyph: '他', bg: 'var(--ink-wash)' };
    }
};

/** How the closing instrument finished this interest, in past tense. */
const closedVerb = (e: MemorialEvent): string => {
    const label = e.closed_by?.label ?? '';
    if (label.includes('Withdrawal')) return 'Withdrawn';
    if (label.includes('Surrender')) return 'Surrendered';
    return 'Discharged';
};

/**
 * Glyph colour has to flip with the theme on the ink grounds: --ink and
 * --ink-wash are dark in light mode and light in dark mode, so a fixed
 * --accent-ink glyph goes dark-on-dark the moment the theme flips. The status
 * grounds (accent/green/amber) hold their polarity in both themes.
 */
const glyphOn = (bg: string): string => {
    if (bg === 'var(--ink)') return 'var(--paper)';
    if (bg === 'var(--ink-wash)') return 'var(--ink)';
    return 'var(--accent-ink)';
};

const KanjiSquare: React.FC<{ event: MemorialEvent; size: number }> = ({ event, size }) => {
    const { glyph, bg } = markFor(event);
    return (
        <span
            aria-hidden="true"
            className="inline-grid place-items-center flex-shrink-0"
            style={{
                width: size, height: size, background: bg,
                color: glyphOn(bg),
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

const Stat: React.FC<{ value: React.ReactNode; label: string; accent?: boolean }> = ({ value, label, accent }) => (
    <div style={{ padding: '10px 13px', borderLeft: '1px solid var(--rule)' }}>
        <b
            className="block"
            style={{
                fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 600, lineHeight: 1.2,
                color: accent ? 'var(--accent)' : 'var(--ink)',
            }}
        >
            {value}
        </b>
        <Eyebrow>{label}</Eyebrow>
    </div>
);

/**
 * One event in the chronology. Live interests carry full ink and an accent
 * badge; closed ones drop to ink-mid with the duration they ran for, so the
 * eye lands on what is still on the title.
 */
const EventRow: React.FC<{ event: MemorialEvent }> = ({ event }) => {
    const [open, setOpen] = useState(false);
    const when = event.date
        ? (event.undated
            ? `${event.date.getUTCFullYear()}?`
            : event.date.toISOString().slice(0, 10))
        : '—';
    const closed = !!event.closed_by;

    return (
        <article className="property-event" style={{ borderTop: '1px solid var(--rule)', padding: '13px 0' }}>
            <span
                className="property-event-when text-ink-pale"
                style={{ fontFamily: 'var(--mono)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
            >
                {when}
            </span>
            <span className="property-event-pip">
                <KanjiSquare event={event} size={17} />
            </span>

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
                {event.batch_size && event.batch_size > 1 && (
                    <Badge>{`Batch of ${event.batch_size}`}</Badge>
                )}
            </h5>

            <p className="text-ink-mid" style={{ fontSize: 12, margin: '4px 0 0', maxWidth: '66ch' }}>
                {event.commentary}
            </p>

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

/** A standing burden — sits on the land rather than happening at a moment. */
const BurdenRow: React.FC<{ event: MemorialEvent }> = ({ event }) => (
    <div
        className="flex items-center gap-3.5 text-left"
        style={{ borderTop: '1px solid var(--rule)', padding: '10px 13px' }}
    >
        <KanjiSquare event={event} size={19} />
        <span style={{ flex: 1, minWidth: 0 }}>
            <span className="block" style={{ fontSize: 12.5 }}>{event.headline}</span>
            {event.instrument && (
                <span
                    className="block text-ink-pale"
                    style={{ fontFamily: 'var(--mono)', fontSize: 11, marginTop: 1 }}
                >
                    {event.instrument}
                </span>
            )}
        </span>
        <span
            className="text-ink-pale flex-shrink-0"
            style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}
        >
            {event.date ? event.date.getUTCFullYear() : '—'}
        </span>
    </div>
);

const Report: React.FC<{ report: TitleReport; onBack: () => void }> = ({ report, onBack }) => {
    const events = React.useMemo(() => visible(analyse(report.memorials)), [report]);
    // Standing burdens leave the chronology: they'd otherwise pad a timeline
    // they don't belong on. memorials.ts already flags them.
    const burdens = events.filter(e => e.burden);
    // Newest first — the masthead and stats answer "what is this title now",
    // and the chronology descends from there into history.
    const chronology = events.filter(e => !e.burden).slice().reverse();
    const liveCount = events.filter(e => e.current && !e.burden).length;
    const title = report.title ?? {};

    return (
        <div className="text-left">
            <button
                onClick={onBack}
                className="property-quiet text-ink-pale inline-flex items-center gap-1.5 transition-colors duration-150"
                style={{ fontSize: 12, marginBottom: 16 }}
            >
                <ArrowLeft size={12} strokeWidth={1.75} /> Back to results
            </button>

            {/* Masthead — a title number is this screen's proper noun. */}
            <div style={{ borderBottom: '1px solid var(--rule)', paddingBottom: 15, marginBottom: 16 }}>
                <div className="flex items-start gap-3.5 flex-wrap">
                    <span style={{ marginTop: 5 }}><LandMark size={34} /></span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h3
                            style={{
                                fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 600,
                                margin: 0, lineHeight: 1.1, letterSpacing: '.01em',
                                fontVariantNumeric: 'tabular-nums',
                            }}
                        >
                            {title.title_no ?? '—'}
                        </h3>
                        <p className="text-ink-mid" style={{ fontSize: 12.5, margin: '5px 0 0' }}>
                            {[title.type, title.status, title.land_district].filter(Boolean).join(' · ')}
                        </p>
                        {report.address && (
                            <p className="text-ink" style={{ fontSize: 13, margin: '6px 0 0' }}>
                                {report.address}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats strip — the answer to "what am I looking at" before scrolling. */}
            <div
                className="grid"
                style={{ ...ruleStyle, gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}
            >
                <div style={{ padding: '10px 13px' }}>
                    <b className="block" style={{ fontFamily: 'var(--serif)', fontSize: 21, fontWeight: 600, lineHeight: 1.2 }}>
                        {events.length}
                    </b>
                    <Eyebrow>Memorials</Eyebrow>
                </div>
                <Stat value={liveCount} label="Live interests" accent={liveCount > 0} />
                <Stat value={report.owners.length} label="Registered owners" />
            </div>

            {/* Owners as inkan pills — the same object the graph draws for a person. */}
            {report.owners.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <Eyebrow className="mb-2">Registered owners</Eyebrow>
                    <div className="flex flex-wrap" style={{ gap: 7 }}>
                        {report.owners.map((o, i) => (
                            <span
                                key={i}
                                className="inline-flex items-center"
                                style={{
                                    gap: 9, border: '1px solid var(--ink-mid)', borderRadius: 999,
                                    padding: '3px 14px 3px 3px', fontSize: 12.5,
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    className="inline-grid place-items-center flex-shrink-0"
                                    style={{
                                        width: 26, height: 26, borderRadius: 999,
                                        border: '1px solid var(--accent)',
                                        fontFamily: 'var(--serif)', fontSize: 12, color: 'var(--accent)',
                                    }}
                                >
                                    印
                                </span>
                                {o.corporate_name
                                    || [o.prime_other_names, o.prime_surname].filter(Boolean).join(' ')
                                    || 'Unnamed owner'}
                                {o.estate_share && (
                                    <span
                                        className="text-ink-pale"
                                        style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}
                                    >
                                        {o.estate_share}
                                    </span>
                                )}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Chronology — dates in a mono gutter against a vertical rule. */}
            <Eyebrow className="mb-2">
                Chronology — {chronology.length} memorial{chronology.length === 1 ? '' : 's'}, {liveCount} live
            </Eyebrow>
            <div className="property-timeline">
                {chronology.map(e => <EventRow key={e.id} event={e} />)}
            </div>

            {burdens.length > 0 && (
                <div style={{ marginTop: 26, borderTop: '1px solid var(--rule)', paddingTop: 18 }}>
                    <Eyebrow className="mb-2.5">Standing burdens — {burdens.length}</Eyebrow>
                    <div style={ruleStyle}>
                        {burdens.map(e => <BurdenRow key={e.id} event={e} />)}
                    </div>
                </div>
            )}

            <p
                className="text-ink-pale"
                style={{ fontSize: 11, lineHeight: 1.6, marginTop: 22, borderTop: '1px solid var(--rule)', paddingTop: 13 }}
            >
                Reference copy of the LINZ Title Register, not a title search. It may lag the
                register and is not legal advice. Commentary is generated from the register's own
                fields — no interpretation has been added.
            </p>
        </div>
    );
};

// ── 3. Search ────────────────────────────────────────────────────────────────

type Mode = 'address' | 'owner';

const ResultRow: React.FC<{
    left: string;
    main: string;
    meta?: string;
    onClick: () => void;
}> = ({ left, main, meta, onClick }) => (
    <button
        onClick={onClick}
        className="property-row w-full flex items-center gap-3.5 text-left transition-colors duration-150"
        style={{ borderTop: '1px solid var(--rule)', padding: '11px 13px' }}
    >
        <span
            className="text-accent flex-shrink-0"
            style={{ fontFamily: 'var(--mono)', fontSize: 12, fontVariantNumeric: 'tabular-nums', minWidth: 96 }}
        >
            {left}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
            <span className="block" style={{ fontSize: 13 }}>{main}</span>
            {meta && (
                <span className="block text-ink-pale" style={{ fontFamily: 'var(--mono)', fontSize: 10.5, marginTop: 2 }}>
                    {meta}
                </span>
            )}
        </span>
        <ArrowRight size={13} strokeWidth={1.5} className="text-ink-pale flex-shrink-0" />
    </button>
);

/** Shared-hairline list: one bordered block, rows divided by a single rule. */
const ResultList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={ruleStyle}>{children}</div>
);

const Search: React.FC<{ searcher: string; reference: string }> = ({ searcher, reference }) => {
    const [mode, setMode] = useState<Mode>('address');
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [address, setAddress] = useState<AddressResult | null>(null);
    const [owner, setOwner] = useState<OwnerResult | null>(null);
    const [report, setReport] = useState<TitleReport | null>(null);

    const clear = () => { setAddress(null); setOwner(null); setReport(null); setError(null); };

    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
        } catch (err) {
            // A 401 already re-locked the screen via propertyService.
            setError(err instanceof PropertyError ? err.message : 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || !reference.trim() || busy) return;
        clear();
        run(async () => {
            if (mode === 'address') setAddress(await searchAddress(query.trim(), reference.trim()));
            else setOwner(await searchOwner(query.trim(), reference.trim()));
        });
    };

    const pickCandidate = (addressId: number) => run(async () => {
        setAddress(await searchAddress(query.trim(), reference.trim(), addressId));
    });

    const openTitle = (titleNo: string) => run(async () => {
        setReport(await fetchTitleReport(titleNo, reference.trim()));
    });

    if (report) return <Report report={report} onBack={() => setReport(null)} />;

    const titleRow = (t: TitleSummary) => (
        <ResultRow
            key={t.title_no}
            left={t.title_no}
            main={t.owners || [t.type, t.status].filter(Boolean).join(' · ')}
            meta={t.owners ? [t.type, t.status, t.land_district].filter(Boolean).join(' · ') : (t.land_district ?? undefined)}
            onClick={() => openTitle(t.title_no)}
        />
    );

    // 住 address / 名 name — the find screen's mode-line idiom, one level down.
    const modes: { id: Mode; kanji: string; label: string }[] = [
        { id: 'address', kanji: '住', label: 'Address' },
        { id: 'owner', kanji: '名', label: 'Owner' },
    ];

    return (
        <div className="text-left">
            <div
                className="flex items-baseline justify-between flex-wrap"
                style={{ marginBottom: 16, gap: 12 }}
            >
                <span className="text-ink-mid" style={{ fontSize: 12 }}>
                    Signed in as <span className="text-ink">{searcher}</span>
                </span>
                <button
                    onClick={() => { void logout(); }}
                    className="property-quiet text-ink-pale transition-colors duration-150"
                    style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em' }}
                >
                    Sign out
                </button>
            </div>

            <form onSubmit={submit}>
                {/* Fused search bar — the same frame as FindScreen's .find-bigsearch */}
                <div
                    className="property-bigsearch flex relative overflow-hidden"
                    style={{ border: '1px solid var(--ink-mid)', background: 'var(--paper)' }}
                >
                    {busy && (
                        <span
                            className="property-loadbar absolute top-0 left-0 h-[2px] bg-accent"
                            aria-hidden="true"
                            style={{ width: '40%' }}
                        />
                    )}
                    <input
                        className="flex-1 bg-transparent text-ink"
                        style={{
                            border: 'none', padding: '14px 16px', fontSize: 15,
                            outline: 'none', minWidth: 0,
                        }}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={mode === 'address'
                            ? '810 Great South Road, Penrose, Auckland'
                            : 'Norak Properties Limited'}
                        aria-label={mode === 'address' ? 'Property address' : 'Registered owner'}
                    />
                    <button
                        type="submit"
                        disabled={!query.trim() || !reference.trim() || busy}
                        className="property-btn bg-ink text-paper inline-flex items-center gap-2 transition-colors duration-150 flex-shrink-0"
                        style={{
                            padding: '0 22px', fontSize: 14, letterSpacing: '.04em',
                            opacity: !query.trim() || !reference.trim() || busy ? 0.45 : 1,
                            cursor: !query.trim() || !reference.trim() || busy ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {busy
                            ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                            : <SearchIcon size={15} strokeWidth={1.5} aria-hidden="true" />}
                        Search
                    </button>
                </div>

                {/* Mode line + the file reference as an inline mono chip. It is a
                    short mandatory token, not a paragraph-worthy field. */}
                <div
                    className="flex items-center flex-wrap text-ink-mid"
                    style={{ marginTop: 12, gap: 2, fontSize: 12.5 }}
                >
                    {modes.map((m, i) => (
                        <React.Fragment key={m.id}>
                            {i > 0 && <span className="text-ink-wash">·</span>}
                            <button
                                type="button"
                                onClick={() => { setMode(m.id); clear(); }}
                                aria-current={mode === m.id}
                                className="inline-flex items-baseline gap-1.5 transition-colors duration-150"
                                style={{
                                    borderBottom: `1px solid ${mode === m.id ? 'var(--accent)' : 'var(--rule)'}`,
                                    padding: '2px 1px',
                                    margin: '0 8px',
                                    color: mode === m.id ? 'var(--ink)' : 'var(--ink-mid)',
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{ fontFamily: 'var(--serif)', color: mode === m.id ? 'var(--accent)' : 'var(--ink-pale)' }}
                                >
                                    {m.kanji}
                                </span>
                                {m.label}
                            </button>
                        </React.Fragment>
                    ))}

                    <label
                        className="inline-flex items-baseline text-ink-pale"
                        style={{ marginLeft: 14, gap: 6, fontSize: 11.5 }}
                        title="Required. Recorded with the search so it can be accounted for later."
                    >
                        Ref
                        <input
                            className="property-ref bg-transparent text-ink"
                            style={{
                                width: 118, border: 'none',
                                borderBottom: `1px solid ${reference.trim() ? 'var(--accent)' : 'var(--rule)'}`,
                                fontFamily: 'var(--mono)', fontSize: 11.5, padding: '1px 2px',
                            }}
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            placeholder="MATTER-1234"
                            aria-label="File or matter reference"
                        />
                    </label>
                </div>

                {!reference.trim() && query.trim() && (
                    <p className="text-ink-pale" style={{ fontSize: 11.5, marginTop: 8 }}>
                        Add a file reference to search — it's recorded with the search so it can be
                        accounted for later.
                    </p>
                )}
            </form>

            {error && <ErrorNote>{error}</ErrorNote>}

            {/* Address results */}
            {address?.resolution_status === 'needs_confirmation' && (
                <div style={{ marginTop: 22 }}>
                    <Eyebrow className="mb-2">
                        {address.candidates?.length} addresses matched — choose the one you meant
                    </Eyebrow>
                    <ResultList>
                        {address.candidates?.map(c => (
                            <ResultRow
                                key={c.address_id}
                                left={String(c.address_id)}
                                main={c.full_address}
                                meta={[c.suburb_locality, c.town_city, c.territorial_authority]
                                    .filter(Boolean).join(' · ')}
                                onClick={() => pickCandidate(c.address_id)}
                            />
                        ))}
                    </ResultList>
                </div>
            )}
            {address?.resolution_status === 'ok' && (
                <div style={{ marginTop: 22 }}>
                    <Eyebrow className="mb-2">
                        {address.resolved_address?.full_address} — {address.titles?.length} title
                        {address.titles?.length === 1 ? '' : 's'}
                    </Eyebrow>
                    <ResultList>{address.titles?.map(titleRow)}</ResultList>
                </div>
            )}
            {address && ['not_found', 'no_title', 'no_geometry'].includes(address.resolution_status) && (
                <p className="text-ink-mid" style={{ fontSize: 12.5, marginTop: 22 }}>
                    No title found at that address.
                </p>
            )}

            {/* Owner results */}
            {owner && (
                <div style={{ marginTop: 22 }}>
                    {owner.truncated && (
                        <p
                            style={{ ...ruleStyle, borderLeft: '2px solid var(--accent)', padding: '9px 12px', fontSize: 12, marginBottom: 12 }}
                        >
                            More owners matched than can be listed, and these are <strong>not</strong> the
                            closest matches — LINZ returns them in register order. Add a first name or
                            the full company name to narrow it down.
                        </p>
                    )}
                    {(() => {
                        const seen = new Set<string>();
                        const rows = owner.results.filter(r => {
                            if (!r.title_no || seen.has(r.title_no)) return false;
                            seen.add(r.title_no);
                            return true;
                        });
                        if (rows.length === 0) {
                            return (
                                <p className="text-ink-mid" style={{ fontSize: 12.5 }}>
                                    No owners matched “{owner.query}”.
                                </p>
                            );
                        }
                        return (
                            <>
                                <Eyebrow className="mb-2">
                                    {rows.length} title{rows.length === 1 ? '' : 's'}
                                </Eyebrow>
                                <ResultList>
                                    {rows.map(r => (
                                        <ResultRow
                                            key={r.title_no}
                                            left={r.title_no!}
                                            main={r.corporate_name
                                                || [r.prime_other_names, r.prime_surname].filter(Boolean).join(' ')
                                                || 'Unnamed owner'}
                                            meta={[r.title?.type, r.title?.status,
                                                r.title?.land_district ?? r.land_district]
                                                .filter(Boolean).join(' · ')}
                                            onClick={() => openTitle(r.title_no!)}
                                        />
                                    ))}
                                </ResultList>
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

// ── Shell ────────────────────────────────────────────────────────────────────

export const PropertyScreen: React.FC = () => {
    const session = useSyncExternalStore(subscribe, getSession, () => null);

    const face = !session
        ? <SignIn />
        : !session.acknowledged
            ? <Notice searcher={session.searcher} />
            : <Search searcher={session.searcher} reference={session.reference} />;

    return (
        <>
            {face}
            <PropertyStyles />
        </>
    );
};
