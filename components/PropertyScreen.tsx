import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Lock } from 'lucide-react';
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
 * 家族 — the LINZ Title Register feature. Four faces, in order:
 *
 *   1. locked        sign in with your name + the shared password
 *   2. notice        the privacy/acceptable-use check, every session
 *   3. search        by property address or registered owner
 *   4. report        the memorial history of one title
 *
 * The unlock lives in utils/propertySession.ts, in memory only. Leaving this
 * screen for a company or an individual and coming back keeps you signed in;
 * a reload or a new tab does not. See that file for why.
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
        className="bg-ink text-paper inline-flex items-center gap-2"
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
            <div className="text-center" style={{ marginBottom: 26 }}>
                <span
                    className="text-accent"
                    style={{ fontFamily: 'var(--serif)', fontSize: 30, letterSpacing: '.12em' }}
                >
                    家族
                </span>
                <p className="text-ink-mid" style={{ fontSize: 12.5, marginTop: 10 }}>
                    Property titles. Restricted to named team members.
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
            <h3
                className="text-center"
                style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, marginBottom: 6 }}
            >
                Before you search
            </h3>
            <p className="text-ink-mid text-center" style={{ fontSize: 12, marginBottom: 22 }}>
                Signed in as {searcher}
            </p>

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

const Badge: React.FC<{ children: React.ReactNode; accent?: boolean }> = ({ children, accent }) => (
    <span
        style={{
            fontFamily: 'var(--mono)', fontSize: 9.5, textTransform: 'uppercase',
            letterSpacing: '.07em', padding: '2px 6px',
            border: `1px solid ${accent ? 'var(--accent)' : 'var(--rule)'}`,
            color: accent ? 'var(--accent)' : 'var(--ink-pale)',
            whiteSpace: 'nowrap',
        }}
    >
        {children}
    </span>
);

const EventRow: React.FC<{ event: MemorialEvent }> = ({ event }) => {
    const [open, setOpen] = useState(false);
    const when = event.date
        ? (event.undated
            ? `${event.date.getUTCFullYear()}?`
            : event.date.toISOString().slice(0, 10))
        : '—';

    return (
        <div style={{ borderTop: '1px solid var(--rule)', padding: '11px 0' }}>
            <div className="flex items-baseline gap-3" style={{ flexWrap: 'wrap' }}>
                <span
                    className="text-ink-pale"
                    style={{ fontFamily: 'var(--mono)', fontSize: 11, minWidth: 82 }}
                >
                    {when}
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 180 }}>
                    {event.headline}
                </span>
                {event.current && <Badge accent>Current</Badge>}
                {event.closed_by && <Badge>{`Closed · ${heldFor(event)}`}</Badge>}
            </div>
            <p className="text-ink-mid" style={{ fontSize: 12, margin: '5px 0 0', paddingLeft: 94 }}>
                {event.commentary}
            </p>
            <div style={{ paddingLeft: 94, marginTop: 5 }}>
                <button
                    onClick={() => setOpen(!open)}
                    className="text-ink-pale hover:text-ink"
                    style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em' }}
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
            </div>
        </div>
    );
};

const Report: React.FC<{ report: TitleReport; onBack: () => void }> = ({ report, onBack }) => {
    const events = React.useMemo(() => visible(analyse(report.memorials)), [report]);
    const currentCount = events.filter(e => e.current).length;
    const title = report.title ?? {};

    return (
        <div className="text-left">
            <button
                onClick={onBack}
                className="text-ink-pale hover:text-ink inline-flex items-center gap-1.5"
                style={{ fontSize: 12, marginBottom: 16 }}
            >
                <ArrowLeft size={12} strokeWidth={1.75} /> Back to results
            </button>

            <div style={{ borderBottom: '1px solid var(--rule)', paddingBottom: 14, marginBottom: 16 }}>
                <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, margin: 0 }}>
                    {title.title_no ?? '—'}
                </h3>
                <p className="text-ink-mid" style={{ fontSize: 12.5, margin: '5px 0 0' }}>
                    {[title.type, title.status, title.land_district].filter(Boolean).join(' · ')}
                </p>
                {report.address && (
                    <p className="text-ink" style={{ fontSize: 13, margin: '7px 0 0' }}>
                        {report.address}
                    </p>
                )}
            </div>

            {report.owners.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                    <h4
                        className="text-ink-mid"
                        style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 7px' }}
                    >
                        Registered owners
                    </h4>
                    {report.owners.map((o, i) => (
                        <p key={i} style={{ fontSize: 13, margin: '0 0 3px' }}>
                            {o.corporate_name
                                || [o.prime_other_names, o.prime_surname].filter(Boolean).join(' ')
                                || 'Unnamed owner'}
                            {o.estate_share && (
                                <span className="text-ink-pale" style={{ fontFamily: 'var(--mono)', fontSize: 11, marginLeft: 8 }}>
                                    {o.estate_share}
                                </span>
                            )}
                        </p>
                    ))}
                </div>
            )}

            <h4
                className="text-ink-mid"
                style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', margin: '0 0 2px' }}
            >
                Memorials — {events.length} shown, {currentCount} current
            </h4>
            {events.map(e => <EventRow key={e.id} event={e} />)}

            <p
                className="text-ink-pale"
                style={{ fontSize: 11, lineHeight: 1.6, marginTop: 20, borderTop: '1px solid var(--rule)', paddingTop: 12 }}
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
        className="w-full flex items-center gap-4 text-left hover:bg-paper2"
        style={{ ...ruleStyle, padding: '11px 13px', marginBottom: 6 }}
    >
        <span
            className="text-accent"
            style={{ fontFamily: 'var(--mono)', fontSize: 12, minWidth: 100, flexShrink: 0 }}
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

    return (
        <div className="text-left">
            <div
                className="flex items-baseline justify-between"
                style={{ marginBottom: 16, gap: 12, flexWrap: 'wrap' }}
            >
                <span className="text-ink-mid" style={{ fontSize: 12 }}>
                    Signed in as <span className="text-ink">{searcher}</span>
                </span>
                <button
                    onClick={() => { void logout(); }}
                    className="text-ink-pale hover:text-ink"
                    style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em' }}
                >
                    Sign out
                </button>
            </div>

            <form onSubmit={submit}>
                <div className="flex gap-3" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
                    {(['address', 'owner'] as const).map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => { setMode(m); clear(); }}
                            style={{
                                fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase',
                                letterSpacing: '.08em', padding: '6px 12px',
                                border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--rule)'}`,
                                color: mode === m ? 'var(--ink)' : 'var(--ink-pale)',
                            }}
                        >
                            {m === 'address' ? 'Property address' : 'Registered owner'}
                        </button>
                    ))}
                </div>

                <Field
                    label="File / matter reference"
                    hint="Required. Recorded with the search so it can be accounted for later."
                >
                    <input
                        className={inputClass}
                        style={inputStyle}
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="e.g. MATTER-1234"
                    />
                </Field>

                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    <input
                        className={`${inputClass} flex-1`}
                        style={{ ...inputStyle, minWidth: 220 }}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={mode === 'address'
                            ? '810 Great South Road, Penrose, Auckland'
                            : 'Norak Properties Limited'}
                        aria-label={mode === 'address' ? 'Property address' : 'Registered owner'}
                    />
                    <Button type="submit" busy={busy} disabled={!query.trim() || !reference.trim()}>
                        Search
                    </Button>
                </div>
                {!reference.trim() && query.trim() && (
                    <p className="text-ink-pale" style={{ fontSize: 11.5, marginTop: 8 }}>
                        Add a file reference to search.
                    </p>
                )}
            </form>

            {error && <ErrorNote>{error}</ErrorNote>}

            {/* Address results */}
            {address?.resolution_status === 'needs_confirmation' && (
                <div style={{ marginTop: 22 }}>
                    <h4 className="text-ink-mid" style={{ fontSize: 12, marginBottom: 10 }}>
                        {address.candidates?.length} addresses matched — choose the one you meant.
                    </h4>
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
                </div>
            )}
            {address?.resolution_status === 'ok' && (
                <div style={{ marginTop: 22 }}>
                    <h4 className="text-ink-mid" style={{ fontSize: 12, marginBottom: 10 }}>
                        {address.resolved_address?.full_address} — {address.titles?.length} title
                        {address.titles?.length === 1 ? '' : 's'}
                    </h4>
                    {address.titles?.map(titleRow)}
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
                                <h4 className="text-ink-mid" style={{ fontSize: 12, marginBottom: 10 }}>
                                    {rows.length} title{rows.length === 1 ? '' : 's'}
                                </h4>
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

    if (!session) return <SignIn />;
    if (!session.acknowledged) return <Notice searcher={session.searcher} />;
    return <Search searcher={session.searcher} reference={session.reference} />;
};
