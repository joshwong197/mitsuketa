import { ApiConfig, PersonCompanyResult, LoggerCallback, GraphNode } from '../../types.js';
import { BASE_API_URL, API_PATHS } from '../../constants.js';

/**
 * External administration status types from NZBN API entityStatusDescription
 */
const EXTERNAL_ADMIN_STATUSES = [
    'In Receivership',
    'In Liquidation',
    'In Voluntary Administration',
    'In Statutory Administration',
];

/**
 * Insolvency type values from NZBN company.insolvencies[].insolvencyType
 */
const INSOLVENCY_TYPES = ['Liquidation', 'Receivership', 'Voluntary Administration', 'Statutory Management'];

/**
 * Core keywords for matching admin/insolvency statuses in history data.
 * Works for both "In Liquidation" and "Liquidation" (NZBN API returns inconsistent formats).
 */
const ADMIN_KEYWORDS = ['receivership', 'liquidation', 'voluntary administration', 'statutory administration'];

interface NZBNCompanyDetails {
    removalCommenced?: boolean;
    insolvencyDetails?: {
        commenced?: string;
        insolvencyType?: string;
        insolvencyAppointee?: any[];
    };
    insolvencies?: Array<{
        commenced?: string;
        insolvencyType?: string;
        insolvencyAppointee?: any[];
    }>;
}

interface NZBNEntityResponse {
    nzbn: string;
    entityName: string;
    entityStatusDescription: string;
    company?: NZBNCompanyDetails;
    'company-details'?: NZBNCompanyDetails;
}

export interface CompanyStatusResult {
    entityStatusDescription: string;
    isInExternalAdmin: boolean;
    externalAdminType?: string;
    removalCommenced: boolean;
    hasHistoricInsolvency: boolean;
    historicInsolvencyType?: string;
}

/**
 * Fetch entity status history (chronological list of past entity statuses).
 * Exported so the MCP server can wrap it as a standalone tool.
 */
export async function fetchEntityStatusHistory(
    nzbn: string,
    config: ApiConfig,
    baseUrl: string = '/api/proxy',
    logger?: LoggerCallback
): Promise<Array<{ entityStatusDescription: string; effectiveFrom?: string; effectiveTo?: string }>> {
    const proxyPath = `${API_PATHS.nzbn}/entities/${nzbn}/history/entity-statuses`;
    const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;
    const response = await fetch(url, {
        headers: {
            'x-user-api-key': config.nzbnKey || '',
            'x-api-type': 'nzbn',
            'Accept': 'application/json'
        }
    });
    if (logger) {
        logger({
            timestamp: new Date().toISOString(),
            method: 'GET',
            url: proxyPath,
            headers: {},
            status: response.status,
            message: response.statusText
        });
    }
    if (!response.ok) {
        return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

// Session-lifetime cache of NZBN entity lookups so the shareholding-% enrichment and the
// status enrichment (and repeat searches) share one fetch per company instead of two.
// ponytail: unbounded-ish Map capped by wholesale clear; LRU if memory ever matters
const entityCache = new Map<string, Promise<any | null>>();

/**
 * Fetch (with caching) the raw NZBN entity payload for a company.
 * Resolves to null on any failure; failures are not cached so a retry can succeed.
 */
export function fetchNzbnEntityCached(
    nzbn: string,
    apiKey: string = '',
    baseUrl: string = '/api/proxy'
): Promise<any | null> {
    const key = `${baseUrl}|${nzbn}`;
    let pending = entityCache.get(key);
    if (!pending) {
        const proxyPath = `${API_PATHS.nzbn}/entities/${encodeURIComponent(nzbn)}`;
        const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;
        pending = fetch(url, {
            headers: {
                'x-user-api-key': apiKey || '',
                'x-api-type': 'nzbn',
                'Accept': 'application/json'
            }
        })
            .then(r => (r.ok ? r.json() : null))
            .catch(() => null);
        if (entityCache.size > 500) entityCache.clear();
        entityCache.set(key, pending);
        pending.then(v => { if (v === null) entityCache.delete(key); });
    }
    return pending;
}

/**
 * Fetch a single company's NZBN entity details to extract insolvency/admin status.
 */
export async function fetchCompanyStatus(
    nzbn: string,
    config: ApiConfig,
    logger?: LoggerCallback,
    baseUrl: string = '/api/proxy'
): Promise<CompanyStatusResult | null> {
    // Use secure proxy
    const proxyPath = `${API_PATHS.nzbn}/entities/${nzbn}`;
    const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;

    if (logger) {
        logger({
            timestamp: new Date().toISOString(),
            method: 'GET',
            url: proxyPath,
            headers: { 'x-user-api-key': config.nzbnKey ? config.nzbnKey.substring(0, 4) + '****' : 'Using Default' },
            status: 0,
            message: `Fetching company status for ${nzbn}...`
        });
    }

    try {
        const data: NZBNEntityResponse | null = await fetchNzbnEntityCached(nzbn, config.nzbnKey, baseUrl);

        if (logger) {
            logger({
                timestamp: new Date().toISOString(),
                method: 'GET',
                url,
                headers: {},
                status: data ? 200 : 0,
                message: data ? 'OK (cached fetch)' : 'Failed'
            });
        }

        if (!data) {
            console.warn(`⚠️ Failed to fetch status for ${nzbn}`);
            return null;
        }

        // The company details can be under "company" or "company-details" depending on the response
        const companyDetails = data.company || data['company-details'];
        const statusDesc = data.entityStatusDescription || '';

        // Check external administration
        const isInExternalAdmin = EXTERNAL_ADMIN_STATUSES.some(
            s => statusDesc.toLowerCase().includes(s.toLowerCase())
        );
        const externalAdminType = isInExternalAdmin ? statusDesc : undefined;

        // "Removal commenced" is meant to mean removal is IN PROGRESS (types.ts:
        // "True if registered but removal process has started"). The register keeps
        // the flag set after removal COMPLETES, which made an already-removed
        // company render "REMOVED" and "REMOVAL IN PROGRESS" side by side —
        // contradictory, confirmed against a live entity. Gate it on the entity not
        // already being removed, so downstream consumers (the graph node badge, the
        // statusRamp bucket, exports) all get the intended meaning from one place.
        const alreadyRemoved = statusDesc.toLowerCase().includes('removed') || statusDesc.toLowerCase() === 'inactive';
        const removalCommenced = companyDetails?.removalCommenced === true && !alreadyRemoved;

        // Check historic insolvency (for removed companies)
        let hasHistoricInsolvency = false;
        let historicInsolvencyType: string | undefined;

        const insolvencies = companyDetails?.insolvencies || [];
        const currentInsolvency = companyDetails?.insolvencyDetails;

        const allInsolvencies = new Set<string>();

        if (currentInsolvency?.insolvencyType) {
            allInsolvencies.add(currentInsolvency.insolvencyType);
        }

        if (Array.isArray(insolvencies)) {
            insolvencies.forEach(inv => {
                if (inv.insolvencyType) {
                    allInsolvencies.add(inv.insolvencyType);
                }
            });
        }

        // If currently in external admin, remove the matching current insolvency type
        // so the PREV badge only shows genuinely different past types.
        // E.g. "In Liquidation" + insolvencies ["Liquidation", "Voluntary Administration"]
        //   → remove "Liquidation" → PREV shows only "VOLUNTARY ADMINISTRATION"
        if (isInExternalAdmin && externalAdminType) {
            const currentType = externalAdminType.toLowerCase();
            for (const insType of allInsolvencies) {
                if (currentType.includes(insType.toLowerCase())) {
                    allInsolvencies.delete(insType);
                }
            }
        }

        if (allInsolvencies.size > 0) {
            hasHistoricInsolvency = true;
            historicInsolvencyType = Array.from(allInsolvencies).join(' & ');
        }

        const isRemoved = alreadyRemoved || companyDetails?.removalCommenced === true;

        // --- DEBUG LOGGING ---
        if (isRemoved) {
            console.log(`[DEBUG] NZBN Entity API for ${nzbn} (${data.entityName}):`, {
                statusDesc,
                hasHistoricInsolvency,
                historicInsolvencyType,
                rawCompanyDetails: companyDetails,
            });
        }
        // ---------------------

        // FALLBACK: If we still have no historic insolvency data, check the entity status history.
        // This catches:
        //   - Companies previously in liquidation but now Registered (e.g. Mender Construction)
        //   - Companies currently in admin with DIFFERENT past admin types (e.g. Evergreen Modular:
        //     currently In Liquidation, previously in Voluntary Administration)
        if (!hasHistoricInsolvency) {
            try {
                const historyProxyPath = `${API_PATHS.nzbn}/entities/${nzbn}/history/entity-statuses`;
                const historyUrl = `${baseUrl}?path=${encodeURIComponent(historyProxyPath)}`;
                const historyResponse = await fetch(historyUrl, {
                    headers: {
                        'x-user-api-key': config.nzbnKey || '',
                        'x-api-type': 'nzbn',
                        'Accept': 'application/json'
                    }
                });

                if (historyResponse.ok) {
                    const historyData = await historyResponse.json();

                    if (Array.isArray(historyData)) {
                        // Look for past statuses that match admin/insolvency keywords,
                        // but exclude the CURRENT admin type.
                        // Uses ADMIN_KEYWORDS for flexible matching — handles both
                        // "In Voluntary Administration" and "Voluntary Administration"
                        const currentTypeLC = (externalAdminType || '').toLowerCase();

                        // Find which keyword matches the current type (if any)
                        const currentKeyword = ADMIN_KEYWORDS.find(kw => currentTypeLC.includes(kw));

                        const pastInsolvencies = historyData.filter(statusObj => {
                            const desc = (statusObj.entityStatusDescription || '').toLowerCase();
                            // Must match an admin keyword
                            const matchedKeyword = ADMIN_KEYWORDS.find(kw => desc.includes(kw));
                            if (!matchedKeyword) return false;
                            // Exclude if it matches the same keyword as current admin type
                            if (currentKeyword && matchedKeyword === currentKeyword) return false;
                            return true;
                        });

                        if (pastInsolvencies.length > 0) {
                            hasHistoricInsolvency = true;
                            // Deduplicate types
                            const types = [...new Set(pastInsolvencies.map(s => s.entityStatusDescription))];
                            historicInsolvencyType = types.join(' & ');
                            console.log(`[DEBUG] Found historic insolvency via Status History API for ${nzbn}:`, historicInsolvencyType);
                        }
                    }
                }
            } catch (err) {
                console.warn(`⚠️ Failed to fetch history for ${nzbn}:`, err);
            }
        }

        return {
            entityStatusDescription: statusDesc,
            isInExternalAdmin,
            externalAdminType,
            removalCommenced,
            hasHistoricInsolvency,
            historicInsolvencyType
        };
    } catch (error: any) {
        console.warn(`⚠️ Error fetching status for ${nzbn}:`, error.message);
        if (logger) {
            logger({
                timestamp: new Date().toISOString(),
                method: 'GET',
                url,
                headers: {},
                status: 0,
                message: `Error: ${error.message}`
            });
        }
        return null;
    }
}

/**
 * Batch-enrich an array of PersonCompanyResult with insolvency/admin status.
 * Uses concurrency limiting to avoid hitting API rate limits.
 * 
 * @param results Person search results to enrich
 * @param config API configuration
 * @param logger Optional logger callback
 * @param concurrency Max simultaneous API calls (default: 5)
 * @param onProgress Optional callback for progress updates (completedCount, totalCount)
 */
export async function enrichCompanyResults(
    results: PersonCompanyResult[],
    config: ApiConfig,
    logger?: LoggerCallback,
    concurrency: number = 5,
    onProgress?: (completed: number, total: number) => void,
    baseUrl: string = '/api/proxy'
): Promise<PersonCompanyResult[]> {


    // Deduplicate NZBNs to avoid redundant lookups
    const uniqueNzbns = [...new Set(results.map(r => r.nzbn))];
    console.log(`🔍 Enriching ${uniqueNzbns.length} unique companies with NZBN status data...`);

    const statusMap = new Map<string, Awaited<ReturnType<typeof fetchCompanyStatus>>>();

    // Process in batches with concurrency limiting
    let completed = 0;
    for (let i = 0; i < uniqueNzbns.length; i += concurrency) {
        const batch = uniqueNzbns.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(nzbn => fetchCompanyStatus(nzbn, config, logger, baseUrl))
        );

        batch.forEach((nzbn, idx) => {
            statusMap.set(nzbn, batchResults[idx]);
        });

        completed += batch.length;
        onProgress?.(completed, uniqueNzbns.length);
    }

    console.log(`✅ Enriched ${statusMap.size} companies with status data`);

    // Apply enrichment to results
    return results.map(result => {
        const status = statusMap.get(result.nzbn);
        if (!status) return result;

        return {
            ...result,
            entityStatusDescription: status.entityStatusDescription,
            isInExternalAdmin: status.isInExternalAdmin,
            externalAdminType: status.externalAdminType,
            removalCommenced: status.removalCommenced,
            hasHistoricInsolvency: status.hasHistoricInsolvency,
            historicInsolvencyType: status.historicInsolvencyType
        };
    });
}

/**
 * Batch-enrich an array of GraphNodes with insolvency/admin status.
 */
export async function enrichGraphNodes(
    nodes: GraphNode[],
    config: ApiConfig,
    logger?: LoggerCallback,
    concurrency: number = 5,
    baseUrl: string = '/api/proxy'
): Promise<GraphNode[]> {


    // Filter to only company nodes
    const companyNodes = nodes.filter(n => n.data.type === 'company' && n.data.nzbn);
    const uniqueNzbns = [...new Set(companyNodes.map(n => n.data.nzbn as string))];

    console.log(`🔍 Enriching ${uniqueNzbns.length} graph nodes with NZBN status data...`);

    const statusMap = new Map<string, Awaited<ReturnType<typeof fetchCompanyStatus>>>();

    // Process in batches
    for (let i = 0; i < uniqueNzbns.length; i += concurrency) {
        const batch = uniqueNzbns.slice(i, i + concurrency);

        const promises = batch.map(async (nzbn) => {
            const status = await fetchCompanyStatus(nzbn, config, logger, baseUrl);
            if (status) {
                statusMap.set(nzbn, status);
            }
        });

        await Promise.allSettled(promises);
    }

    console.log(`✅ Enriched ${statusMap.size} graph nodes with status data`);

    // Apply enrichment
    return nodes.map(node => {
        if (node.data.type !== 'company' || !node.data.nzbn) return node;

        const status = statusMap.get(node.data.nzbn);
        if (!status) return node;

        return {
            ...node,
            data: {
                ...node.data,
                entityStatusDescription: status.entityStatusDescription,
                isInExternalAdmin: status.isInExternalAdmin,
                externalAdminType: status.externalAdminType,
                removalCommenced: status.removalCommenced,
                hasHistoricInsolvency: status.hasHistoricInsolvency,
                historicInsolvencyType: status.historicInsolvencyType,
                // Update display status so parent/child nodes show their real status
                // (e.g. "Removed" instead of "Parent")
                status: status.entityStatusDescription || node.data.status,
            }
        };
    });
}
