import React, { useState } from 'react';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { PersonCompanyResult } from '../types';
import { KydVerificationPanel } from './KydVerificationPanel';
import { DisqualifiedDirector } from '../src/api/disqualifiedDirectorsApi';
import { InsolvencyRecord, isInsolvencyRecordCurrent } from '../src/api/insolvencyApi';
import { summariseAddresses } from '../utils/addressSummary';
import { displaySubjectName } from '../utils/personName';
import { usePrimarySignature } from '../hooks/usePrimarySignature';

// Nicely formats an API date string (drops timezone offset, e.g. "+1200").
const formatDate = (dateString: string): string => {
    if (!dateString) return 'Unknown';
    const cleanDate = dateString.split('+')[0].split('-').slice(0, 3).join('-');
    try {
        const date = new Date(cleanDate);
        const day = date.getDate();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return `${day} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    } catch (e) {
        return dateString;
    }
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

// The register returns monthOfBirth as a bare number ("1"), which rendered as
// "Born 1 1976". Map it to a name; pass anything non-numeric straight through in
// case the field ever arrives already spelled out.
const formatBirth = (month?: string, year?: string): string | null => {
    if (!year) return null;
    if (!month) return year;
    const n = parseInt(month, 10);
    return `${Number.isInteger(n) && n >= 1 && n <= 12 ? MONTH_NAMES[n - 1] : month} ${year}`;
};

// Epoch ms for an API date string, or undefined if it can't be parsed.
const parseApiDate = (dateString?: string): number | undefined => {
    if (!dateString) return undefined;
    const cleanDate = dateString.split('+')[0].split('-').slice(0, 3).join('-');
    const t = new Date(cleanDate).getTime();
    return Number.isNaN(t) ? undefined : t;
};

interface Span { start: number; end: number }

// Merges overlapping/adjacent spans into the minimal covering set, so the
// directorship band shows genuine gaps rather than one continuous bar.
const mergeSpans = (spans: Span[]): Span[] => {
    if (spans.length === 0) return [];
    const sorted = [...spans].sort((a, b) => a.start - b.start);
    const merged: Span[] = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        if (sorted[i].start <= last.end) last.end = Math.max(last.end, sorted[i].end);
        else merged.push({ ...sorted[i] });
    }
    return merged;
};

/**
 * Directorship coverage against bankruptcy periods.
 *
 * This chart was built once before, shipped, and pulled the same day: with no
 * discharge dates coming through (we were not fetching the detail record — see
 * insolvencyApi.ts) every bankruptcy ran to "today" and every directorship
 * trivially overlapped it, yielding a bar labelled "2002 — 2026" and a headline
 * claim of 43 overlapping directorships. Both were artefacts of a fallback.
 *
 * Rebuilt on real dates, with the rule that caused that failure inverted: a
 * period with no known end is NEVER extended to today — it is excluded from the
 * chart and from the count, and the exclusion is stated. The count is deliberately
 * conservative: it counts only directorships whose own dates prove an overlap.
 * Undercounting is recoverable; overcounting is an accusation.
 */
const DirectorshipTimeline: React.FC<{ results: PersonCompanyResult[]; insolvencyRecords: InsolvencyRecord[] }> = ({ results, insolvencyRecords }) => {
    const now = Date.now();

    // A bankruptcy is drawable only with a known start AND a known end — either a
    // real discharge date, or a status that genuinely means "still bankrupt today".
    const periods: Array<{ start: number; end: number; current: boolean; conditionExpiry?: number }> = [];
    let undatedRecords = 0;
    for (const r of insolvencyRecords) {
        const start = parseApiDate(r.adjudicationOrLiquidationDate);
        if (start === undefined) { undatedRecords++; continue; }
        const discharge = parseApiDate(r.dischargeOrCompletionDate);
        if (isInsolvencyRecordCurrent(r)) {
            periods.push({ start, end: now, current: true, conditionExpiry: parseApiDate(r.dischargeConditionExpiryDate) });
        } else if (discharge !== undefined) {
            periods.push({ start, end: discharge, current: false, conditionExpiry: parseApiDate(r.dischargeConditionExpiryDate) });
        } else {
            undatedRecords++; // no discharge date and not current — refuse to guess
        }
    }

    // A directorship counts only when its start is known. Its end is the
    // resignation date; if it has ended but the date is missing, the span is
    // indeterminate and is excluded from the overlap count rather than assumed.
    const spans = results
        .filter(r => r.isDirector)
        .map(r => {
            const start = parseApiDate(r.appointmentDate);
            const resigned = parseApiDate(r.resignationDate);
            const end = resigned ?? (r.isInactive ? undefined : now);
            return { start, end };
        })
        .filter((s): s is Span => s.start !== undefined && s.end !== undefined && s.end >= s.start);

    if (periods.length === 0 || spans.length === 0) {
        if (undatedRecords === 0) return null;
        return (
            <p className="text-ink-pale mb-3" style={{ fontSize: '11.5px' }}>
                No timeline drawn — {undatedRecords} record{undatedRecords === 1 ? ' has' : 's have'} no discharge date on file,
                and an end date is not assumed.
            </p>
        );
    }

    const coverage = mergeSpans(spans);
    const overlapping = spans.filter(s => periods.some(p => s.start <= p.end && p.start <= s.end)).length;
    const excludedDirectorships = results.filter(r => r.isDirector).length - spans.length;

    const times = [...coverage.flatMap(c => [c.start, c.end]), ...periods.flatMap(p => [p.start, p.end, p.conditionExpiry ?? p.end])];
    const rawMin = Math.min(...times);
    const rawMax = Math.max(...times);
    const pad = Math.max((rawMax - rawMin) * 0.04, 86400000 * 60);
    const min = rawMin - pad;
    const max = rawMax + pad;
    const W = 900;
    const x = (t: number) => ((t - min) / (max - min)) * W;
    const year = (t: number) => new Date(t).getFullYear();

    return (
        <div className="mb-3">
            <svg viewBox={`0 0 ${W} 64`} width="100%" height={64} preserveAspectRatio="none" role="img"
                aria-label={`Directorship coverage against ${periods.length} bankruptcy period(s)`}>
                <text x={0} y={8} fill="var(--ink-pale)" style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>directorships held</text>
                {coverage.map((c, i) => (
                    <rect key={i} x={x(c.start)} y={12} width={Math.max(x(c.end) - x(c.start), 1.5)} height={9}
                        fill="var(--accent)" opacity=".25" />
                ))}
                <text x={0} y={34} fill="var(--crit)" style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>bankrupt</text>
                {periods.map((p, i) => (
                    <g key={i}>
                        <rect x={x(p.start)} y={38} width={Math.max(x(p.end) - x(p.start), 1.5)} height={9}
                            fill="var(--crit)" opacity=".85" />
                        <text x={x(p.start)} y={58} fill="var(--crit)" style={{ fontFamily: 'var(--mono)', fontSize: 9.5 }}>
                            {year(p.start)} — {p.current ? 'current' : year(p.end)}
                        </text>
                    </g>
                ))}
                <line x1={0} y1={62} x2={W} y2={62} stroke="var(--rule)" strokeWidth="1" />
            </svg>
            <div className="flex justify-between text-ink-pale" style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>
                <span>{year(min)}</span><span>{year(max)}</span>
            </div>
            <p className="text-ink-mid mt-1.5" style={{ fontSize: '11.5px' }}>
                {overlapping > 0 ? (
                    <span className="text-crit font-bold">
                        {overlapping} directorship{overlapping === 1 ? '' : 's'} overlapped a bankruptcy period
                    </span>
                ) : (
                    'No directorship overlapped a bankruptcy period'
                )}
                {' — '}derived mechanically from dates on file; not a finding that anything was breached.
                {(undatedRecords > 0 || excludedDirectorships > 0) && (
                    <span className="text-ink-pale">
                        {' '}Excluded as undated:{' '}
                        {[
                            undatedRecords > 0 ? `${undatedRecords} insolvency record${undatedRecords === 1 ? '' : 's'}` : null,
                            excludedDirectorships > 0 ? `${excludedDirectorships} directorship${excludedDirectorships === 1 ? '' : 's'}` : null,
                        ].filter(Boolean).join(' and ')}.
                    </span>
                )}
            </p>
        </div>
    );
};

interface PersonSearchResultsProps {
    personName: string;
    results: PersonCompanyResult[];
    disqualifiedDirectors?: DisqualifiedDirector[];
    insolvencyRecords?: InsolvencyRecord[];
    onCompanyClick: (result: PersonCompanyResult) => void;
    onBack: () => void;
}

type SortMode = 'default' | 'shareholding' | 'alphabetical';
type FilterMode = 'all' | 'directors' | 'shareholders' | 'active-only';

const RESULTS_PER_PAGE = 50;

// 34px severity kanji square for register-check cards
const CheckSquare: React.FC<{ tone: 'crit' | 'green'; glyph: string }> = ({ tone, glyph }) => (
    <span
        aria-hidden="true"
        className={`shrink-0 flex items-center justify-center ${tone === 'crit' ? 'bg-crit' : 'bg-green'}`}
        style={{ width: 34, height: 34, fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--paper)' }}
    >
        {glyph}
    </span>
);

// 19px severity kanji square. 'wash' is the dead-entity tone from the status ramp
// — neutral ink, deliberately not one of the severity colours.
const FlagSquare: React.FC<{ tone: 'crit' | 'amber' | 'green' | 'wash'; glyph: string }> = ({ tone, glyph }) => (
    <span
        aria-hidden="true"
        className={`shrink-0 flex items-center justify-center ${
            tone === 'crit' ? 'bg-crit' : tone === 'amber' ? 'bg-amber' : tone === 'green' ? 'bg-green' : 'bg-ink-mid'
        }`}
        style={{ width: 19, height: 19, fontFamily: 'var(--serif)', fontSize: 11, color: 'var(--paper)' }}
    >
        {glyph}
    </span>
);

// Kanji section marker. The glyph names the register the section draws on, so it
// carries meaning rather than decorating: 人 subject · 印 verification ·
// 険 risk/registers · 社 companies.
const Marker: React.FC<{ kanji: string; label: string }> = ({ kanji, label }) => (
    <div className="flex items-baseline gap-2.5 mb-3.5">
        <span aria-hidden="true" className="text-accent leading-none" style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>{kanji}</span>
        <span className="uppercase text-ink-pale" style={{ fontSize: '10.5px', letterSpacing: '.16em' }}>{label}</span>
        <span className="flex-1 h-px bg-rule" />
    </div>
);

/**
 * Identity spine — who this person is, held still while the findings scroll.
 *
 * Deliberately does NOT show date of birth, occupation or aliases. Those exist
 * only on the insolvency register, so presenting them as general identity facts
 * would be misleading twice over: absent for anyone with a clean record, and for
 * anyone else an implicit statement that they have been bankrupt, made outside
 * the register-checks section where that finding belongs. They stay on the
 * insolvency record cards, in context and attributed.
 *
 * The address summary is derived from results already in memory, so it costs
 * nothing. One signature is fetched lazily (see usePrimarySignature); the rest
 * stay in the KYD panel.
 */
const IdentitySpine: React.FC<{
    personName: string;
    results: PersonCompanyResult[];
    onOpenKyd: () => void;
}> = ({ personName, results, onOpenKyd }) => {
    const addresses = summariseAddresses(results);
    const top = addresses[0];
    const withAddress = addresses.reduce((n, a) => n + a.companies.length, 0);
    const signature = usePrimarySignature(results);

    const isDirector = results.some(r => r.isDirector);
    const isShareholder = results.some(r => r.shareholding > 0);
    const roleLabel = isDirector && isShareholder ? 'Shareholder · Director'
        : isDirector ? 'Director' : isShareholder ? 'Shareholder' : 'Individual';

    return (
        <aside className="lg:sticky lg:top-0 lg:self-start lg:max-h-screen lg:overflow-y-auto lg:border-r border-rule lg:pr-6 pb-8">
            <Marker kanji="人" label="Subject" />

            <div className="flex items-start gap-3">
                {/* Inkan — the same split 株/締 seal the graph node uses */}
                {/* Inkan. The glyph is a direct grid child with line-height 1 so the seal
                    optically centres — a wrapper box sized to the glyph left the CJK
                    character sitting high and off-centre inside the ring. */}
                <span aria-hidden="true" className="relative shrink-0 grid place-items-center" style={{ width: 44, height: 44 }}>
                    <span className="absolute inset-0 rounded-full" style={{ border: '1px solid var(--accent)' }} />
                    <span className="absolute rounded-full" style={{ inset: 3, border: '1px solid oklch(from var(--accent) l c h / .35)' }} />
                    {isDirector && isShareholder ? (
                        <span className="relative block" style={{ width: 18, height: 18 }}>
                            <span className="absolute inset-0 grid place-items-center" style={{ fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1, color: 'var(--accent)', clipPath: 'inset(0 50% 0 0)' }}>株</span>
                            <span className="absolute inset-0 grid place-items-center" style={{ fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1, color: 'var(--accent)', clipPath: 'inset(0 0 0 50%)' }}>締</span>
                            <span className="absolute" style={{ top: -2, bottom: -2, left: '50%', width: 1, background: 'var(--accent)', opacity: .7 }} />
                        </span>
                    ) : (
                        <span className="block" style={{ fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1, color: 'var(--accent)' }}>
                            {isDirector ? '締' : '株'}
                        </span>
                    )}
                </span>
                <div className="min-w-0">
                    <h2 className="text-ink" style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 27, lineHeight: 1.12 }}>
                        {personName}
                    </h2>
                    <p className="uppercase text-ink-pale mt-1.5" style={{ fontSize: '10.5px', letterSpacing: '.12em' }}>{roleLabel}</p>
                </div>
            </div>

            <div className="mt-7 pt-1 border-t border-rule">
                <Marker kanji="印" label="Verification" />

                {top ? (
                    <>
                        <div className="flex items-center gap-1.5 mb-2">
                            <FlagSquare tone={addresses.length === 1 ? 'green' : 'amber'} glyph={addresses.length === 1 ? '青' : '琥'} />
                            <span className={`uppercase ${addresses.length === 1 ? 'text-green' : 'text-amber'}`} style={{ fontSize: '10.5px', letterSpacing: '.06em' }}>
                                {addresses.length === 1 ? 'All addresses match' : `${addresses.length} different addresses`}
                            </span>
                        </div>
                        <div className="border border-rule bg-paper2 px-2.5 py-2">
                            <p className="text-ink" style={{ fontSize: '12.5px', lineHeight: 1.45 }}>{top.fullAddress}</p>
                            <p className="text-ink-pale mt-1" style={{ fontSize: '11px' }}>
                                Most used · {top.companies.length} of {withAddress} {withAddress === 1 ? 'company' : 'companies'}
                            </p>
                        </div>
                        {addresses.length > 1 && (
                            <ul className="mt-2 pl-2.5 border-l border-rule text-ink-mid" style={{ fontSize: '11.5px', lineHeight: 1.7 }}>
                                {addresses.slice(1, 5).map((a, i) => (
                                    <li key={i} className="truncate" title={a.fullAddress}>{a.address} — {a.companies.length}</li>
                                ))}
                                {addresses.length > 5 && <li className="text-ink-pale">+{addresses.length - 5} more</li>}
                            </ul>
                        )}
                    </>
                ) : (
                    <p className="text-ink-pale" style={{ fontSize: '11.5px' }}>No address filed against these roles.</p>
                )}

                {/* Signature — one, fetched lazily. White ground stays on the frame: the
                    crop is a PNG of a paper form, not a themed surface. 'none' is stated
                    rather than rendering nothing, so "no form on record" can't be
                    mistaken for "still loading" or for a silent failure. */}
                {signature.status === 'loading' && (
                    <div className="mt-4 border border-rule grid place-items-center" style={{ background: '#fff', minHeight: 54 }}>
                        <span className="text-ink-pale" style={{ fontSize: '11px' }}>Reading consent form…</span>
                    </div>
                )}
                {signature.status === 'ready' && signature.imageDataUrl && (
                    <div className="mt-4">
                        <div className="border border-rule" style={{ background: '#fff' }}>
                            <img src={signature.imageDataUrl} alt={`Signature from ${signature.companyName || 'a consent form'}`} className="w-full block" />
                        </div>
                        <div className="flex justify-between gap-2 mt-1.5 text-ink-pale" style={{ fontSize: '10.5px' }}>
                            <span className="truncate" title={signature.companyName ?? ''}>{signature.companyName}</span>
                            {signature.filingDate && <span className="font-mono tabular-nums shrink-0">{formatDate(signature.filingDate)}</span>}
                        </div>
                    </div>
                )}
                {signature.status === 'none' && (
                    <p className="mt-4 text-ink-pale" style={{ fontSize: '11px' }}>
                        No consent form signature available for the current directorships.
                    </p>
                )}

                <button
                    onClick={onOpenKyd}
                    className="mt-3 w-full border border-rule px-2.5 py-1.5 text-left text-ink-mid hover:border-ink-mid hover:text-ink transition-colors"
                    style={{ fontSize: '11.5px' }}
                >
                    <span aria-hidden="true" className="text-accent mr-1.5" style={{ fontFamily: 'var(--serif)' }}>印</span>
                    Open KYD verification
                    {signature.otherCount > 0 ? ` · ${signature.otherCount} more form${signature.otherCount === 1 ? '' : 's'} →` : ' →'}
                </button>
            </div>
        </aside>
    );
};

// One roster row. Same data and same click target as the old card, laid out as a
// ruled line — at 45 companies the card grid was the density problem.
const RosterRow: React.FC<{ result: PersonCompanyResult; onClick: () => void }> = ({ result, onClick }) => {
    const {
        companyName, nzbn, isDirector, shareholding, status, entityStatusCode,
        isInExternalAdmin, externalAdminType, removalCommenced,
        hasHistoricInsolvency, historicInsolvencyType, entityStatusDescription,
    } = result;

    const isCompanyRemoved = entityStatusDescription
        ? entityStatusDescription.toLowerCase().includes('removed') || entityStatusDescription.toLowerCase() === 'inactive'
        : (entityStatusCode || 0) >= 80;
    const isRegistered = !isInExternalAdmin && !isCompanyRemoved && !removalCommenced && status === 'REGISTERED';
    const displayStatus = (isInExternalAdmin && externalAdminType) ? externalAdminType.toUpperCase()
        : entityStatusDescription ? entityStatusDescription.toUpperCase() : status;

    const yearOf = (d?: string) => {
        const t = parseApiDate(d);
        return t === undefined ? null : String(new Date(t).getFullYear());
    };
    const from = yearOf(result.appointmentDate);
    const to = result.isInactive ? (yearOf(result.resignationDate) ?? '—') : 'current';

    const roles = [
        isDirector ? 'Director' : null,
        shareholding > 0 ? `Shareholder · ${shareholding.toFixed(1)}%` : null,
    ].filter(Boolean).join(' & ');

    // Company-level marks, worst first. 消 (struck off) is deliberately ink rather
    // than amber: 琥 amber means removal is *in progress* and still stoppable,
    // whereas a completed removal is a dead entity, which the status ramp renders
    // faded. It also carries no inline label — the struck-through name and the
    // status column already say "removed", so a third repetition would only cost
    // width; the square is there to make the row scannable.
    const stamps: Array<{ glyph: string; tone: 'crit' | 'amber' | 'wash'; title: string; label?: string; className?: string }> = [];
    if (isInExternalAdmin) stamps.push({ glyph: '紅', tone: 'crit', title: displayStatus, label: displayStatus, className: 'text-crit font-bold' });
    if (isCompanyRemoved && hasHistoricInsolvency) {
        const type = historicInsolvencyType ? historicInsolvencyType.replace(/^in\s+/i, '') : 'Insolvency';
        stamps.push({ glyph: '紅', tone: 'crit', title: `Previously in ${type}`, label: `Prev: ${type}`, className: 'text-crit' });
    }
    if (removalCommenced && !isCompanyRemoved) stamps.push({ glyph: '琥', tone: 'amber', title: 'Removal in progress', label: 'Removal in progress', className: 'text-amber' });
    if (isCompanyRemoved) stamps.push({ glyph: '消', tone: 'wash', title: 'Removed from the register' });
    const stampLabels = stamps.filter(s => s.label);

    return (
        <tr onClick={onClick} className="cursor-pointer group hover:bg-paper2 transition-colors">
            <td className="align-top py-2 pr-3 border-b border-rule">
                <div className={`font-bold text-ink ${isCompanyRemoved && !isInExternalAdmin ? 'line-through text-ink-mid' : ''}`} style={{ fontSize: '12.5px' }}>
                    {companyName}
                </div>
                <div className="font-mono text-ink-pale" style={{ fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>{nzbn}</div>
                {/* Company stamps. Squares are grouped and the labels share one line so
                    a company carrying several marks costs one row of height, not three. */}
                {stamps.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="flex items-center gap-1 shrink-0">
                            {stamps.map((s, i) => (
                                <span key={i} title={s.title} className="flex"><FlagSquare tone={s.tone} glyph={s.glyph} /></span>
                            ))}
                        </span>
                        {stampLabels.length > 0 && (
                            <span className="uppercase leading-tight" style={{ fontSize: '9.5px', letterSpacing: '.05em' }}>
                                {stampLabels.map((s, i) => (
                                    <span key={i} className={s.className}>
                                        {i > 0 && <span className="text-ink-pale"> · </span>}{s.label}
                                    </span>
                                ))}
                            </span>
                        )}
                    </div>
                )}
            </td>
            <td className="align-top py-2 pr-3 border-b border-rule whitespace-nowrap" style={{ fontSize: '12px' }}>
                <span className={result.isInactive ? 'text-ink-mid' : 'text-accent'}>{roles || '—'}</span>
                {/* A ceased role is a fact about the PERSON, not a mark against the
                    company — so it is an outlined neutral tag in the role column, never
                    a filled severity square like the company stamps beside it. */}
                {result.isInactive && (
                    <span className="ml-2 inline-flex items-center gap-1 border border-rule px-1.5 py-px align-middle text-ink-mid"
                          style={{ fontSize: '9.5px', letterSpacing: '.05em' }}>
                        <span aria-hidden="true" style={{ fontFamily: 'var(--serif)' }}>辞</span>
                        <span className="uppercase">Resigned</span>
                    </span>
                )}
            </td>
            <td className="align-top py-2 pr-3 border-b border-rule text-ink-pale whitespace-nowrap tabular-nums" style={{ fontSize: '11px' }}>
                {from ? `${from} — ${to}` : '—'}
            </td>
            <td className="align-top py-2 border-b border-rule whitespace-nowrap">
                <span className={`uppercase ${isInExternalAdmin ? 'text-crit font-bold' : isRegistered ? 'text-green' : 'text-ink-pale'}`}
                      style={{ fontSize: '10px', letterSpacing: '.05em' }}>
                    {displayStatus}
                </span>
                <span className="block text-ink-pale group-hover:text-accent transition-colors" style={{ fontSize: '10px' }}>
                    Chart →
                </span>
            </td>
        </tr>
    );
};

export const PersonSearchResults: React.FC<PersonSearchResultsProps> = ({
    personName,
    results,
    disqualifiedDirectors,
    insolvencyRecords,
    onCompanyClick,
    onBack
}) => {
    const [sortMode, setSortMode] = useState<SortMode>('default');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [showKyd, setShowKyd] = useState(false);
    // Register-check strips: collapsed by default, but a CURRENT record opens
    // automatically — you shouldn't have to click to learn someone is presently
    // bankrupt or disqualified (design/HANDOVER.md §3e/§4.3).
    const [dqOpen, setDqOpen] = useState(() =>
        !!disqualifiedDirectors?.some(d => d.disqualificationCriteria?.criteria?.some(c => !c.endDate))
    );
    const [insOpen, setInsOpen] = useState(() => !!insolvencyRecords?.some(isInsolvencyRecordCurrent));

    // Filter results
    const filteredResults = results.filter(r => {
        if (filterMode === 'directors') return r.isDirector;
        if (filterMode === 'shareholders') return r.shareholding > 0;
        if (filterMode === 'active-only') {
            // Only active companies AND where person has active role (not resigned)
            const isCompanyActive = (r.entityStatusCode || 0) < 80;
            const isRoleActive = !r.isInactive;
            return isCompanyActive && isRoleActive;
        }
        return true;
    });

    // Sort results
    const sortedResults = [...filteredResults].sort((a, b) => {
        if (sortMode === 'shareholding') {
            return b.shareholding - a.shareholding;
        }
        if (sortMode === 'alphabetical') {
            return a.companyName.localeCompare(b.companyName);
        }
        // Default: Directors first, then shareholding
        if (a.isDirector && !b.isDirector) return -1;
        if (!a.isDirector && b.isDirector) return 1;
        return b.shareholding - a.shareholding;
    });

    // Pagination
    const totalPages = Math.ceil(sortedResults.length / RESULTS_PER_PAGE);
    const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
    const endIndex = startIndex + RESULTS_PER_PAGE;
    const paginatedResults = sortedResults.slice(startIndex, endIndex);

    const directorCount = results.filter(r => r.isDirector).length;
    const shareholderCount = results.filter(r => r.shareholding > 0).length;
    const activeCount = results.filter(r => {
        const isCompanyActive = (r.entityStatusCode || 0) < 80;
        const isRoleActive = !r.isInactive;
        return isCompanyActive && isRoleActive;
    }).length;

    console.log('PersonSearchResults - activeCount:', activeCount, 'total:', results.length);

    const hasDisqualified = !!(disqualifiedDirectors && disqualifiedDirectors.length > 0);
    const hasInsolvency = !!(insolvencyRecords && insolvencyRecords.length > 0);
    const registersClear = !hasDisqualified && !hasInsolvency;

    // "Current" gates the auto-expand: a disqualification with no end date is
    // indefinite/current; an insolvency record counts as current when the
    // register says so OR the discharge is suspended (a suspended discharge
    // means still bankrupt regardless of what insolvencyStatus reads).
    const disqualifiedCurrent = !!disqualifiedDirectors?.some(
        d => d.disqualificationCriteria?.criteria?.some(c => !c.endDate)
    );
    const insolvencyCurrent = !!insolvencyRecords?.some(isInsolvencyRecordCurrent);
    // A property of the person, not of any one record — the register stamps it on
    // every record they hold, so it is read once rather than printed per record.
    const multipleInsolvencies = !!insolvencyRecords?.some(r => r.multipleInsolvencies);

    // Prefer the register's spelling of the name over whatever was typed.
    const subjectName = displaySubjectName(personName, results);

    const sortOptions: { value: SortMode; label: string }[] = [
        { value: 'default', label: 'Directors first' },
        { value: 'shareholding', label: 'Shareholding %' },
        { value: 'alphabetical', label: 'Alphabetical' },
    ];
    const filterOptions: { value: FilterMode; label: string }[] = [
        { value: 'all', label: `All (${results.length})` },
        { value: 'active-only', label: `Active (${activeCount})` },
        { value: 'directors', label: `Directors (${directorCount})` },
        { value: 'shareholders', label: `Shareholders (${shareholderCount})` },
    ];

    const controlBtn = (active: boolean) =>
        `px-3 py-1 border transition-colors ${active
            ? 'border-ink bg-ink text-paper'
            : 'border-rule bg-paper text-ink-mid hover:border-ink hover:text-ink'}`;

    return (
        <div id="person-search-results" className="absolute inset-0 flex flex-col bg-paper overflow-hidden">
            {/* Slim return bar. The masthead used to live here and grew unbounded with
                the register records; identity now sits in the spine instead, so nothing
                above the fold can push the roster off screen. */}
            <div className="px-6 py-2.5 bg-paper border-b border-rule shrink-0 flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-sm text-ink-mid hover:text-ink transition-colors"
                >
                    <ChevronLeft size={16} strokeWidth={1.5} />
                    Back to search
                </button>
                <p className="ml-auto text-ink-pale" style={{ fontSize: '12px' }}>
                    {results.length} {results.length === 1 ? 'company' : 'companies'}
                    {' · '}{directorCount} directorship{directorCount === 1 ? '' : 's'}
                    {' · '}{shareholderCount} shareholding{shareholderCount === 1 ? '' : 's'}
                    {' · '}{activeCount} active
                </p>
            </div>

            {/* 調書 — identity spine beside scrolling findings (design/individual-page-direction.html) */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-[1240px] mx-auto px-6 grid gap-x-7 lg:grid-cols-[300px_minmax(0,1fr)] pt-6">
                <IdentitySpine
                    personName={subjectName}
                    results={results}
                    onOpenKyd={() => setShowKyd(true)}
                />

                <main className="min-w-0 pb-10">
                <Marker kanji="険" label="Register checks" />

                {/* REGISTER CHECKS: one collapsed-by-default strip per register, not a
                    scrolling stack of full cards — a long record list used to push the
                    masthead past the viewport and squeeze the company grid below into a
                    nested-scrollbar mess. A CURRENT record still opens automatically, so
                    the one fact that matters most is never hidden behind a click
                    (design/HANDOVER.md §3e/§4.3/§4.6). */}
                <div className="border border-rule">
                    {registersClear && (
                        <div className="flex items-start gap-3 p-3 bg-paper2">
                            <CheckSquare tone="green" glyph="青" />
                            <div className="min-w-0">
                                <p className="font-bold text-ink" style={{ fontSize: '13px' }}>
                                    Register checks · clear
                                </p>
                                <p className="text-ink-mid" style={{ fontSize: '12px' }}>
                                    No records for "{subjectName}" in the Disqualified Directors or Insolvency registers.
                                </p>
                            </div>
                        </div>
                    )}

                    {hasDisqualified && (
                        <div className="border-t border-rule first:border-t-0">
                            <button
                                onClick={() => setDqOpen(o => !o)}
                                aria-expanded={dqOpen}
                                className="w-full flex items-center gap-3 p-3 bg-paper2 text-left"
                            >
                                <CheckSquare tone="crit" glyph="紅" />
                                <span className="min-w-0 flex-1">
                                    <p className="font-bold text-ink truncate" style={{ fontSize: '13px' }}>
                                        Disqualified director
                                        <span className="text-ink-mid font-normal ml-1" style={{ fontSize: '12px' }}>
                                            · {disqualifiedDirectors!.length} {disqualifiedDirectors!.length === 1 ? 'record' : 'records'}
                                        </span>
                                    </p>
                                </span>
                                <span
                                    className={`uppercase font-bold whitespace-nowrap ${disqualifiedCurrent ? 'text-crit' : 'text-ink-pale'}`}
                                    style={{ fontSize: '10px', letterSpacing: '.04em' }}
                                >
                                    {disqualifiedCurrent ? 'Current' : 'No current'}
                                </span>
                                <span
                                    className="text-ink-pale"
                                    style={{ fontSize: '11px', transition: 'transform .15s', transform: dqOpen ? 'rotate(90deg)' : 'none' }}
                                    aria-hidden="true"
                                >
                                    ▸
                                </span>
                            </button>
                            {dqOpen && (
                                <div className="p-3 border-t border-rule bg-paper2 space-y-3">
                                    {disqualifiedDirectors!.map((director, idx) => (
                                        <div key={idx} className="min-w-0">
                                            <p className="font-bold text-ink" style={{ fontSize: '13px' }}>
                                                {director.firstName} {director.middleName} {director.lastName}
                                                <span className="font-mono text-ink-pale font-normal ml-2" style={{ fontSize: '10.5px', fontVariantNumeric: 'tabular-nums' }}>
                                                    ID {director.disqualifiedDirectorId}
                                                </span>
                                            </p>
                                            {director.aliases && director.aliases.aliases && director.aliases.aliases.length > 0 && (
                                                <p className="text-ink-mid" style={{ fontSize: '12px' }}>
                                                    Also known as: {director.aliases.aliases.join(', ')}
                                                </p>
                                            )}
                                            {director.disqualificationCriteria?.criteria?.map((c, i) => (
                                                <div key={i} className="mt-1.5 text-ink-mid" style={{ fontSize: '12px' }}>
                                                    <p>
                                                        <span className="text-crit">Reason:</span> {c.criteria || 'Section 385 Companies Act 1993'}
                                                    </p>
                                                    <p>
                                                        <span className="text-crit">Period:</span>{' '}
                                                        {formatDate(c.startDate)} – {c.endDate ? formatDate(c.endDate) : 'Indefinite'}
                                                    </p>
                                                    {c.comments && (
                                                        <p className="italic mt-1 p-2 bg-paper border border-rule">
                                                            "{c.comments}"
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {hasInsolvency && (
                        <div className="border-t border-rule first:border-t-0">
                            <button
                                onClick={() => setInsOpen(o => !o)}
                                aria-expanded={insOpen}
                                className="w-full flex items-center gap-3 p-3 bg-paper2 text-left"
                            >
                                <CheckSquare tone="crit" glyph="紅" />
                                <span className="min-w-0 flex-1">
                                    <p className="font-bold text-ink truncate" style={{ fontSize: '13px' }}>
                                        Insolvency
                                        <span className="text-ink-mid font-normal ml-1" style={{ fontSize: '12px' }}>
                                            · {insolvencyRecords!.length} {insolvencyRecords!.length === 1 ? 'record' : 'records'}
                                        </span>
                                    </p>
                                    {multipleInsolvencies && (
                                        <p className="text-amber uppercase font-bold" style={{ fontSize: '10px', letterSpacing: '.04em' }}>
                                            Multiple insolvencies on record
                                        </p>
                                    )}
                                </span>
                                <span
                                    className={`uppercase font-bold whitespace-nowrap ${insolvencyCurrent ? 'text-crit' : 'text-ink-pale'}`}
                                    style={{ fontSize: '10px', letterSpacing: '.04em' }}
                                >
                                    {insolvencyCurrent ? 'Current' : 'No current'}
                                </span>
                                <span
                                    className="text-ink-pale"
                                    style={{ fontSize: '11px', transition: 'transform .15s', transform: insOpen ? 'rotate(90deg)' : 'none' }}
                                    aria-hidden="true"
                                >
                                    ▸
                                </span>
                            </button>
                            {insOpen && (
                                <div className="p-3 border-t border-rule bg-paper2 space-y-3">
                                    <DirectorshipTimeline results={results} insolvencyRecords={insolvencyRecords!} />
                                    {insolvencyRecords!.map((record, idx) => (
                                        <div key={idx} className="min-w-0">
                                            <p className="font-bold text-ink" style={{ fontSize: '13px' }}>
                                                {record.estateName}
                                                <span className={`font-normal uppercase ml-2 ${isInsolvencyRecordCurrent(record) ? 'text-crit' : 'text-amber'}`} style={{ fontSize: '10px', letterSpacing: '.04em' }}>
                                                    {record.insolvencyStatus}{record.dischargeSuspended ? ' · discharge suspended' : ''}
                                                </span>
                                            </p>
                                            {record.alternateNames && record.alternateNames.length > 0 && (
                                                <p className="text-ink-mid" style={{ fontSize: '12px' }}>
                                                    Also known as: {record.alternateNames.join(', ')}
                                                </p>
                                            )}
                                            {/* Identity corroboration — this feature can only ever match on
                                                name, so show the register's own distinguishing details and
                                                let the reader confirm it's the same individual. */}
                                            {(record.yearOfBirth || record.occupationAtAdjudicationOrIndustryAtLiquidation) && (
                                                <p className="text-ink-pale" style={{ fontSize: '11.5px' }}>
                                                    {[
                                                        formatBirth(record.monthOfBirth, record.yearOfBirth) && `Born ${formatBirth(record.monthOfBirth, record.yearOfBirth)}`,
                                                        record.occupationAtAdjudicationOrIndustryAtLiquidation,
                                                    ].filter(Boolean).join(' · ')}
                                                </p>
                                            )}
                                            <div className="mt-1.5 text-ink-mid" style={{ fontSize: '12px' }}>
                                                <p>
                                                    <span className="text-crit">Type:</span> {record.insolvencyTypeDescription}
                                                </p>
                                                <p>
                                                    <span className="text-crit">Adjudication:</span>{' '}
                                                    {formatDate(record.adjudicationOrLiquidationDate)}
                                                </p>
                                                {/* Always stated, even when absent — an unstated discharge date
                                                    reads as "still bankrupt", and a guessed one reads as fact.
                                                    Say plainly that the register doesn't carry it. */}
                                                <p>
                                                    <span className="text-crit">Discharge/completion:</span>{' '}
                                                    {record.dischargeOrCompletionDate ? (
                                                        <>
                                                            {formatDate(record.dischargeOrCompletionDate)}
                                                            {record.dischargeOrCompletionType ? ` · ${record.dischargeOrCompletionType}` : ''}
                                                        </>
                                                    ) : (
                                                        <span className="text-ink-pale">not recorded on the register</span>
                                                    )}
                                                </p>
                                                {record.dischargeConditionExpiryDate && (
                                                    <p>
                                                        <span className="text-crit">Conditions expire:</span>{' '}
                                                        {formatDate(record.dischargeConditionExpiryDate)}
                                                    </p>
                                                )}
                                                {record.annulmentDate && (
                                                    <p>
                                                        <span className="text-crit">Annulled:</span> {formatDate(record.annulmentDate)}
                                                    </p>
                                                )}
                                                {/* "Multiple insolvencies" is a fact about the PERSON, not this
                                                    record — the register sets it on every record belonging to
                                                    them, so printing it per-record repeated it N times. Stated
                                                    once, in the always-visible strip header. */}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Roster ─────────────────────────────────────────── */}
                <div className="mt-8">
                <Marker kanji="社" label={`Companies · ${results.length}`} />

                <div className="flex flex-wrap gap-x-6 gap-y-3 items-center mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-ink-pale uppercase" style={{ fontSize: '10.5px', letterSpacing: '.08em' }}>Sort</span>
                        <div className="flex flex-wrap gap-1 text-xs">
                            {sortOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        setSortMode(opt.value);
                                        setCurrentPage(1);
                                    }}
                                    className={controlBtn(sortMode === opt.value)}
                                    aria-pressed={sortMode === opt.value}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-ink-pale uppercase" style={{ fontSize: '10.5px', letterSpacing: '.08em' }}>Filter</span>
                        <div className="flex flex-wrap gap-1 text-xs">
                            {filterOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => {
                                        setFilterMode(opt.value);
                                        setCurrentPage(1);
                                    }}
                                    className={controlBtn(filterMode === opt.value)}
                                    aria-pressed={filterMode === opt.value}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="ml-auto text-ink-pale" style={{ fontSize: '12px' }}>
                        Showing {startIndex + 1}–{Math.min(endIndex, sortedResults.length)} of {sortedResults.length}
                    </div>
                </div>

                {paginatedResults.length === 0 ? (
                    <div className="text-center py-12">
                        <Building2 className="mx-auto mb-4 text-ink-pale" size={48} strokeWidth={1.5} />
                        <p className="text-ink-mid">No companies found with selected filters</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    {['Company', 'Role', 'Held', 'Status'].map((h, i) => (
                                        <th key={h}
                                            className="text-left uppercase text-ink-pale font-medium pb-1.5 pr-3 border-b border-rule"
                                            style={{ fontSize: '10px', letterSpacing: '.1em', width: i === 0 ? '42%' : undefined }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedResults.map((result) => (
                                    <RosterRow
                                        key={result.nzbn}
                                        result={result}
                                        onClick={() => onCompanyClick(result)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                </div>

            {/* Pagination — scrolls with the roster now that the page is one column
                of findings rather than a fixed frame with its own inner scroller. */}
            {totalPages > 1 && (
                <div className="mt-4 p-3 bg-paper2 border border-rule flex items-center justify-center gap-2">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                        className="p-2 border border-rule bg-paper text-ink hover:border-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft size={20} strokeWidth={1.5} />
                    </button>

                    <div className="flex gap-1">
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 7) {
                                pageNum = i + 1;
                            } else if (currentPage <= 4) {
                                pageNum = i + 1;
                            } else if (currentPage >= totalPages - 3) {
                                pageNum = totalPages - 6 + i;
                            } else {
                                pageNum = currentPage - 3 + i;
                            }

                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`px-3 py-1 text-sm transition-colors ${controlBtn(currentPage === pageNum)}`}
                                    aria-current={currentPage === pageNum ? 'page' : undefined}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        aria-label="Next page"
                        className="p-2 border border-rule bg-paper text-ink hover:border-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight size={20} strokeWidth={1.5} />
                    </button>

                    <span className="ml-4 text-ink-pale" style={{ fontSize: '12px' }}>
                        Page {currentPage} of {totalPages}
                    </span>
                </div>
            )}
                </main>
              </div>
            </div>

            {/* KYD Verification Panel */}
            {showKyd && (
                <KydVerificationPanel
                    personName={personName}
                    results={results}
                    onClose={() => setShowKyd(false)}
                />
            )}
        </div>
    );
};
