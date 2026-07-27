// Deterministic memorial analysis for LINZ title reports.
//
// Takes the raw memorial rows returned by /api/property?mode=title and returns
// display-ready events with batch grouping, instrument pairing, durations and
// templated commentary. No model, no network, no dependencies — the commentary
// is assembled from fields, so it states what happened and never why.
//
// Parsing rules verified against 224 real memorials: the tables and regexes
// below encode findings that are not guessable from the LDS schema. Notably:
// instrument numbers come in three vintages, instrument_number is not unique,
// and a PARTIAL discharge must never mark its mortgage as discharged. Run the
// self-check (`npm run check:memorials`) after touching anything here.

// A LINZ instrument number, in all three vintages seen as reference targets:
// letter-prefixed (D651878.3), bare (77413), modern dotted (13653518.1).
const INSTR = String.raw`([A-Z]{0,2}\d+(?:\.\d+)?)`;
const INSTR_ONLY = new RegExp(`^${INSTR}$`, 'i');

// One memorial can name another. The verb says what it did to it — and whether
// the target is finished ("Surrender of Lease 8065536.2") or merely amended
// ("Variation of Lease 8065536.2 and extension of term").
const REFERS_TO = new RegExp(
    '(Discharge of Mortgage|Discharge of Encumbrance|Withdrawal of Caveat' +
    '|Surrender of Lease|Variation of Lease|Partial Surrender of Easement)' +
    `\\s+${INSTR}`, 'i');

const CLOSING_VERBS: Record<string, string> = {
    'discharge of mortgage': 'Discharged',
    'discharge of encumbrance': 'Discharged',
    'withdrawal of caveat': 'Withdrawn',
    'surrender of lease': 'Surrendered',
    'partial surrender of easement': 'Partially surrendered',
};
const REFERENCING_VERBS: Record<string, string> = { 'variation of lease': 'Varied' };

// "Mortgage to X - 8.12.2003", "Encumbrance to X - ...", "Lease to X Term 15 years".
const PARTY = /(?:Mortgage|Encumbrance|Lease|Sublease|Transfer|Charge)\s+to\s+(?:\(now\)\s+)?(.+?)\s+(?:-\s+\d|Term\s)/i;
const CAVEATOR = /CAVEAT\s+BY\s+(.+?)\s+-\s+\d/i;

// instrument_type -> [category, display label]. Category drives colour + filter.
// Anything unlisted falls through to ['other', <the raw type>] — LINZ has a long
// tail of instrument types and new ones appear.
const TYPES: Record<string, [string, string]> = {
    'Mortgage': ['mortgage', 'Mortgage'],
    'Discharge of Mortgage': ['discharge', 'Discharge of Mortgage'],
    'Partial Discharge of Mortgage': ['discharge', 'Partial Discharge'],
    'Transfer': ['transfer', 'Transfer'],
    'Caveat': ['caveat', 'Caveat'],
    'Withdrawal of Caveat': ['discharge', 'Withdrawal of Caveat'],
    'Partial Withdrawal of Caveat': ['discharge', 'Partial Withdrawal of Caveat'],
    'Lease': ['lease', 'Lease'],
    'Variation of Lease': ['lease', 'Variation of Lease'],
    'Surrender of Lease/Licence': ['discharge', 'Surrender of Lease'],
    'Encumbrance': ['other', 'Encumbrance'],
    'Discharge of Encumbrance': ['discharge', 'Discharge of Encumbrance'],
    'Easement Instrument': ['other', 'Easement'],
    'Easement Certificate': ['other', 'Easement Certificate'],
    'Transfer and Grant of Easement': ['transfer', 'Transfer & Easement Grant'],
    'Partial Surrender of Easement': ['other', 'Partial Surrender of Easement'],
    'Departmental Dealing': ['other', 'Departmental Dealing'],
    'Order for New Certificate of Title': ['other', 'Order for New CT'],
    'Memorandum of Priority/Mortgage Priority Instrument': ['other', 'Mortgage Priority'],
};

// Long statutory type names break the card layout; shorten on a prefix match.
const LABEL_PREFIXES: [string, string][] = [
    ['Land Covenant', 'Land Covenant'],
    ['Consent Notice', 'Consent Notice'],
    ['Building Act 2004', 'Building Act Certificate'],
];

// Standing burdens on the land — easements, covenants, statutory conditions.
// They sit on the title indefinitely rather than happening at a moment, so a
// chronology is the wrong shape for them.
const BURDEN_TYPES = new Set([
    'Easement Instrument', 'Easement Certificate', 'Transfer and Grant of Easement',
    'Partial Surrender of Easement', 'Order for New Certificate of Title',
    'Memorandum of Priority/Mortgage Priority Instrument',
]);
const BURDEN_PREFIXES = ['Land Covenant', 'Consent Notice', 'Building Act 2004'];

// A companion memorial that only records that another instrument is subject to
// s243(a) RMA. It carries no separate interest, so it folds into its parent's
// card rather than taking a row of its own. Both alternatives are anchored:
// these patterns stand in for Python's re.match(), which only matches at pos 0.
const S243_NOTATION = /^The easements? created by [^\n]*?\bis|^The easements? created by/i;
const S243_TARGET = new RegExp(`Easement Instrument\\s+${INSTR}`, 'i');

// What an easement actually does, in the register's own words. Ordered: the
// first match wins, so the more specific phrasings come first.
const EASEMENT_KINDS: [RegExp, string][] = [
    [/party wall/i, 'Party Wall Easement'],
    [/right of way \(pedestrian[^)]*\)/i, 'Pedestrian Right of Way'],
    [/right of way \(waste[^)]*\)/i, 'Waste Collection Right of Way'],
    [/right of way/i, 'Right of Way'],
    [/convey electricity/i, 'Electricity Easement'],
    [/convey telecommunications(?: and computer data)?/i, 'Telecommunications Easement'],
    [/convey gas/i, 'Gas Easement'],
    [/convey water/i, 'Water Easement'],
    [/drain (?:sewage and water|sewage|water)/i, 'Drainage Easement'],
    [/structural support/i, 'Structural Support Easement'],
    [/fire (?:protection|egress)/i, 'Fire Services Easement'],
    [/stormwater/i, 'Stormwater Easement'],
];

// "in favour of Vector Limited created by ...". Utility easements name their
// holder this way rather than with the "to X" the lending instruments use.
const IN_FAVOUR_OF = /in favour of\s+(.+?)\s+(?:created|specified|contained|-\s+\d)/i;
// Which side of the easement this row records. Anchored — see S243_NOTATION.
const APPURTENANT = /^(?:\s*Appurtenant|is a\b)/i;
const SERVIENT = /^\s*Subject to/i;

const BANKS = [
    'asb', 'anz', 'bnz', 'bank of new zealand', 'westpac', 'kiwibank', 'tsb',
    'national bank', 'co-operative bank', 'southland building society', 'sbs',
    'heartland', 'kookmin', 'hsbc', 'rabobank', 'public trust', 'nzcu',
    'hong kong and shanghai banking', 'commonwealth bank',
];

// LINZ uses 1.1.1870 / 1.1.1860 as a sentinel on carried-forward memorials that
// predate the electronic register. Real, but not a real date.
const SENTINEL_YEAR = 1900;

// A subdivision registers a dozen-plus instruments at once. Linking every one
// to every other turns each card into a wall of links, so show a handful and
// count the rest.
const MAX_BATCH_LINKS = 4;

/** A raw memorial row as LDS returns it. */
export interface MemorialRow {
    id: number;
    instrument_number?: string | null;
    instrument_type?: string | null;
    instrument_lodged_datetime?: string | null;
    memorial_text?: string | null;
    encumbrancees?: string | null;
    current?: boolean;
}

export interface RelatedEvent {
    target: MemorialEvent;
    relation: string;
}

export interface MemorialEvent {
    id: string;
    row_id: number;
    headline: string;
    instrument: string | null;
    date: Date | null;
    undated: boolean;
    type: string;
    label: string;
    category: string;
    partial: boolean;
    party: string | null;
    batch: string | null;
    current: boolean;
    text: string;
    notation: boolean;
    notation_of: string | null;
    refers_verb: string | null;
    refers_to: string | null;
    related: RelatedEvent[];
    closes?: MemorialEvent;
    closed_by?: MemorialEvent;
    duration_months?: number;
    duration_days?: number;
    notations?: string[];
    folded?: boolean;
    batch_size?: number;
    batch_hidden?: number;
    kind: string;
    burden: boolean;
    commentary: string;
}

function toDate(row: MemorialRow): Date | null {
    const raw = row.instrument_lodged_datetime;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

function labelFor(rawType: string): [string, string] {
    if (rawType in TYPES) return TYPES[rawType];
    for (const [prefix, short] of LABEL_PREFIXES) {
        if (rawType.startsWith(prefix)) return ['other', short];
    }
    return ['other', rawType || 'Memorial'];
}

/**
 * Who the memorial runs to. `encumbrancees` is only populated on current rows,
 * so the text is the primary source and the field is the fallback.
 */
function partyOf(row: MemorialRow): string | null {
    const text = row.memorial_text || '';
    for (const pattern of [PARTY, CAVEATOR, IN_FAVOUR_OF]) {
        const m = pattern.exec(text);
        if (m) return m[1].trim();
    }
    return row.encumbrancees ?? null;
}

/**
 * Instruments sharing a prefix were registered together (settlement, refinance,
 * subdivision). Guard the sentinel values — instrument_number is not always a
 * number ('REDUCED LEVEL', 'DEFAULTWS').
 */
function batchOf(row: MemorialRow): string | null {
    const instr = (row.instrument_number || '').trim();
    const head = instr.split('.')[0];
    return INSTR_ONLY.test(head) ? head : null;
}

export function isInstitutional(party: string | null): boolean {
    if (!party) return false;
    const lower = party.toLowerCase();
    return BANKS.some(b => lower.includes(b));
}

/**
 * What the card is called. A register full of rows all headed 'Easement' is
 * unreadable, so name what the instrument actually does.
 */
function headlineFor(row: MemorialRow, label: string, party: string | null): string {
    const text = row.memorial_text || '';
    const rawType = row.instrument_type || '';

    if (rawType.includes('Easement') || text.toLowerCase().includes('easement')) {
        const found = EASEMENT_KINDS.find(([pattern]) => pattern.test(text));
        if (found) {
            const kind = found[1];
            const m = IN_FAVOUR_OF.exec(text);
            const holder = m ? m[1].trim() : null;
            let side = '';
            if (SERVIENT.test(text)) side = ' (burdening)';
            else if (APPURTENANT.test(text)) side = ' (benefiting)';
            return holder ? `${holder} — ${kind}${side}` : `${kind}${side}`;
        }
    }

    if (rawType.startsWith('Land Covenant')) return 'Land Covenant';
    if (rawType.startsWith('Consent Notice')) return 'Consent Notice (RMA s221)';
    if (rawType.startsWith('Building Act')) return 'Building Act Certificate';
    if (text.includes('Fencing')) return 'Fencing Covenant';
    if (rawType === 'Order for New Certificate of Title') {
        // LINZ files carried-forward memorials under this type; the text says
        // what it really is.
        if (text.includes('Mortgage to')) {
            return party ? `${party} — Mortgage (carried forward)` : 'Mortgage (carried forward)';
        }
        if (text.includes('Section 241(2)')) return 'Subdivision — Order for New Certificate of Title';
        return 'Order for New Certificate of Title';
    }

    return party ? `${party} — ${label}` : label;
}

const MS_PER_DAY = 86_400_000;

/** Whole days between two instants, floored — Python's timedelta.days. */
function daysBetween(start: Date, end: Date): number {
    return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
}

/**
 * Python's round() is half-to-even, and this feeds a duration shown to users.
 * Matching it keeps the TS and Python reports identical on the .5 boundary.
 */
function roundHalfEven(value: number): number {
    const floor = Math.floor(value);
    const diff = value - floor;
    if (diff > 0.5) return floor + 1;
    if (diff < 0.5) return floor;
    return floor % 2 === 0 ? floor : floor + 1;
}

function monthsBetween(start: Date, end: Date): number {
    return roundHalfEven(daysBetween(start, end) / 30.44);
}

/** 'A standing interest rather than a transaction.' */
function isBurden(e: MemorialEvent): boolean {
    // Anything that got paired stays a transaction no matter its type: an
    // encumbrance with a matching discharge has a start and an end, and
    // splitting it from its own discharge would break the pair the reader
    // came for.
    if (e.closes || e.closed_by) return false;
    const raw = e.type;
    return BURDEN_TYPES.has(raw)
        || BURDEN_PREFIXES.some(p => raw.startsWith(p))
        || (!raw && e.current);
}

/** Wire each memorial to the instrument it names, both ways. */
function pair(events: MemorialEvent[]): void {
    const byInstrument = new Map<string, MemorialEvent>();
    for (const e of events) {
        // First occurrence wins: the original registration, not a later re-entry.
        if (e.instrument && !byInstrument.has(e.instrument)) byInstrument.set(e.instrument, e);
    }

    for (const e of events) {
        const target = e.refers_to ? byInstrument.get(e.refers_to) : undefined;
        if (!target || target === e) continue;
        const verb = e.refers_verb || '';
        const closing = verb in CLOSING_VERBS;
        const relation = CLOSING_VERBS[verb] || REFERENCING_VERBS[verb] || 'Referenced';
        e.closes = target;
        // A partial discharge releases part of the security; the original
        // instrument stays on the title. So does a variation.
        if (closing && !e.partial) target.closed_by = e;
        if (target.date && e.date && !target.undated) {
            const months = monthsBetween(target.date, e.date);
            e.duration_months = target.duration_months = months;
            const days = daysBetween(target.date, e.date);
            e.duration_days = target.duration_days = days;
        }
        e.related.push({ target, relation: 'Original instrument' });
        target.related.push({ target: e, relation });
        // A bare "Partial Discharge" says nothing; name whose interest it ends.
        if (target.party && !e.headline.includes(' — ')) {
            e.headline = `${target.party} — ${e.label}`;
        }
    }
}

/**
 * Attach each s243(a) RMA notation to the easement it qualifies.
 *
 * On a subdivision title these double the card count while saying nothing the
 * parent card doesn't already imply. Folded rows are dropped from the timeline
 * but their text is preserved on the parent, so nothing is hidden.
 */
function foldNotations(events: MemorialEvent[]): void {
    const byInstrument = new Map<string, MemorialEvent[]>();
    for (const e of events) {
        if (e.notation) continue;
        const key = e.instrument || '';
        if (!byInstrument.has(key)) byInstrument.set(key, []);
        byInstrument.get(key)!.push(e);
    }
    for (const e of events) {
        if (!e.notation) continue;
        const target = e.notation_of || e.instrument || '';
        const parents = byInstrument.get(target);
        if (!parents || parents.length === 0) continue;  // orphan: leave it visible
        const parent = parents[0];
        if (!parent.notations) parent.notations = [];
        parent.notations.push(e.text);
        e.folded = true;
    }
}

function linkBatches(events: MemorialEvent[]): void {
    const batches = new Map<string, MemorialEvent[]>();
    for (const e of events) {
        if (!e.batch || e.folded) continue;
        if (!batches.has(e.batch)) batches.set(e.batch, []);
        batches.get(e.batch)!.push(e);
    }
    for (const members of batches.values()) {
        if (members.length < 2) continue;
        for (const e of members) {
            const already = new Set(e.related.map(r => r.target));
            const siblings = members.filter(o => o !== e && !already.has(o));
            for (const other of siblings.slice(0, MAX_BATCH_LINKS)) {
                e.related.push({ target: other, relation: 'Same batch' });
            }
            e.batch_size = members.length;
            e.batch_hidden = Math.max(0, siblings.length - MAX_BATCH_LINKS);
        }
    }
}

/** '9 days' reads honestly where '~0 months' does not. */
export function heldFor(e: MemorialEvent): string {
    const days = e.duration_days;
    if (days === undefined) return '';
    if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
    return `~${e.duration_months} months`;
}

/**
 * The bucket this memorial belongs to when summarising current interests.
 *
 * Not the instrument type: a fencing covenant is registered as a Transfer, and
 * grouping by type would file it under 'Transfer ×3'.
 */
function kindOf(e: MemorialEvent): string {
    const head = e.headline;
    if (head.startsWith('Fencing Covenant')) return 'Fencing Covenant';
    if (head.includes('Easement') || head.includes('Right of Way')) return 'Easement';
    if (head.startsWith('Land Covenant')) return 'Land Covenant';
    if (head.startsWith('Consent Notice')) return 'Consent Notice';
    if (head.startsWith('Building Act')) return 'Building Act Certificate';
    return e.label;
}

/** Facts assembled from fields. States what happened, never why. */
function commentaryFor(e: MemorialEvent): string {
    const party = e.party;
    const named = party || 'an unnamed party';
    const siblings = (e.batch_size ?? 1) - 1;
    const batchNote = siblings > 0
        ? ` Registered alongside ${siblings} other instrument${siblings > 1 ? 's' : ''} in the same batch.`
        : '';
    const closer = e.closed_by;

    if (e.category === 'mortgage') {
        const lender = isInstitutional(party) ? 'institutional' : 'private';
        let out = `Mortgage to ${named} (${lender} lender).`;
        if (closer) out += ` Discharged after ${heldFor(e)}.`;
        else if (e.current) out += ' Still registered against the title.';
        return out + batchNote;
    }

    if (e.category === 'lease' && e.label === 'Lease') {
        let out = party ? `Lease to ${named}.` : 'Lease registered against the title.';
        if (closer) out += ` Surrendered after ${heldFor(e)}.`;
        else if (e.current) out += ' Still registered.';
        return out + batchNote;
    }

    if (e.category === 'discharge' && e.closes) {
        const target = e.closes;
        const held = e.duration_days !== undefined ? ` held ${heldFor(e)}` : '';
        const targetParty = target.party || 'an unnamed party';
        const verb = e.refers_verb || '';
        if (verb === 'withdrawal of caveat') {
            const action = e.partial ? 'Partially withdraws' : 'Withdraws';
            return `${action} the caveat lodged by ${targetParty} `
                + `(${target.instrument}),${held || ' held'}.${batchNote}`;
        }
        if (verb === 'surrender of lease') {
            return `Surrenders the lease ${target.instrument}`
                + `${target.party ? ` to ${targetParty}` : ''},${held || ' held'}.`
                + `${batchNote}`;
        }
        const action = e.partial ? 'Partially discharges' : 'Discharges';
        const noun = verb.includes('encumbrance') ? 'encumbrance' : 'mortgage';
        return `${action} the ${noun} ${target.instrument}`
            + `${target.party ? ` to ${targetParty}` : ''},${held || ' held'}.`
            + `${batchNote}`;
    }

    if (e.category === 'transfer' && party) {
        return `Ownership transferred to ${party}.${batchNote}`;
    }

    if (e.category === 'caveat') {
        const state = closer
            ? `Withdrawn after ${heldFor(e)}`
            : (e.current ? 'Still registered' : 'No longer current');
        return `Caveat lodged by ${named}. ${state}.${batchNote}`;
    }

    const partyNote = party ? ` to ${party}` : '';
    const state = e.current ? ' Still current.' : '';
    // `kind`, not `label`: a fencing covenant is filed as a Transfer, and saying
    // "Transfer registered against the title" describes the wrong thing.
    return `${e.kind}${partyNote} registered against the title.${state}${batchNote}`;
}

/** Rows in, display-ready events out, oldest first. */
export function analyse(rows: MemorialRow[]): MemorialEvent[] {
    const events: MemorialEvent[] = rows.map(row => {
        const text = row.memorial_text || '';
        const rawType = row.instrument_type || '';
        const [category, label] = labelFor(rawType);
        const ref = REFERS_TO.exec(text);
        const date = toDate(row);
        const party = partyOf(row);
        const notation = S243_NOTATION.test(text.trim());
        const notationTarget = notation ? S243_TARGET.exec(text) : null;
        return {
            headline: headlineFor(row, label, party),
            notation,
            notation_of: notationTarget ? notationTarget[1] : null,
            id: `ev-${row.id}`,          // row id, NOT instrument_number:
            row_id: row.id,              // the same instrument can appear
            instrument: row.instrument_number ?? null,  // on several rows.
            date,
            undated: !!date && date.getUTCFullYear() < SENTINEL_YEAR,
            type: rawType,
            label,
            category,
            partial: rawType.toLowerCase().startsWith('partial'),
            party,
            batch: batchOf(row),
            current: !!row.current,
            text,
            refers_verb: ref ? ref[1].toLowerCase() : null,
            refers_to: ref ? ref[2] : null,
            related: [],
            // Filled in below; declared here so the object is complete.
            kind: '',
            burden: false,
            commentary: '',
        };
    });

    // Undated rows sort last, keeping their original order (stable sort).
    events.sort((a, b) => {
        if (a.date === null && b.date === null) return 0;
        if (a.date === null) return 1;
        if (b.date === null) return -1;
        return a.date.getTime() - b.date.getTime();
    });

    pair(events);
    foldNotations(events);
    linkBatches(events);
    for (const e of events) {
        // Never link to a card that folding removed from the page.
        e.related = e.related.filter(r => !r.target.folded);
        e.kind = kindOf(e);          // commentary reads this
        e.burden = isBurden(e);
        e.commentary = commentaryFor(e);
    }
    // Folded rows stay in the list so callers can still count and verify every
    // source memorial; the renderer drops them from the timeline.
    return events;
}

export function visible(events: MemorialEvent[]): MemorialEvent[] {
    return events.filter(e => !e.folded);
}
