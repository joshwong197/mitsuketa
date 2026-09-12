import { ApiConfig, LoggerCallback } from '../../types.js';
import { BASE_API_URL } from '../../constants.js';

const INSOLVENCY_PATH = '/insolvency-trustee-services/v5';

// Response Types based on docs/insolvency-trustee-services.json
//
// IMPORTANT — two different shapes:
//   GET /insolvencies?name=      → InsolvenciesSearchResults.searchResults[], a SUMMARY
//                                  that carries NO discharge fields whatsoever.
//   GET /insolvencies/{estate-id} → InsolvenciesRecord, the full record, and the only
//                                  place dischargeOrCompletionDate et al. actually live.
// Declaring the discharge fields on the search result alone leaves them permanently
// undefined — which is exactly what made a discharged bankrupt read as never
// discharged. searchInsolvency() therefore follows each hit with a detail fetch.
export interface InsolvencyRecord {
    estateNumber: number;
    estateName: string;
    nzbn?: string;
    adjudicationOrLiquidationDate: string;
    insolvencyTypeDescription: string;
    multipleInsolvencies: boolean;
    addressAtAdjudication?: string;
    insolvencyStatus: string; // "Current Bankrupt", "Discharged", "Annulled", etc.
    officer?: string;
    alternateNames?: string[];

    // --- detail-endpoint only (see above) ---
    dischargeOrCompletionDate?: string;
    dischargeOrCompletionType?: string; // Reason for discharge/completion
    dischargeConditionExpiryDate?: string; // What "(conditional) discharged" points at
    dischargeSuspended?: boolean; // A suspended discharge means still bankrupt, regardless of insolvencyStatus
    annulmentDate?: string; // Annulled rather than discharged
    // Identity corroboration — the register's own answer to the same-name problem
    // that this whole feature is caveated on.
    monthOfBirth?: string;
    yearOfBirth?: string;
    courtName?: string;
    occupationAtAdjudicationOrIndustryAtLiquidation?: string;
}

// The subset of InsolvenciesRecord we merge over a search hit. Deliberately narrow:
// only fields the search summary lacks or gets wrong.
const DETAIL_FIELDS = [
    'insolvencyStatus', // detail is authoritative — the summary reports a coarser status
    'dischargeOrCompletionDate',
    'dischargeOrCompletionType',
    'dischargeConditionExpiryDate',
    'dischargeSuspended',
    'annulmentDate',
    'monthOfBirth',
    'yearOfBirth',
    'courtName',
    'occupationAtAdjudicationOrIndustryAtLiquidation',
] as const;

export interface InsolvencySearchResult {
    totalItems: number;
    pageSize: number;
    page: number;
    totalPages: number;
    searchCriteria: string;
    searchResults: InsolvencyRecord[];
}

/**
 * Helper for safe fetching with logging
 */
async function safeFetch(url: string, headers: HeadersInit, logger?: LoggerCallback) {
    const method = 'GET';

    if (logger) {
        const maskedHeaders: Record<string, string> = {};
        if (typeof headers === 'object' && !Array.isArray(headers)) {
            Object.entries(headers as Record<string, string>).forEach(([k, v]) => {
                maskedHeaders[k] = v.length > 4 ? v.substring(0, 4) + '****' : '****';
            });
        }

        logger({
            timestamp: new Date().toISOString(),
            method,
            url,
            headers: maskedHeaders,
            status: 0,
            message: 'Sending Insolvency Register Request...'
        });
    }

    try {
        const res = await fetch(url, { headers });

        if (logger) {
            logger({
                timestamp: new Date().toISOString(),
                method,
                url,
                headers: {},
                status: res.status,
                message: res.statusText
            });
        }

        return res;
    } catch (error: any) {
        if (logger) {
            logger({
                timestamp: new Date().toISOString(),
                method,
                url,
                headers: {},
                status: 0,
                message: `Network Error: ${error.message}`
            });
        }
        throw error;
    }
}

// Company insolvency types (liquidation/administration) — exclude these when searching for individuals
const COMPANY_INSOLVENCY_TYPES = [
    'voluntary liquidation',
    'court liquidation',
    'voluntary administration',
    'interim liquidation',
    'liquidation agency',
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Formats a record's date of birth for display: "January 1976".
 *
 * The register returns `monthOfBirth` as a bare number ("1"), which reads as
 * "1 1976" if you simply join the fields. Lives here, beside the field, because
 * this was fixed once in the on-screen panel and then re-broken in the HTML
 * export, which had its own copy of the join. Anything non-numeric passes
 * straight through, in case the field ever arrives already spelled out.
 *
 * Returns null when there is no year — a month alone identifies nobody.
 */
export function formatBirth(month?: string, year?: string): string | null {
    if (!year) return null;
    if (!month) return year;
    const n = parseInt(month, 10);
    return `${Number.isInteger(n) && n >= 1 && n <= 12 ? MONTH_NAMES[n - 1] : month} ${year}`;
}

/**
 * Whether a record represents a CURRENT bankruptcy — either the register says so
 * outright, or the discharge has been suspended, which per the register schema
 * means the person is still bankrupt regardless of what insolvencyStatus reads
 * (design/HANDOVER.md §3d/§4.6). Drives the person-node crit "current" flag and
 * the PersonSearchResults summary strip's auto-expand.
 */
export function isInsolvencyRecordCurrent(record: InsolvencyRecord): boolean {
    if (record.dischargeSuspended) return true;
    return record.insolvencyStatus.toLowerCase().includes('current');
}

/**
 * Fetch the full record for one estate — `GET /insolvencies/{estate-id}`, which the
 * API docs describe as retrieving "current details for a specified insolvency record".
 * This is the ONLY source of the discharge/annulment dates; the name search does not
 * return them.
 *
 * Returns just the fields worth merging, with undefined values stripped so a sparse
 * detail response can never blank out a good summary value. Resolves to null on any
 * failure — a missing detail leaves the summary intact rather than failing the search.
 */
export async function fetchInsolvencyDetail(
    estateNumber: number,
    config: ApiConfig,
    logger?: LoggerCallback,
    baseUrl: string = '/api/proxy'
): Promise<Partial<InsolvencyRecord> | null> {
    const proxyPath = `${INSOLVENCY_PATH}/insolvencies/${encodeURIComponent(String(estateNumber))}`;
    const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;

    try {
        const response = await safeFetch(url, {
            'x-user-api-key': (config as any).insolvencyKey || '',
            'x-api-type': 'insolvency',
            'Accept': 'application/json'
        }, logger);

        if (!response.ok) {
            console.warn(`⚠️ Insolvency detail ${estateNumber} failed: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const merged: Record<string, unknown> = {};
        for (const field of DETAIL_FIELDS) {
            const value = (data as Record<string, unknown>)[field];
            if (value !== undefined && value !== null && value !== '') merged[field] = value;
        }
        return merged as Partial<InsolvencyRecord>;
    } catch (error: any) {
        console.warn(`⚠️ Insolvency detail ${estateNumber} error:`, error.message);
        return null;
    }
}

/**
 * Check if all words in the search name appear in the estate name (case-insensitive).
 */
function nameMatchesEstate(searchName: string, estateName: string): boolean {
    const searchWords = searchName.toLowerCase().trim().split(/\s+/);
    const estateNameLower = estateName.toLowerCase();
    return searchWords.every(word => estateNameLower.includes(word));
}

/**
 * Searches for individual insolvency (bankruptcy) records by name.
 * Filters out company insolvency types and non-matching names.
 *
 * @param name Name of the person to search for
 * @param config ApiConfig containing the API key
 * @param logger Optional logger callback
 * @param pageSize Number of results per page (default 1000)
 * @param page Page number (default 1)
 */
export async function searchInsolvency(
    name: string,
    config: ApiConfig,
    logger?: LoggerCallback,
    pageSize: number = 1000,
    page: number = 1,
    baseUrl: string = '/api/proxy'
): Promise<InsolvencySearchResult> {
    const proxyPath = `${INSOLVENCY_PATH}/insolvencies?name=${encodeURIComponent(name)}&page=${page}&page-size=${pageSize}`;
    const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;

    // Optional user key
    const apiKey = (config as any).insolvencyKey || '';

    const response = await safeFetch(url, {
        'x-user-api-key': apiKey,
        'x-api-type': 'insolvency',
        'Accept': 'application/json'
    }, logger);

    if (!response.ok) {
        if (response.status === 401) throw new Error("Insolvency Register API Unauthorized.");
        throw new Error(`Insolvency Register API Error: ${response.status}`);
    }

    const result: InsolvencySearchResult = await response.json();

    // Filter to individual insolvencies only: exclude company types and non-matching names
    const filtered = result.searchResults.filter(record => {
        // Exclude company insolvency types (liquidations, administrations)
        const isCompanyType = COMPANY_INSOLVENCY_TYPES.includes(
            record.insolvencyTypeDescription.toLowerCase()
        );
        if (isCompanyType) return false;

        // Ensure the estate name actually matches the searched person name
        if (!nameMatchesEstate(name, record.estateName)) return false;

        return true;
    });

    if (filtered.length !== result.searchResults.length) {
        console.log(`🔍 Insolvency: Filtered ${result.searchResults.length} results down to ${filtered.length} individual matches for "${name}"`);
    }

    // Follow each surviving hit with a detail fetch — the only way to get the
    // discharge date (see the InsolvencyRecord note). Runs after filtering, so
    // it costs one call per record the user will actually see, typically 0–3.
    const enriched = await Promise.all(
        filtered.map(async record => {
            const detail = await fetchInsolvencyDetail(record.estateNumber, config, logger, baseUrl);
            return detail ? { ...record, ...detail } : record;
        })
    );

    return {
        ...result,
        searchResults: enriched,
        totalItems: enriched.length,
    };
}
