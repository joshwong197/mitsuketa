import { ApiConfig, LoggerCallback } from '../../types';
import { BASE_API_URL } from '../../constants';

const INSOLVENCY_PATH = '/insolvency-trustee-services/v5';

// Response Types based on docs/insolvency-trustee-services.json
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
    dischargeOrCompletionDate?: string;
}

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
    page: number = 1
): Promise<InsolvencySearchResult> {
    const baseUrl = `/api/proxy`;
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

    return {
        ...result,
        searchResults: filtered,
        totalItems: filtered.length,
    };
}
