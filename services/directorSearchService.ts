import { CompaniesRoleSearchResult, PersonCompanyResult, LogEntry } from '../types';

// Production URL (no longer used directly - routed through /api/proxy)
const BASE_URL_PROD = 'https://api.business.govt.nz/gateway';

/**
 * Search for companies where a person is a director or shareholder
 * Uses Companies Entity Role Search API v3
 */
export async function searchByPersonName(
    personName: string,
    apiKey: string,
    onLog?: (entry: LogEntry) => void
): Promise<PersonCompanyResult[]> {
    const baseUrl = `/api/proxy`;
    const proxyPath = `/companies-office/companies-register/entity-roles/v3/search?name=${encodeURIComponent(personName)}&role-type=ALL&page-size=1000`;
    const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;

    const startTime = Date.now();

    const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        method: 'GET',
        url,
        headers: {
            'x-user-api-key': '[PROVIDED]',
            'x-api-type': 'companies',
            'Accept': 'application/json'
        }
    };

    try {
        console.log(`🔍 Searching for person: "${personName}"...`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-user-api-key': apiKey || '',
                'x-api-type': 'companies',
                'Accept': 'application/json'
            }
        });

        const duration = Date.now() - startTime;
        logEntry.status = response.status;

        if (!response.ok) {
            const errorText = await response.text();
            logEntry.message = `❌ Failed (${response.status}) - ${duration}ms: ${errorText}`;
            onLog?.(logEntry);
            throw new Error(`Person search failed: ${response.status} ${response.statusText}`);
        }

        const data: CompaniesRoleSearchResult = await response.json();
        logEntry.message = `✅ Found ${data.roles?.length || 0} role(s) - ${duration}ms`;
        onLog?.(logEntry);

        console.log(`✅ Found ${data.roles?.length || 0} role(s) for "${personName}"`);

        // Process and deduplicate results (pass search name for client-side filtering)
        return processPersonSearchResults(data, personName);

    } catch (error: any) {
        logEntry.message = `❌ Error: ${error.message}`;
        logEntry.status = 0;
        onLog?.(logEntry);
        throw error;
    }
}

/**
 * Process raw API results into PersonCompanyResult format
 * Deduplicates companies where person has multiple roles
 * @param searchName Optional search name for client-side exact name filtering
 */
function processPersonSearchResults(data: CompaniesRoleSearchResult, searchName?: string): PersonCompanyResult[] {
    if (!data.roles || data.roles.length === 0) {
        return [];
    }

    let roles = data.roles;

    // Client-side name filtering: The Companies Office API does substring matching,
    // so "Yang, Yang" returns thousands of results for anyone with "Yang" anywhere in name.
    // Filter to only roles where the person name closely matches the search query.
    if (searchName) {
        const normalizedSearch = searchName.toLowerCase().replace(/[,.\-]/g, ' ').trim();
        const searchParts = normalizedSearch.split(/\s+/).filter(Boolean);

        if (searchParts.length > 0) {
            roles = roles.filter(role => {
                const first = (role.firstName || '').toLowerCase().trim();
                const middle = (role.middleName || '').toLowerCase().trim();
                const last = (role.lastName || '').toLowerCase().trim();

                // Build list of name parts from the API role
                const nameParts = [first, middle, last].filter(Boolean);

                // Every search term must match a complete name part (first, middle, or last)
                // or be a prefix of a name part (to handle abbreviations like "Rob" → "Robert")
                return searchParts.every(part =>
                    nameParts.some(np => np === part || np.startsWith(part))
                );
            });

            console.log(`🎯 Name filter: ${data.roles.length} → ${roles.length} roles (search: "${searchName}")`);
        }
    }

    // Group by company NZBN
    const companyMap = new Map<string, PersonCompanyResult>();

    console.log(`📋 Processing ${roles.length} role(s) from API`);
    roles.forEach((role, index) => {
        console.log(`  Role ${index + 1}: ${role.associatedCompanyName} (${role.associatedCompanyNzbn}) - ${role.roleType}`);
        if (!role.associatedCompanyName || !role.associatedCompanyNzbn) {
            console.log(`    🔍 Full role object:`, JSON.stringify(role, null, 2));
        }

        // IMPORTANT: API structure is inconsistent!
        // - For Director roles: company info is at top level (associatedCompanyName, associatedCompanyNzbn)
        // - For Shareholder roles: company info is INSIDE shareholdings array
        // We need to handle BOTH cases

        // Check if this is a shareholding role with company info in the shareholdings array
        if (role.shareholdings && role.shareholdings.length > 0) {
            // Process each shareholding as a separate company relationship
            role.shareholdings.forEach(shareholding => {
                const nzbn = shareholding.associatedCompanyNzbn;
                if (!nzbn) return; // Skip if no NZBN

                const existing = companyMap.get(nzbn);

                const isDirector = role.roleType === 'Director' || role.roleType === 'DirectorShareholder';
                const isShareholder = true; // We're in shareholdings array, so definitely a shareholder

                const isInactive = role.status === 'inactive';
                const resignationDate = role.resignationDate;

                const shareholdingPercentage = parseFloat(String(shareholding.sharePercentage || 0));

                // Parse status code
                const statusCode = parseInt(shareholding.associatedCompanyStatusCode || '0');
                let companyStatus = 'REGISTERED';
                if (statusCode === 80) companyStatus = 'REMOVED';
                else if (statusCode === 90) companyStatus = 'INACTIVE';
                else if (statusCode === 91) companyStatus = 'CLOSED';
                else if (statusCode >= 80) companyStatus = 'REMOVED';

                const companyName = shareholding.associatedCompanyName?.trim() || '';
                if (!companyName) {
                    console.warn(`⚠️ Missing company name in shareholding for NZBN: ${nzbn}`, shareholding);
                }

                if (existing) {
                    // Merge roles for same company
                    existing.isDirector = existing.isDirector || isDirector;
                    existing.shareholding = Math.max(existing.shareholding, shareholdingPercentage);
                    existing.isInactive = existing.isInactive && isInactive;
                    if (resignationDate && !existing.resignationDate) {
                        existing.resignationDate = resignationDate;
                    }
                    existing.entityStatusCode = statusCode;
                    existing.status = companyStatus;

                    // Update role type
                    if (existing.isDirector && existing.shareholding > 0) {
                        existing.roleType = 'Director & Shareholder';
                    } else if (existing.isDirector) {
                        existing.roleType = 'Director';
                    } else {
                        existing.roleType = 'Shareholder';
                    }
                } else {
                    // New company entry
                    let roleType = 'Shareholder';
                    if (isDirector && shareholdingPercentage > 0) {
                        roleType = 'Director & Shareholder';
                    } else if (isDirector) {
                        roleType = 'Director';
                    }

                    companyMap.set(nzbn, {
                        companyName: companyName || 'Unknown Company',
                        nzbn,
                        isDirector,
                        shareholding: shareholdingPercentage,
                        status: companyStatus,
                        roleType,
                        isInactive,
                        resignationDate,
                        entityStatusCode: statusCode
                    });
                }
            });
        } else {
            // This is a pure Director role with company info at top level (old logic)
            const nzbn = role.associatedCompanyNzbn;
            const existing = companyMap.get(nzbn);

            const isDirector = role.roleType === 'Director' || role.roleType === 'DirectorShareholder';
            const isShareholder = role.roleType === 'DirectorShareholder' ||
                role.roleType === 'IndividualShareholder' ||
                role.roleType === 'OrganisationShareholder';

            // Check if role is inactive (API spec line 377: status field)
            const isInactive = role.status === 'inactive';
            const resignationDate = role.resignationDate;

            // Calculate shareholding percentage
            let shareholding = 0;
            if (role.shareholdings && role.shareholdings.length > 0) {
                // Sum up all shareholdings for this person in this company
                shareholding = role.shareholdings.reduce((sum, sh) => {
                    return sum + (sh.sharePercentage || 0);
                }, 0);
            }

            // Map entity status code to readable status
            // See user's previous conversation: 80=Removed, 90=Inactive, 91=Closed
            const statusCode = parseInt(role.associatedCompanyStatusCode || '0');
            let companyStatus = 'REGISTERED';
            if (statusCode === 80) companyStatus = 'REMOVED';
            else if (statusCode === 90) companyStatus = 'INACTIVE';
            else if (statusCode === 91) companyStatus = 'CLOSED';
            else if (statusCode >= 80) companyStatus = 'REMOVED';

            if (existing) {
                // Merge roles for same company
                existing.isDirector = existing.isDirector || isDirector;
                existing.shareholding = Math.max(existing.shareholding, shareholding);
                existing.isInactive = existing.isInactive && isInactive; // Active if any role is active
                if (resignationDate && !existing.resignationDate) {
                    existing.resignationDate = resignationDate;
                }
                // Update status code (use the most recent/accurate one)
                existing.entityStatusCode = statusCode;
                existing.status = companyStatus;

                // Update role type
                if (existing.isDirector && existing.shareholding > 0) {
                    existing.roleType = 'Director & Shareholder';
                } else if (existing.isDirector) {
                    existing.roleType = 'Director';
                } else {
                    existing.roleType = 'Shareholder';
                }
            } else {
                // New company entry
                let roleType = 'Shareholder';
                if (isDirector && shareholding > 0) {
                    roleType = 'Director & Shareholder';
                } else if (isDirector) {
                    roleType = 'Director';
                }

                const companyName = role.associatedCompanyName?.trim() || '';
                if (!companyName) {
                    console.warn(`⚠️ Missing company name for NZBN: ${nzbn}`, role);
                }

                companyMap.set(nzbn, {
                    companyName: companyName || 'Unknown Company',
                    nzbn,
                    isDirector,
                    shareholding,
                    status: companyStatus,
                    roleType,
                    isInactive,
                    resignationDate,
                    entityStatusCode: statusCode
                });
            }
        }
    });

    // Convert to array and sort
    const results = Array.from(companyMap.values());

    // Sort: Active companies with active roles first, then directors, then shareholding %
    results.sort((a, b) => {
        // Active companies with active roles first (company not removed AND role not resigned)
        const aActiveCompany = (a.entityStatusCode || 0) < 80;
        const aActiveRole = !a.isInactive;
        const aFullyActive = aActiveCompany && aActiveRole;

        const bActiveCompany = (b.entityStatusCode || 0) < 80;
        const bActiveRole = !b.isInactive;
        const bFullyActive = bActiveCompany && bActiveRole;

        if (aFullyActive && !bFullyActive) return -1;
        if (!aFullyActive && bFullyActive) return 1;

        // Then directors first
        if (a.isDirector && !b.isDirector) return -1;
        if (!a.isDirector && b.isDirector) return 1;

        // Then by shareholding percentage (descending)
        return b.shareholding - a.shareholding;
    });

    console.log(`📊 Processed into ${results.length} unique companies`);
    console.log(`   Directors: ${results.filter(r => r.isDirector).length}`);
    console.log(`   Shareholders: ${results.filter(r => r.shareholding > 0).length}`);
    console.log(`   Active companies: ${results.filter(r => (r.entityStatusCode || 0) < 80).length}`);
    console.log(`   Inactive/Removed: ${results.filter(r => (r.entityStatusCode || 0) >= 80).length}`);

    // Log first few results to debug sorting
    console.log(`   First 5 sorted results:`, results.slice(0, 5).map(r => ({
        name: r.companyName,
        statusCode: r.entityStatusCode,
        status: r.status,
        isDirector: r.isDirector,
        shareholding: r.shareholding
    })));


    return results;
}
