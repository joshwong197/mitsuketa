// LINZ Data Service (LDS) access — WFS client, CQL helpers, dataset IDs, geometry.
//
// Server-side only: LDSClient reads LINZ_API_KEY, and the titles/owners/memorials
// layers are RESTRICTED personal data under the LINZ Licence for Personal Data.
// Never import this into browser code — see api/property.ts for the gated entry.
//
// All requests ask for GeoJSON in EPSG:4326 (lon/lat) so the geometry helpers can
// work in a single axis order without worrying about NZTM.
//
// The geometry here replaces the reference implementation's shapely dependency:
// it needed exactly four operations, all of which are a few lines of arithmetic.
// containsPoint MUST include the boundary — an address sitting exactly on a
// title edge still belongs to that title.
import type { MemorialRow } from './memorials.js';

const LDS_HOST = 'https://data.linz.govt.nz';
const WFS_VERSION = '2.0.0';
const DEFAULT_SRS = 'EPSG:4326';
const MAX_COUNT_PER_REQUEST = 10000;

// --- Datasets. Ids from the LINZ data dictionary (linz/linz-lds-bde-schema). ---
export const TITLES_OWNERS_LAYER = 'layer-50805';   // NZ Property Titles Including Owners (RESTRICTED)
export const ADDRESSES_LAYER = 'layer-123113';      // NZ Addresses
export const ESTATES_TABLE = 'table-51566';         // NZ Property Title Estates List
export const OWNERS_TABLE = 'table-51564';          // NZ Property Title Owners List (RESTRICTED)
export const MEMORIALS_TABLE = 'table-51695';       // NZ Title Memorials List (RESTRICTED)
const GEOMETRY_COLUMN = 'shape';

const TITLE_COLUMNS = [
    'id', 'title_no', 'status', 'register_type', 'type', 'land_district',
    'issue_date', 'guarantee_status', 'provisional', 'title_no_srs',
    'title_no_head_srs', 'survey_reference', 'maori_land', 'number_owners',
];
export const ADDRESS_COLUMNS = [
    'address_id', 'full_address', 'full_road_name', 'suburb_locality',
    'town_city', 'territorial_authority',
];

export class LDSError extends Error {}

// --------------------------------------------------------------------------- //
// CQL
// --------------------------------------------------------------------------- //

/** Escape a string literal for a CQL filter. CQL doubles single quotes. */
export function cqlQuote(value: string): string {
    return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Substring LIKE/ILIKE, wildcarded both ends, with the term's own wildcards
 * escaped so user input can't widen the query.
 */
export function cqlLike(column: string, term: string, caseInsensitive = true): string {
    const op = caseInsensitive ? 'ILIKE' : 'LIKE';
    const safe = String(term)
        .replace(/'/g, "''")
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
    return `${column} ${op} '%${safe}%'`;
}

export function cqlIn(column: string, values: string[]): string {
    return `${column} IN (${values.map(cqlQuote).join(', ')})`;
}

/** LDS WFS 2.0.0 with EPSG:4326 expects bbox as (miny, minx, maxy, maxx). */
export function cqlBbox(minx: number, miny: number, maxx: number, maxy: number,
                        geomCol = GEOMETRY_COLUMN): string {
    return `bbox(${geomCol},${miny},${minx},${maxy},${maxx})`;
}

// --------------------------------------------------------------------------- //
// Geometry
// --------------------------------------------------------------------------- //

export interface GeoJsonGeometry {
    type: string;
    coordinates: any;
}
export interface Feature {
    geometry?: GeoJsonGeometry | null;
    properties?: Record<string, any>;
}

export function geomOf(feature: Feature): GeoJsonGeometry | null {
    const g = feature.geometry;
    if (!g || !g.type || !g.coordinates) return null;
    return g;
}

/** Every [lon, lat] pair in a geometry, at any nesting depth. */
function coordsOf(geom: GeoJsonGeometry): [number, number][] {
    const out: [number, number][] = [];
    const walk = (node: any) => {
        if (!Array.isArray(node)) return;
        if (typeof node[0] === 'number' && typeof node[1] === 'number') {
            out.push([node[0], node[1]]);
            return;
        }
        for (const child of node) walk(child);
    };
    walk(geom.coordinates);
    return out;
}

export function bboxOf(geom: GeoJsonGeometry): [number, number, number, number] {
    const pts = coordsOf(geom);
    if (pts.length === 0) throw new LDSError('empty geometry has no bounds');
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const [x, y] of pts) {
        if (x < minx) minx = x;
        if (y < miny) miny = y;
        if (x > maxx) maxx = x;
        if (y > maxy) maxy = y;
    }
    return [minx, miny, maxx, maxy];
}

export function isEmptyGeom(geom: GeoJsonGeometry | null): boolean {
    return !geom || coordsOf(geom).length === 0;
}

/** The polygon rings of a geometry: [outer, ...holes] per polygon. */
function polygonsOf(geom: GeoJsonGeometry): [number, number][][][] {
    if (geom.type === 'Polygon') return [geom.coordinates as [number, number][][]];
    if (geom.type === 'MultiPolygon') return geom.coordinates as [number, number][][][];
    return [];
}

/**
 * Area centroid, matching shapely's .centroid — NOT the mean of the vertices.
 * Holes subtract, so a ring-shaped title centroids outside its own material.
 * Falls back to the coordinate mean for points and lines, which have no area.
 *
 * The shoelace sums run in coordinates shifted to a local origin. Straight from
 * lon/lat they lose most of their significant digits: at NZ latitudes the
 * products x*y are around 6,450 while their differences are around 1e-7, so
 * subtracting them directly cancels away the answer. A real parcel came out
 * ~2 metres off before the shift.
 */
export function centroidOf(geom: GeoJsonGeometry): [number, number] {
    if (geom.type === 'Point') {
        const [x, y] = geom.coordinates as [number, number];
        return [x, y];
    }
    const pts = coordsOf(geom);
    if (pts.length === 0) throw new LDSError('empty geometry has no centroid');
    const [ox, oy] = pts[0];

    let area2 = 0, cx = 0, cy = 0;
    for (const rings of polygonsOf(geom)) {
        // A hole's ring winds against the outer ring, so its contribution is
        // already negative and plain summing subtracts it.
        for (const ring of rings) {
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const xj = ring[j][0] - ox, yj = ring[j][1] - oy;
                const xi = ring[i][0] - ox, yi = ring[i][1] - oy;
                const cross = (xj * yi) - (xi * yj);
                area2 += cross;
                cx += (xj + xi) * cross;
                cy += (yj + yi) * cross;
            }
        }
    }
    if (area2 !== 0) return [ox + cx / (3 * area2), oy + cy / (3 * area2)];
    return [
        pts.reduce((s, p) => s + p[0], 0) / pts.length,
        pts.reduce((s, p) => s + p[1], 0) / pts.length,
    ];
}

// Degrees. At NZ latitudes 1e-9 deg is well under a millimetre, so this only
// absorbs floating-point noise, never a real gap between adjacent titles.
const EDGE_EPSILON = 1e-9;

/** Is (x, y) on the segment a-b, within EDGE_EPSILON? */
function onSegment(x: number, y: number,
                   a: [number, number], b: [number, number]): boolean {
    const [ax, ay] = a, [bx, by] = b;
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) return Math.hypot(x - ax, y - ay) <= EDGE_EPSILON;
    if (Math.abs(cross) / len > EDGE_EPSILON) return false;
    // Collinear — now check it falls between the endpoints.
    const dot = (x - ax) * (bx - ax) + (y - ay) * (by - ay);
    return dot >= -EDGE_EPSILON * len && dot <= len * len + EDGE_EPSILON * len;
}

function onRing(x: number, y: number, ring: [number, number][]): boolean {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        if (onSegment(x, y, ring[j], ring[i])) return true;
    }
    return false;
}

/** Ray-cast crossing count — strict interior, boundary handled separately. */
function inRing(x: number, y: number, ring: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y)) {
            const xCross = xi + ((y - yi) / (yj - yi)) * (xj - xi);
            if (x < xCross) inside = !inside;
        }
    }
    return inside;
}

/**
 * Does this polygon cover the point? Equivalent to shapely's covers(): the
 * boundary counts as covered, including the edge of a hole. An address sitting
 * exactly on a title edge should still resolve to that title.
 */
export function containsPoint(geom: GeoJsonGeometry, lon: number, lat: number): boolean {
    for (const rings of polygonsOf(geom)) {
        if (rings.length === 0) continue;
        // On any ring — outer or hole — is on the polygon's boundary.
        if (rings.some(ring => onRing(lon, lat, ring))) return true;
        if (!inRing(lon, lat, rings[0])) continue;
        const inHole = rings.slice(1).some(hole => inRing(lon, lat, hole));
        if (!inHole) return true;
    }
    return false;
}

/**
 * Candidates whose geometry the polygon covers.
 *
 * ponytail: only ever called with the address layer, which is points, so a
 * point test is enough. Widen to a real geometry-covers test if this is ever
 * pointed at polygons.
 */
export function featuresWithin(polygon: GeoJsonGeometry, candidates: Feature[]): Feature[] {
    return candidates.filter(feat => {
        const g = geomOf(feat);
        if (!g) return false;
        const pts = coordsOf(g);
        return pts.length > 0 && pts.every(([x, y]) => containsPoint(polygon, x, y));
    });
}

export function props(features: Feature[]): Record<string, any>[] {
    return features.map(f => f.properties ?? {});
}

export function titleSummary(feature: Feature): Record<string, any> {
    const p = feature.properties ?? {};
    const summary: Record<string, any> = {};
    for (const k of TITLE_COLUMNS) if (k in p) summary[k] = p[k];
    for (const field of ['owners', 'owner', 'owner_names']) {
        if (field in p) { summary.owners = p[field]; break; }
    }
    return summary;
}

// --------------------------------------------------------------------------- //
// Client
// --------------------------------------------------------------------------- //

export class LDSClient {
    private base: string;
    private timeoutMs: number;

    constructor(apiKey?: string, timeoutMs = 30_000) {
        const key = apiKey || process.env.LINZ_API_KEY;
        if (!key) throw new LDSError('No LINZ API key. Set LINZ_API_KEY.');
        // The key is a matrix parameter on the /services path segment.
        this.base = `${LDS_HOST}/services;key=${key}/wfs`;
        this.timeoutMs = timeoutMs;
    }

    async getFeatures(typeName: string, opts: {
        cqlFilter?: string;
        count?: number;
        propertyNames?: string[];
        srs?: string;
    } = {}): Promise<Feature[]> {
        const params = new URLSearchParams({
            service: 'WFS', version: WFS_VERSION, request: 'GetFeature',
            typeNames: typeName, outputFormat: 'json', srsName: opts.srs ?? DEFAULT_SRS,
        });
        if (opts.cqlFilter) params.set('cql_filter', opts.cqlFilter);
        if (opts.count !== undefined) {
            params.set('count', String(Math.min(opts.count, MAX_COUNT_PER_REQUEST)));
        }
        if (opts.propertyNames?.length) {
            params.set('propertyName', `(${opts.propertyNames.join(',')})`);
        }

        let resp: Response;
        try {
            resp = await fetch(`${this.base}?${params}`, {
                signal: AbortSignal.timeout(this.timeoutMs),
            });
        } catch (err: any) {
            // A fetch/DNS/timeout error quotes the request URL, and the URL
            // carries the API key as a matrix parameter. Never let it through.
            throw new LDSError(`LDS ${typeName} request failed: ${err?.name ?? 'error'}`);
        }
        const body = await resp.text();
        if (!resp.ok) {
            throw new LDSError(`LDS ${typeName} returned HTTP ${resp.status}: ${body.slice(0, 300)}`);
        }
        try {
            // GeoServer returns XML on some errors despite outputFormat=json.
            return JSON.parse(body).features ?? [];
        } catch {
            throw new LDSError(`LDS ${typeName} did not return JSON: ${body.slice(0, 300)}`);
        }
    }

    /** Fetch rows where `column IN ids`, batched and run concurrently. */
    async getFeaturesForIds(typeName: string, column: string, ids: string[],
                            chunk = 10): Promise<Feature[]> {
        const unique = [...new Set(ids)];
        const batches: string[][] = [];
        for (let i = 0; i < unique.length; i += chunk) batches.push(unique.slice(i, i + chunk));
        const results = await Promise.all(batches.map(b =>
            this.getFeatures(typeName, {
                cqlFilter: cqlIn(column, b), count: MAX_COUNT_PER_REQUEST,
            })));
        return results.flat();
    }
}

// --------------------------------------------------------------------------- //
// Address resolution
// --------------------------------------------------------------------------- //

const STREET_NO = /^(\d+[A-Za-z]?)$/;

/**
 * The street number, looking past any unit prefix.
 * '19 Carroll Street' -> '19'; 'K/810 Great South Road' -> '810';
 * '1A/342 Oriental Parade' -> '342'; 'Carroll Street' -> null.
 */
export function streetNumber(text: string): string | null {
    let first = text.trim().split(',')[0].trim().split(' ')[0];
    if (first.includes('/')) first = first.slice(first.lastIndexOf('/') + 1);
    const m = STREET_NO.exec(first);
    return m ? m[1].toLowerCase() : null;
}

function tokens(text: string): Set<string> {
    return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

/**
 * Rank an address candidate against the query, as [numberMatch, coverage].
 *
 * A plain substring LIKE makes '19 Carroll Street' match '119 Carroll Street',
 * so the street number is compared as a whole token first, then the rest of the
 * query by token coverage.
 */
export function score(query: string, candidate: string): [number, number] {
    const qNo = streetNumber(query), cNo = streetNumber(candidate);
    const numberMatch = (qNo && cNo && qNo === cNo) ? 1 : 0;
    const qTokens = tokens(query);
    if (qTokens.size === 0) return [numberMatch, 0];
    const cTokens = tokens(candidate);
    let shared = 0;
    for (const t of qTokens) if (cTokens.has(t)) shared++;
    return [numberMatch, shared / qTokens.size];
}

/** Descending sort comparator over score() tuples. */
function byScoreDesc(query: string) {
    return (a: Feature, b: Feature) => {
        const sa = score(query, a.properties?.full_address ?? '');
        const sb = score(query, b.properties?.full_address ?? '');
        return (sb[0] - sa[0]) || (sb[1] - sa[1]);
    };
}

const MAX_ADDRESS_CANDIDATES = 25;
const ADDRESS_POINT_PAD = 0.0008;

export interface AddressResult {
    resolution_status: 'ok' | 'not_found' | 'no_title' | 'no_geometry' | 'needs_confirmation';
    query: string;
    address_id?: number;
    resolved_address?: Record<string, any>;
    titles?: Record<string, any>[];
    candidates?: Record<string, any>[];
    note?: string;
}

/** Resolve the live title(s) whose polygon covers this address point. */
async function titlesAt(client: LDSClient, addressFeature: Feature,
                        query: string): Promise<AddressResult> {
    const g = geomOf(addressFeature);
    const p = addressFeature.properties ?? {};
    if (!g) return { resolution_status: 'no_geometry', query, resolved_address: p };
    const [lon, lat] = g.type === 'Point'
        ? (g.coordinates as [number, number])
        : centroidOf(g);
    const feats = await client.getFeatures(TITLES_OWNERS_LAYER, {
        cqlFilter: cqlBbox(lon - ADDRESS_POINT_PAD, lat - ADDRESS_POINT_PAD,
                           lon + ADDRESS_POINT_PAD, lat + ADDRESS_POINT_PAD),
        count: 200,
    });
    const titles = feats
        .filter(f => {
            const gg = geomOf(f);
            return gg !== null && containsPoint(gg, lon, lat);
        })
        .map(titleSummary);
    const resolved: Record<string, any> = {};
    for (const k of ADDRESS_COLUMNS) resolved[k] = p[k] ?? null;
    return {
        resolution_status: titles.length > 0 ? 'ok' : 'no_title',
        query,
        resolved_address: resolved,
        titles,
    };
}

/**
 * Free-text address -> the live title(s) at that point.
 *
 * Pass addressId to resolve a specific address the user picked from an earlier
 * ambiguous result, skipping the text matching entirely.
 */
export async function searchAddress(client: LDSClient, query = '',
                                    addressId?: number): Promise<AddressResult> {
    if (addressId !== undefined) {
        const cands = await client.getFeatures(ADDRESSES_LAYER, {
            cqlFilter: `address_id=${Math.trunc(addressId)}`, count: 1,
        });
        if (cands.length === 0) {
            return { resolution_status: 'not_found', query, address_id: addressId };
        }
        return titlesAt(client, cands[0], query);
    }

    const cands = await client.getFeatures(ADDRESSES_LAYER, {
        cqlFilter: cqlLike('full_address', query), count: 50,
    });
    if (cands.length === 0) return { resolution_status: 'not_found', query };

    const ranked = [...cands].sort(byScoreDesc(query));
    const best = score(query, ranked[0].properties?.full_address ?? '');
    const tied = ranked.filter(c => {
        const s = score(query, c.properties?.full_address ?? '');
        return s[0] === best[0] && s[1] === best[1];
    });
    if (tied.length > 1) {
        // Offer every plausible match, best first, so the user picks one instead
        // of guessing at a more specific query.
        return {
            resolution_status: 'needs_confirmation',
            query,
            candidates: ranked.slice(0, MAX_ADDRESS_CANDIDATES).map(c => {
                const out: Record<string, any> = {};
                for (const k of ADDRESS_COLUMNS) out[k] = c.properties?.[k] ?? null;
                return out;
            }),
            note: 'Several addresses matched. Choose the one you meant.',
        };
    }
    return titlesAt(client, ranked[0], query);
}

// --------------------------------------------------------------------------- //
// Owner search
// --------------------------------------------------------------------------- //

const OWNER_RESULT_CAP = 50;

/**
 * Match a person or company name against the owners table.
 *
 * LDS stores people as separate `prime_surname` / `prime_other_names` columns,
 * so "joshua wong" matches neither column on its own. Split the query and try
 * each end as the surname, which covers both "joshua wong" and "wong joshua",
 * and 3-token names like "en qi lim".
 */
export function ownerNameCql(name: string): string {
    const clean = name.split(/\s+/).filter(Boolean).join(' ');
    const corporate = cqlLike('corporate_name', clean);
    const parts = clean.split(' ').filter(Boolean);
    if (parts.length < 2) {
        return `(${corporate} OR ${cqlLike('prime_surname', clean)}`
            + ` OR ${cqlLike('prime_other_names', clean)})`;
    }
    const surnameLast = `(${cqlLike('prime_surname', parts[parts.length - 1])} AND `
        + `${cqlLike('prime_other_names', parts.slice(0, -1).join(' '))})`;
    const surnameFirst = `(${cqlLike('prime_surname', parts[0])} AND `
        + `${cqlLike('prime_other_names', parts.slice(1).join(' '))})`;
    return `(${corporate} OR ${surnameLast} OR ${surnameFirst})`;
}

export interface OwnerResult {
    query: string;
    results: Record<string, any>[];
    truncated: boolean;
}

/** Owner or company name -> their titles. */
export async function searchOwner(client: LDSClient, name: string): Promise<OwnerResult> {
    const rows = props(await client.getFeatures(OWNERS_TABLE, {
        cqlFilter: ownerNameCql(name), count: OWNER_RESULT_CAP,
    }));

    // LDS returns rows in roughly insertion order, not by relevance, so a
    // truncated result set is an arbitrary slice — a one-word surname can return
    // 50 rows that do not include the person being looked for. Say so rather
    // than presenting a partial list as if it were the answer.
    const truncated = rows.length >= OWNER_RESULT_CAP;

    const titleIds = [...new Set(rows.map(r => r.title_no).filter(Boolean))] as string[];
    const byNo = new Map<string, Record<string, any>>();
    if (titleIds.length > 0) {
        for (const f of await client.getFeaturesForIds(TITLES_OWNERS_LAYER, 'title_no', titleIds)) {
            const s = titleSummary(f);
            if (s.title_no) byNo.set(s.title_no, s);
        }
    }
    for (const r of rows) r.title = byNo.get(r.title_no) ?? null;
    return { query: name, results: rows, truncated };
}

// --------------------------------------------------------------------------- //
// The report
// --------------------------------------------------------------------------- //

export interface TitleReport {
    title: Record<string, any> | null;
    owners: Record<string, any>[];
    /** Typed, because these feed analyse() in utils/memorials.ts directly. */
    memorials: MemorialRow[];
    estates: Record<string, any>[];
    address: string | null;
}

/**
 * LINZ ownership data has no address field, so intersect the title polygon
 * against the current address layer.
 */
async function addressOf(client: LDSClient, titleFeature: Feature): Promise<string | null> {
    const poly = geomOf(titleFeature);
    if (isEmptyGeom(poly)) return null;
    const [minx, miny, maxx, maxy] = bboxOf(poly!);
    const cands = await client.getFeatures(ADDRESSES_LAYER, {
        cqlFilter: cqlBbox(minx, miny, maxx, maxy), count: MAX_COUNT_PER_REQUEST,
    });
    const inside = featuresWithin(poly!, cands);
    if (inside.length === 0) return null;
    return inside[0].properties?.full_address ?? null;
}

/** Everything the report page needs for one title. */
export async function titleReport(client: LDSClient, titleNo: string): Promise<TitleReport> {
    const quoted = cqlQuote(titleNo);
    const [titleFeats, ownerFeats, memorialFeats, estateFeats] = await Promise.all([
        client.getFeatures(TITLES_OWNERS_LAYER, { cqlFilter: `title_no=${quoted}` }),
        client.getFeatures(OWNERS_TABLE, { cqlFilter: `title_no=${quoted}`, count: 100 }),
        client.getFeatures(MEMORIALS_TABLE, { cqlFilter: `title_no=${quoted}`, count: 10000 }),
        client.getFeatures(ESTATES_TABLE, { cqlFilter: `title_no=${quoted}`, count: 50 }),
    ]);
    const memorials = (props(memorialFeats) as MemorialRow[]).sort((a, b) =>
        String(a.instrument_lodged_datetime ?? '')
            .localeCompare(String(b.instrument_lodged_datetime ?? '')));

    return {
        title: titleFeats.length > 0 ? titleSummary(titleFeats[0]) : null,
        owners: props(ownerFeats),
        memorials,
        estates: props(estateFeats),
        address: titleFeats.length > 0 ? await addressOf(client, titleFeats[0]) : null,
    };
}

// Owner/estate display helpers live in utils/titleReport.ts so the browser can
// use them too — this module is server-only and must never reach the bundle.
export { ownerName, groupOwners, estateLine } from './titleReport.js';
