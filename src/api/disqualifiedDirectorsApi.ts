import { ApiConfig, LoggerCallback } from '../../types';
import { BASE_API_URL } from '../../constants';

const DISQUALIFIED_DIRECTORS_PATH = '/companies-office/companies-register/disqualified-directors/v3';

// Response Types based on docs/companies-disqualified-director-search.json
export interface DisqualifiedDirector {
    firstName: string;
    middleName?: string;
    lastName: string;
    disqualifiedDirectorId: string | number; // Docs say string in schema but example has number.
    aliases?: {
        aliases: string[];
    };
    disqualificationCriteria?: {
        criteria: Array<{
            startDate: string;
            endDate?: string;
            criteria?: string;
            comments?: string;
        }>;
    };
    associations?: {
        associations: Array<{
            associatedCompanyNumber?: string;
            associatedCompanyName?: string;
            associatedCompanyNzbn?: string;
            associatedCompanyStatusCode?: string;
        }>;
    };
}

export interface DisqualifiedDirectorSearchResult {
    totalResults: number;
    pageSize: number;
    currentPage: number;
    roles: DisqualifiedDirector[];
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
            message: 'Sending Disqualified Director Request...'
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

/**
 * Searches for disqualified directors by name.
 * 
 * @param name Name of the person to search for (min 2 chars)
 * @param config ApiConfig containing the API key
 * @param logger Optional logger callback
 * @param pageSize Number of results per page (default 10)
 * @param page Page number (default 0)
 */
export async function searchDisqualifiedDirectors(
    name: string,
    config: ApiConfig,
    logger?: LoggerCallback,
    pageSize: number = 10,
    page: number = 0
): Promise<DisqualifiedDirectorSearchResult> {
    const baseUrl = `/api/proxy`;
    const proxyPath = `${DISQUALIFIED_DIRECTORS_PATH}/search?name=${encodeURIComponent(name)}&page=${page}&page-size=${pageSize}`;
    const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;

    // Optional user key
    const apiKey = (config as any).disqualifiedDirectorsKey || '';

    const response = await safeFetch(url, {
        'x-user-api-key': apiKey,
        'x-api-type': 'disqualified',
        'Accept': 'application/json'
    }, logger);

    if (!response.ok) {
        if (response.status === 401) throw new Error("Disqualified Directors API Unauthorized.");
        throw new Error(`Disqualified Directors API Error: ${response.status}`);
    }

    return await response.json();
}
