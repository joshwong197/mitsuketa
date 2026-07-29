// Title report view model — one derivation, three consumers.
//
// The React report (components/PropertyReport.tsx), the standalone HTML export
// (services/exportService.ts) and the CLI (utils/property.cli.ts) must all say
// the same thing about a title, so the shaping happens here rather than in any
// of them. Pure, browser-safe, no network: utils/lds.ts is server-only and must
// never reach the bundle, so the display helpers that used to live there were
// moved here and lds.ts re-exports them.
//
// Everything below is derived from register fields. No interpretation is added
// and none should be — the report's disclaimer promises exactly that, and it is
// the reason the output is defensible.
import { analyse, visible, type MemorialEvent, type MemorialRow } from './memorials.js';

export interface TitleReportData {
    title: Record<string, any> | null;
    owners: Record<string, any>[];
    memorials: MemorialRow[];
    estates: Record<string, any>[];
    address: string | null;
}

// --------------------------------------------------------------------------- //
// Owners and estates (moved from utils/lds.ts — see header)
// --------------------------------------------------------------------------- //

export function ownerName(owner: Record<string, any>): string {
    if (owner.corporate_name) return owner.corporate_name;
    const parts = [owner.prime_other_names, owner.prime_surname].filter(Boolean);
    return parts.join(' ') || 'Unnamed owner';
}

/**
 * Collapse LDS's one-row-per-estate owners into one entry per person.
 *
 * A couple owning two estates comes back as four rows; rendering that as four
 * cards is the single worst piece of clutter on a subdivision title.
 */
export function groupOwners(owners: Record<string, any>[],
                            estates: Record<string, any>[] = []): Record<string, any>[] {
    const estateById = new Map(estates.filter(e => e.id).map(e => [e.id, e]));
    const grouped = new Map<string, Record<string, any>>();
    for (const owner of owners) {
        const name = ownerName(owner);
        const key = `${name.toLowerCase()}${owner.owner_type ?? ''}`;
        let entry = grouped.get(key);
        if (!entry) {
            entry = {
                name,
                owner_type: owner.owner_type ?? null,
                corporate: !!owner.corporate_name,
                status: owner.status ?? null,
                shares: [] as string[],
                estates: [] as Record<string, any>[],
            };
            grouped.set(key, entry);
        }
        const share = owner.estate_share;
        if (share && !entry.shares.includes(share)) entry.shares.push(share);
        const est = estateById.get(owner.tte_id);
        if (est && !entry.estates.includes(est)) entry.estates.push(est);
    }
    return [...grouped.values()];
}

/** 'Fee Simple, 1/1, Lot 33 DP 532614, 190 m²' — the register's own shape. */
export function estateLine(estate: Record<string, any>): string {
    const legal = String(estate.legal_description ?? '').replace(/Deposited Plan/g, 'DP');
    const area = estate.area;
    const bits = [estate.type, estate.share, legal || null];
    if (area) {
        const n = Number(area);
        if (Number.isFinite(n)) bits.push(`${n.toLocaleString('en-NZ')} m²`);
    }
    return bits.filter(Boolean).join(', ');
}

/** Two initials for the owner avatar. 'Norak Properties Limited' -> 'NP'. */
export function initialsOf(name: string): string {
    const words = name.split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w));
    // Company suffixes carry no identity — 'Norak Properties Limited' is NP.
    const SUFFIX = /^(limited|ltd|incorporated|inc|trustee|trustees|company|co|nz|holdings?)$/i;
    const meaningful = words.filter(w => !SUFFIX.test(w.replace(/[^A-Za-z]/g, '')));
    const source = meaningful.length > 0 ? meaningful : words;
    return source.slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '—';
}

// --------------------------------------------------------------------------- //
// Formatting
// --------------------------------------------------------------------------- //

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '13 Sep 1999'. UTC throughout — lodgement dates are register facts. */
export function formatDate(d: Date | null, undated = false): string {
    if (!d) return '—';
    if (undated) return `${d.getUTCFullYear()}?`;
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Sentinel-dated memorials carry no real year, so they group under 'Undated'. */
export function yearOf(e: MemorialEvent): string {
    if (!e.date) return 'Undated';
    return e.undated ? 'Undated' : String(e.date.getUTCFullYear());
}

const AREA_FIELDS = ['area', 'land_area', 'total_area'];

/** '8,377 m²' from whichever area field the estate rows carry. */
export function areaOf(estates: Record<string, any>[]): string | null {
    let total = 0;
    for (const e of estates) {
        for (const f of AREA_FIELDS) {
            const n = Number(e[f]);
            if (Number.isFinite(n) && n > 0) { total += n; break; }
        }
    }
    return total > 0 ? `${Math.round(total).toLocaleString('en-NZ')} m²` : null;
}

// --------------------------------------------------------------------------- //
// Category marks — shared by the React view and the HTML export
// --------------------------------------------------------------------------- //

export type Tone = 'accent' | 'green' | 'amber' | 'ink' | 'wash';

export interface Mark { glyph: string; tone: Tone }

/**
 * The kanji square for one memorial. Colour encodes what kind of interest it is
 * and whether it is still live — never severity, so --crit is not in this table.
 */
export function markFor(e: MemorialEvent): Mark {
    if (e.burden) {
        if (e.kind.includes('Easement') || e.kind.includes('Right of Way')) {
            return { glyph: '役', tone: 'wash' };    // 地役権 — easement
        }
        if (e.kind.includes('Covenant') || e.kind.includes('Consent Notice')) {
            return { glyph: '約', tone: 'wash' };    // 約款 — covenant
        }
        return { glyph: '他', tone: 'wash' };
    }
    switch (e.category) {
        case 'mortgage':  return { glyph: '抵', tone: e.current ? 'accent' : 'wash' };
        case 'discharge': return { glyph: '済', tone: 'green' };
        case 'transfer':  return { glyph: '譲', tone: 'ink' };
        case 'caveat':    return { glyph: '警', tone: e.current ? 'amber' : 'wash' };
        case 'lease':     return { glyph: '借', tone: e.current ? 'accent' : 'wash' };
        default:          return { glyph: '他', tone: 'wash' };
    }
}

/** How the closing instrument finished this interest, in past tense. */
export function closedVerb(e: MemorialEvent): string {
    const label = e.closed_by?.label ?? '';
    if (label.includes('Withdrawal')) return 'Withdrawn';
    if (label.includes('Surrender')) return 'Surrendered';
    return 'Discharged';
}

// --------------------------------------------------------------------------- //
// Filters
// --------------------------------------------------------------------------- //

export type FilterKey =
    'all' | 'live' | 'mortgage' | 'discharge' | 'transfer' | 'caveat' | 'lease' | 'burden' | 'other';

/** Which filter bucket a memorial answers to. Burdens win over their category. */
export function filterKeyOf(e: MemorialEvent): FilterKey {
    if (e.burden) return 'burden';
    switch (e.category) {
        case 'mortgage': case 'discharge': case 'transfer': case 'caveat': case 'lease':
            return e.category;
        default: return 'other';
    }
}

export const FILTER_LABELS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'live', label: 'Live' },
    { key: 'mortgage', label: 'Mortgages' },
    { key: 'discharge', label: 'Discharges' },
    { key: 'transfer', label: 'Transfers' },
    { key: 'caveat', label: 'Caveats' },
    { key: 'lease', label: 'Leases' },
    { key: 'burden', label: 'Burdens' },
    { key: 'other', label: 'Other' },
];

export function matchesFilter(e: MemorialEvent, key: FilterKey): boolean {
    if (key === 'all') return true;
    if (key === 'live') return e.current;
    return filterKeyOf(e) === key;
}

// --------------------------------------------------------------------------- //
// View model
// --------------------------------------------------------------------------- //

export interface TitleFact { label: string; value: string; mono?: boolean }

export interface OwnerCard {
    name: string;
    initials: string;
    corporate: boolean;
    shares: string[];
    estateLines: string[];
    status: string | null;
}

export interface TitleView {
    titleNo: string;
    /** type · status · land district, whichever the register supplied. */
    meta: string;
    status: string | null;
    address: string | null;
    facts: TitleFact[];
    owners: OwnerCard[];
    /** Everything still registered — the answer to "what is on this title now". */
    live: MemorialEvent[];
    /** Dated dealings, oldest first. Burdens are not in here. */
    chronology: MemorialEvent[];
    /** Standing burdens: easements, covenants, statutory conditions. */
    burdens: MemorialEvent[];
    /** All visible events, for filter counts and the export. */
    all: MemorialEvent[];
    counts: Record<FilterKey, number>;
}

export function buildTitleView(report: TitleReportData): TitleView {
    const events = visible(analyse(report.memorials));
    const title = report.title ?? {};
    const estates = report.estates ?? [];

    const burdens = events.filter(e => e.burden);
    const chronology = events.filter(e => !e.burden);
    // Live means still registered, burden or not — a right of way that binds the
    // land matters to a buyer exactly as much as an undischarged mortgage.
    const live = events.filter(e => e.current);

    const counts = {} as Record<FilterKey, number>;
    for (const { key } of FILTER_LABELS) {
        counts[key] = events.filter(e => matchesFilter(e, key)).length;
    }

    const owners: OwnerCard[] = groupOwners(report.owners ?? [], estates).map(o => ({
        name: o.name,
        initials: initialsOf(o.name),
        corporate: !!o.corporate,
        shares: o.shares ?? [],
        estateLines: (o.estates ?? []).map(estateLine).filter(Boolean),
        status: o.status ?? null,
    }));

    // Legal description comes off the estate rows, which is also where area and
    // share live — the title row itself does not carry them.
    const legal = estates.map(estateLine).filter(Boolean);
    const area = areaOf(estates);
    const issued = title.issue_date ? new Date(title.issue_date) : null;

    const facts: TitleFact[] = [
        { label: 'Street address', value: report.address ?? '—' },
        { label: 'Title number', value: title.title_no ?? '—', mono: true },
        { label: 'Title type', value: title.type ?? title.register_type ?? '—' },
        { label: 'Status', value: title.status ?? '—' },
        { label: 'Land district', value: title.land_district ?? '—' },
        { label: 'Legal description', value: legal.join(' · ') || '—' },
        { label: 'Area', value: area ?? '—' },
        { label: 'Guarantee status', value: title.guarantee_status ?? '—' },
        {
            label: 'Issue date',
            value: issued && !isNaN(issued.getTime()) ? formatDate(issued) : '—',
            mono: true,
        },
    ];
    if (title.maori_land) {
        facts.push({ label: 'Māori land', value: String(title.maori_land) });
    }
    if (title.survey_reference) {
        facts.push({ label: 'Survey reference', value: String(title.survey_reference), mono: true });
    }

    return {
        titleNo: title.title_no ?? '—',
        meta: [title.type, title.status, title.land_district].filter(Boolean).join(' · '),
        status: title.status ?? null,
        address: report.address ?? null,
        facts,
        owners,
        live,
        chronology,
        burdens,
        all: events,
        counts,
    };
}
