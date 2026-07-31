import React, { useState } from 'react';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { PersonCompanyResult } from '../types';
import { KydVerificationPanel } from './KydVerificationPanel';
import { DisqualifiedDirector } from '../src/api/disqualifiedDirectorsApi';
import { InsolvencyRecord, isInsolvencyRecordCurrent } from '../src/api/insolvencyApi';

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

// Epoch ms for an API date string, or undefined if it can't be parsed.
const parseApiDate = (dateString?: string): number | undefined => {
    if (!dateString) return undefined;
    const cleanDate = dateString.split('+')[0].split('-').slice(0, 3).join('-');
    const t = new Date(cleanDate).getTime();
    return Number.isNaN(t) ? undefined : t;
};

interface Interval {
    start: number;
    end: number; // open-ended (ongoing) intervals are extended to "now" before merging
}

// Sorts and merges overlapping/adjacent intervals into the minimal set that
// covers the same ground — the directorship "coverage" band is the union of
// every company's tenure, so a gap between two directorships still reads as
// a gap rather than one continuous (and misleading) bar.
const mergeIntervals = (intervals: Interval[]): Interval[] => {
    if (intervals.length === 0) return [];
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged: Interval[] = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        const cur = sorted[i];
        if (cur.start <= last.end) {
            last.end = Math.max(last.end, cur.end);
        } else {
            merged.push({ ...cur });
        }
    }
    return merged;
};

/**
 * Directorship-coverage timeline (design/HANDOVER.md §"the timeline is the
 * creative bit"): one merged band showing every window where this person held
 * ANY directorship, bankruptcy periods overlaid on top. Answers "was he running
 * companies while bankrupt?" without a row per company — a Gantt-per-company
 * shape doesn't hold up for someone with 40+ directorships.
 *
 * The overlap COUNT stated below the chart is computed separately, from the
 * granular per-company appointment/resignation dates (not the merged band) —
 * merging trades away which specific company overlapped, but the count itself
 * should still be exact.
 */
const DirectorshipTimeline: React.FC<{ results: PersonCompanyResult[]; insolvencyRecords: InsolvencyRecord[] }> = ({ results, insolvencyRecords }) => {
    const now = Date.now();

    const directorships = results
        .filter(r => r.isDirector && r.appointmentDate)
        .map(r => ({
            result: r,
            start: parseApiDate(r.appointmentDate)!,
            end: r.resignationDate ? (parseApiDate(r.resignationDate) ?? now) : now,
        }))
        .filter(d => Number.isFinite(d.start));

    const bankruptcies = insolvencyRecords
        .map(r => ({
            record: r,
            start: parseApiDate(r.adjudicationOrLiquidationDate),
            // A suspended discharge or an outright "current" status means still
            // bankrupt right now, regardless of a discharge date on file.
            end: isInsolvencyRecordCurrent(r) ? now : (parseApiDate(r.dischargeOrCompletionDate) ?? now),
            conditionExpiry: parseApiDate(r.dischargeConditionExpiryDate),
        }))
        .filter(b => b.start !== undefined) as Array<{ record: InsolvencyRecord; start: number; end: number; conditionExpiry?: number }>;

    if (directorships.length === 0 || bankruptcies.length === 0) return null;

    const coverage = mergeIntervals(directorships.map(d => ({ start: d.start, end: d.end })));

    // Mechanical overlap count — from the granular per-company dates, not the
    // merged band, so merging the visual doesn't cost accuracy in the count.
    const overlappingCount = directorships.filter(d =>
        bankruptcies.some(b => d.start <= b.end && b.start <= d.end)
    ).length;

    const allTimes = [...coverage.flatMap(c => [c.start, c.end]), ...bankruptcies.flatMap(b => [b.start, b.conditionExpiry ?? b.end, b.end])];
    const rawMin = Math.min(...allTimes);
    const rawMax = Math.max(...allTimes, now);
    const pad = Math.max((rawMax - rawMin) * 0.03, 86400000 * 30);
    const min = rawMin - pad;
    const max = rawMax + pad;
    const W = 900;
    const x = (t: number) => ((t - min) / (max - min)) * W;

    const yearLabel = (t: number) => new Date(t).getFullYear();

    return (
        <div className="mb-3">
            <svg viewBox={`0 0 ${W} 62`} width="100%" height={62} preserveAspectRatio="none" role="img"
                aria-label="Directorship coverage against bankruptcy periods">
                <defs>
                    <pattern id="ins-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="6" stroke="var(--crit)" strokeWidth="2" opacity=".5" />
                    </pattern>
                </defs>
                {/* Directorship coverage — union of every company's tenure, gaps visible */}
                {coverage.map((c, i) => (
                    <rect key={i} x={x(c.start)} y={10} width={Math.max(x(c.end) - x(c.start), 1.5)} height={9} fill="var(--accent)" opacity=".22" />
                ))}
                <text x={0} y={7} fill="var(--ink-pale)" style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>directorships held</text>
                {/* Bankruptcy periods — solid bar, hatched tail for a conditional-discharge window */}
                {bankruptcies.map((b, i) => (
                    <g key={i}>
                        <rect x={x(b.start)} y={24} width={Math.max(x(Math.min(b.conditionExpiry ?? b.end, b.end)) - x(b.start), 1.5)} height={10} fill="var(--crit)" opacity=".9" />
                        {b.conditionExpiry && b.conditionExpiry > b.end && (
                            <rect x={x(b.end)} y={24} width={Math.max(x(b.conditionExpiry) - x(b.end), 1.5)} height={10} fill="url(#ins-hatch)" />
                        )}
                        <text x={x(b.start)} y={47} fill="var(--crit)" style={{ fontFamily: 'var(--mono)', fontSize: 9.5 }}>
                            {yearLabel(b.start)}{isInsolvencyRecordCurrent(b.record) ? ' — current' : ` — ${yearLabel(b.end)}`}
                        </text>
                    </g>
                ))}
                <line x1={0} y1={58} x2={W} y2={58} stroke="var(--rule)" strokeWidth="1" />
                <text x={0} y={56} fill="var(--ink-pale)" style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>{yearLabel(min)}</text>
                <text x={W} y={56} textAnchor="end" fill="var(--ink-pale)" style={{ fontFamily: 'var(--mono)', fontSize: 9 }}>{yearLabel(max)}</text>
            </svg>
            <p className="text-ink-mid mt-1" style={{ fontSize: '11.5px' }}>
                {overlappingCount > 0 ? (
                    <span className="text-crit font-bold">
                        {overlappingCount} directorship{overlappingCount === 1 ? '' : 's'} held during a bankruptcy period
                    </span>
                ) : (
                    'No directorship overlapped a bankruptcy period'
                )}
                {' — '}derived mechanically from dates on file; not a finding that anything was breached.
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

// 19px severity kanji square for company-card flags
const FlagSquare: React.FC<{ tone: 'crit' | 'amber'; glyph: string }> = ({ tone, glyph }) => (
    <span
        aria-hidden="true"
        className={`shrink-0 flex items-center justify-center ${tone === 'crit' ? 'bg-crit' : 'bg-amber'}`}
        style={{ width: 19, height: 19, fontFamily: 'var(--serif)', fontSize: 11, color: 'var(--paper)' }}
    >
        {glyph}
    </span>
);

// Meishi-style company role card (reskin of the previous CompanyRoleCard usage; same data, same click)
const MeishiRoleCard: React.FC<{ result: PersonCompanyResult; onClick: () => void }> = ({ result, onClick }) => {
    const {
        companyName,
        nzbn,
        isDirector,
        shareholding,
        status,
        entityStatusCode,
        isInExternalAdmin,
        externalAdminType,
        removalCommenced,
        hasHistoricInsolvency,
        historicInsolvencyType,
        entityStatusDescription
    } = result;

    const isCompanyRemoved = entityStatusDescription
        ? entityStatusDescription.toLowerCase().includes('removed') || entityStatusDescription.toLowerCase() === 'inactive'
        : (entityStatusCode || 0) >= 80;

    const formatResignationDate = (dateStr?: string): string | null => {
        if (!dateStr) return null;
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null;
            return date.toLocaleDateString();
        } catch {
            return null;
        }
    };

    const resignationDateFormatted = formatResignationDate(result.resignationDate);

    const getDisplayStatus = () => {
        if (isInExternalAdmin && externalAdminType) {
            return externalAdminType.toUpperCase();
        }
        if (entityStatusDescription) {
            return entityStatusDescription.toUpperCase();
        }
        return status;
    };

    const isRegistered = !isInExternalAdmin && !isCompanyRemoved && !removalCommenced && status === 'REGISTERED';

    const isShareholder = shareholding > 0;

    // Roles rendered as separate lines so the % only ever describes the shareholding,
    // never the directorship (a directorship has no %).

    return (
        <div
            onClick={onClick}
            className={`p-4 bg-paper border border-rule hover:border-ink transition-colors cursor-pointer group ${isCompanyRemoved && !isInExternalAdmin ? 'opacity-60 hover:opacity-80' : ''}`}
        >
            {/* Company header */}
            <div className="min-w-0 mb-2">
                <h3
                    className={`font-bold text-ink truncate ${isCompanyRemoved && !isInExternalAdmin ? 'line-through opacity-70' : ''}`}
                    style={{ fontSize: '12.5px' }}
                >
                    {companyName}
                </h3>
                <p className="font-mono text-ink-mid" style={{ fontSize: '10.5px', fontVariantNumeric: 'tabular-nums' }}>
                    NZBN {nzbn}
                </p>
            </div>

            {/* Roles */}
            {(isDirector || isShareholder) && (
                <div className="mb-2 space-y-0.5">
                    {isDirector && (
                        <p className="text-accent" style={{ fontSize: '11px' }}>
                            Director{result.isInactive ? ` · resigned${resignationDateFormatted ? ` ${resignationDateFormatted}` : ''}` : ''}
                        </p>
                    )}
                    {isShareholder && (
                        <p className="text-accent" style={{ fontSize: '11px' }}>
                            Shareholder · {shareholding.toFixed(1)}%
                        </p>
                    )}
                </div>
            )}

            {/* Flags */}
            <div className="space-y-1.5">
                {removalCommenced && !isCompanyRemoved && (
                    <div className="flex items-center gap-2">
                        <FlagSquare tone="amber" glyph="琥" />
                        <span className="text-amber uppercase" style={{ fontSize: '10px', letterSpacing: '.04em' }}>
                            Removal in progress
                        </span>
                    </div>
                )}
                {isCompanyRemoved && hasHistoricInsolvency && (
                    <div className="flex items-center gap-2">
                        <FlagSquare tone="crit" glyph="紅" />
                        <span className="text-crit uppercase" style={{ fontSize: '10px', letterSpacing: '.04em' }}>
                            Prev: {historicInsolvencyType ? historicInsolvencyType.replace(/^in\s+/i, '') : 'Insolvency'}
                        </span>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-rule">
                {isInExternalAdmin ? (
                    <span className="flex items-center gap-2">
                        <FlagSquare tone="crit" glyph="紅" />
                        <span className="text-crit uppercase font-bold" style={{ fontSize: '10px', letterSpacing: '.04em' }}>
                            {getDisplayStatus()}
                        </span>
                    </span>
                ) : (
                    <span
                        className={`uppercase ${isRegistered ? 'text-green' : 'text-ink-pale'}`}
                        style={{ fontSize: '10px', letterSpacing: '.04em' }}
                    >
                        {getDisplayStatus()}
                    </span>
                )}
                <span className="text-ink-pale group-hover:text-accent transition-colors" style={{ fontSize: '10.5px' }}>
                    View org chart →
                </span>
            </div>
        </div>
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
            {/* Header - static masthead, in normal document flow */}
            <div className="p-6 bg-paper border-b border-rule shrink-0">
                <button
                    onClick={onBack}
                    className="mb-4 flex items-center gap-1.5 text-sm text-ink-mid hover:text-ink transition-colors"
                >
                    <ChevronLeft size={16} strokeWidth={1.5} />
                    Back to search
                </button>

                <div className="flex items-end justify-between gap-4 flex-wrap mb-2">
                    <div className="min-w-0">
                        <h2
                            className="text-ink"
                            style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 38, lineHeight: 1.15 }}
                        >
                            {personName}
                        </h2>
                        <p className="text-ink-mid mt-1" style={{ fontSize: '12.5px' }}>
                            {results.length} {results.length === 1 ? 'company' : 'companies'} found
                            {' · '}{directorCount} directorship{directorCount === 1 ? '' : 's'}
                            {' · '}{shareholderCount} shareholding{shareholderCount === 1 ? '' : 's'}
                            {' · '}{activeCount} active
                        </p>
                    </div>
                    <button
                        onClick={() => setShowKyd(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-rule bg-paper text-ink hover:border-ink text-sm font-medium transition-colors"
                    >
                        <span aria-hidden="true" className="text-accent" style={{ fontFamily: 'var(--serif)', fontSize: 15 }}>印</span>
                        KYD Verification
                    </button>
                </div>

                {/* REGISTER CHECKS: one collapsed-by-default strip per register, not a
                    scrolling stack of full cards — a long record list used to push the
                    masthead past the viewport and squeeze the company grid below into a
                    nested-scrollbar mess. A CURRENT record still opens automatically, so
                    the one fact that matters most is never hidden behind a click
                    (design/HANDOVER.md §3e/§4.3/§4.6). */}
                <div className="mt-4 border border-rule">
                    {registersClear && (
                        <div className="flex items-start gap-3 p-3 bg-paper2">
                            <CheckSquare tone="green" glyph="青" />
                            <div className="min-w-0">
                                <p className="font-bold text-ink" style={{ fontSize: '13px' }}>
                                    Register checks · clear
                                </p>
                                <p className="text-ink-mid" style={{ fontSize: '12px' }}>
                                    No records for "{personName}" in the Disqualified Directors or Insolvency registers.
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
                                            <div className="mt-1.5 text-ink-mid" style={{ fontSize: '12px' }}>
                                                <p>
                                                    <span className="text-crit">Type:</span> {record.insolvencyTypeDescription}
                                                </p>
                                                <p>
                                                    <span className="text-crit">Adjudication:</span>{' '}
                                                    {formatDate(record.adjudicationOrLiquidationDate)}
                                                </p>
                                                {record.dischargeOrCompletionDate && (
                                                    <p>
                                                        <span className="text-crit">Discharge/completion:</span>{' '}
                                                        {formatDate(record.dischargeOrCompletionDate)}
                                                        {record.dischargeOrCompletionType ? ` · ${record.dischargeOrCompletionType}` : ''}
                                                    </p>
                                                )}
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
                                                {record.multipleInsolvencies && (
                                                    <p className="text-amber uppercase mt-1" style={{ fontSize: '10px', letterSpacing: '.04em' }}>
                                                        Multiple insolvencies on record
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="p-4 bg-paper2 border-b border-rule flex flex-wrap gap-x-6 gap-y-3 items-center">
                {/* Sort */}
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

                {/* Filter */}
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

            {/* Results Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {paginatedResults.length === 0 ? (
                    <div className="text-center py-12">
                        <Building2 className="mx-auto mb-4 text-ink-pale" size={48} strokeWidth={1.5} />
                        <p className="text-ink-mid">No companies found with selected filters</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {paginatedResults.map((result) => (
                            <MeishiRoleCard
                                key={result.nzbn}
                                result={result}
                                onClick={() => onCompanyClick(result)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-4 bg-paper2 border-t border-rule flex items-center justify-center gap-2">
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
