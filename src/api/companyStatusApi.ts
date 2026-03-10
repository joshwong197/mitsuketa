import { ApiConfig, PersonCompanyResult, LoggerCallback, GraphNode } from '../../types';
import { BASE_API_URL, API_PATHS } from '../../constants';

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

/**
 * Fetch a single company's NZBN entity details to extract insolvency/admin status.
 */
async function fetchCompanyStatus(
    nzbn: string,
    config: ApiConfig,
    logger?: LoggerCallback
): Promise<{
    entityStatusDescription: string;
    isInExternalAdmin: boolean;
    externalAdminType?: string;
    removalCommenced: boolean;
    hasHistoricInsolvency: boolean;
    historicInsolvencyType?: string;
} | null> {
    // Use secure proxy
    const proxyPath = `${API_PATHS.nzbn}/entities/${nzbn}`;
    const url = `/api/proxy?path=${encodeURIComponent(proxyPath)}`;

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
                url,
                headers: {},
                status: response.status,
                message: response.statusText
            });
        }

        if (!response.ok) {
            console.warn(`⚠️ Failed to fetch status for ${nzbn}: ${response.status}`);
            return null;
        }

        const data: NZBNEntityResponse = await response.json();

        // The company details can be under "company" or "company-details" depending on the response
        const companyDetails = data.company || data['company-details'];
        const statusDesc = data.entityStatusDescription || '';

        // Check external administration
        const isInExternalAdmin = EXTERNAL_ADMIN_STATUSES.some(
            s => statusDesc.toLowerCase().includes(s.toLowerCase())
        );
        const externalAdminType = isInExternalAdmin ? statusDesc : undefined;

        // Check removal commenced
        const removalCommenced = companyDetails?.removalCommenced === true;

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

        const isRemoved = removalCommenced || statusDesc.toLowerCase().includes('removed') || statusDesc.toLowerCase() === 'inactive';

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
                const historyUrl = `/api/proxy?path=${encodeURIComponent(historyProxyPath)}`;
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
    onProgress?: (completed: number, total: number) => void
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
            batch.map(nzbn => fetchCompanyStatus(nzbn, config, logger))
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
    concurrency: number = 5
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
            const status = await fetchCompanyStatus(nzbn, config, logger);
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
