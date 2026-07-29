import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, Loader2, Lock, Search as SearchIcon } from 'lucide-react';
import { PropertyStyles } from './PropertyStyles';
import {
    fetchTitleReport, login, logout, searchAddress, searchOwner,
    PropertyError,
    type AddressResult, type OwnerResult, type TitleReport, type TitleSummary,
} from '../services/propertyService.js';
import {
    acknowledge, getSession, setReference, signIn, subscribe,
} from '../utils/propertySession.js';

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

const Search: React.FC<{
    searcher: string;
    reference: string;
    onOpenReport: (report: TitleReport, titleNo: string) => void;
}> = ({ searcher, reference, onOpenReport }) => {
    const [mode, setMode] = useState<Mode>('address');
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [address, setAddress] = useState<AddressResult | null>(null);
    const [owner, setOwner] = useState<OwnerResult | null>(null);

    // A report is no longer a face of this screen — it opens as its own tab, so
    // it survives switching to a company or an individual and gets its own chip.
    const clear = () => { setAddress(null); setOwner(null); setError(null); };

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
        onOpenReport(await fetchTitleReport(titleNo, reference.trim()), titleNo);
    });

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

export interface PropertyScreenProps {
    /** Hands a fetched title report up to the app, which opens it as a tab. */
    onOpenReport: (report: TitleReport, titleNo: string) => void;
}

export const PropertyScreen: React.FC<PropertyScreenProps> = ({ onOpenReport }) => {
    const session = useSyncExternalStore(subscribe, getSession, () => null);

    const face = !session
        ? <SignIn />
        : !session.acknowledged
            ? <Notice searcher={session.searcher} />
            : <Search
                searcher={session.searcher}
                reference={session.reference}
                onOpenReport={onOpenReport}
              />;

    return (
        <>
            {face}
            <PropertyStyles />
        </>
    );
};
