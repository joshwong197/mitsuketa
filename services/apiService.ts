import { ApiConfig, GraphEdge, GraphNode, NodeType, NZBNFullEntity, EntitySearchResultItem, CompaniesRoleSearchResult, DebugCallback, LoggerCallback } from '../types';
import { BASE_API_URL, API_PATHS } from '../constants';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// PERFORMANCE OPTIMIZATION FEATURE FLAG
// Set to false to revert to legacy full endpoint fetching (slower but more data)
// Set to true to use lightweight endpoints (70-80% faster for current graphs)
const USE_LIGHTWEIGHT_ENDPOINTS = false;  // REVERTED: Lightweight broke upstream parent discovery

// AGGRESSIVE OPTIMIZATION FLAGS (Set to false to revert)
const ENABLE_PARALLEL_PARENTS = true;     // Process parent structures in parallel
const ENABLE_SMART_DELAYS = true;         // Smart rate limiting instead of fixed delays
const ENABLE_ENTITY_CACHE = true;         // Cache entity lookups to avoid duplicates
const ENABLE_PARALLEL_ROLE_SEARCHES = false; // DISABLED: Made things slower (more total API calls)

class OrgSpider {
    private config: ApiConfig;
    private visited: Set<string>;
    private nodes: Map<string, GraphNode>;
    private edges: GraphEdge[];
    private nzbnBaseUrl: string;
    private companiesBaseUrl: string;
    private rootNzbn: string = '';
    private logger?: LoggerCallback;

    // OPTIMIZATION: Entity cache to avoid duplicate fetches
    private entityCache: Map<string, { name: string, status: string, sourceRegisterUniqueId?: string, timestamp: number }>;

    // OPTIMIZATION: Request timing for smart rate limiting
    private requestTimes: number[];

    // OPTIMIZATION: Roles API response cache (prevents redundant ~11s calls)
    private rolesCache: Map<string, CompaniesRoleSearchResult>;

    constructor(config: ApiConfig, logger?: LoggerCallback) {
        this.config = config;
        this.nzbnBaseUrl = `/api/proxy`;
        this.companiesBaseUrl = `/api/proxy`;
        this.visited = new Set();
        this.nodes = new Map();
        this.edges = [];
        this.logger = logger;
        this.entityCache = new Map();
        this.requestTimes = [];
        this.rolesCache = new Map();
    }

    // OPTIMIZATION #2: Smart rate limiting
    private async smartDelay() {
        if (!ENABLE_SMART_DELAYS) {
            // Fallback: Fixed 150ms delay
            await delay(150);
            return;
        }

        // Remove requests older than 1 second
        const now = Date.now();
        this.requestTimes = this.requestTimes.filter(t => (now - t) < 1000);

        // Only delay if we've made >10 requests in last second
        if (this.requestTimes.length > 10) {
            await delay(100);
        }

        this.requestTimes.push(now);
    }

    // OPTIMIZATION #3: Entity caching
    private async getCachedOrFetch(nzbn: string, fetchFn: () => Promise<{ entityName: string, entityStatusDescription: string, sourceRegisterUniqueId?: string }>): Promise<{ entityName: string, entityStatusDescription: string, sourceRegisterUniqueId?: string }> {
        if (!ENABLE_ENTITY_CACHE) {
            // Fallback: Always fetch
            return await fetchFn();
        }

        // Check cache (5 minute TTL)
        const cached = this.entityCache.get(nzbn);
        if (cached && (Date.now() - cached.timestamp) < 300000) {
            console.log(`💾 Cache hit for ${nzbn}`);
            return {
                entityName: cached.name,
                entityStatusDescription: cached.status,
                sourceRegisterUniqueId: cached.sourceRegisterUniqueId
            };
        }

        // Fetch and cache
        const result = await fetchFn();
        this.entityCache.set(nzbn, {
            name: result.entityName,
            status: result.entityStatusDescription,
            sourceRegisterUniqueId: result.sourceRegisterUniqueId,
            timestamp: Date.now()
        });

        return result;
    }

    // OPTIMIZATION #4: Roles API response caching
    // Prevents redundant ~11s calls when the same entity name is searched across phases
    private async getCachedRoles(name: string): Promise<CompaniesRoleSearchResult> {
        const cacheKey = name.toUpperCase().trim();
        if (this.rolesCache.has(cacheKey)) {
            console.log(`💾 Roles cache hit for "${name}"`);
            return this.rolesCache.get(cacheKey)!;
        }
        const result = await fetchRolesByEntityName(name, this.config, this.companiesBaseUrl, this.logger);
        this.rolesCache.set(cacheKey, result);
        return result;
    }

    // --- Core Graph Building Logic ---

    public async buildGraph(rootNzbn: string, onDebug?: DebugCallback): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> {
        this.nodes.clear();
        this.edges = [];
        this.visited.clear();
        this.rootNzbn = rootNzbn;

        // PERFORMANCE TRACKING
        const startTime = performance.now();
        console.log(`🏎️ Graph build starting... (Using ${USE_LIGHTWEIGHT_ENDPOINTS ? 'OPTIMIZED' : 'LEGACY'} endpoints)`);

        // 1. Fetch Target (Center of the Butterfly)
        const rootDetails = await fetchEntityDetails(rootNzbn, this.config, this.nzbnBaseUrl, this.logger);

        if (onDebug) {
            onDebug('upstream', rootDetails, `Upstream Data (Target): ${rootDetails.entityName}`);
        }

        this.addNode({
            id: rootDetails.nzbn,
            type: 'companyNode',
            data: {
                label: rootDetails.entityName,
                nzbn: rootDetails.nzbn,
                sourceRegisterUniqueId: rootDetails.sourceRegisterUniqueId,
                status: rootDetails.entityStatusDescription,
                type: NodeType.COMPANY,
                isTarget: true, // Mark as center
            },
            position: { x: 0, y: 0 }
        });
        this.visited.add(rootNzbn);

        // PHASE 1: Crawl upstream to find all parents
        console.log('=== PHASE 1: Crawling Upstream (Finding Parents) ===');
        await this.crawlUpstream(rootDetails);

        // PHASE 2: For each parent we found, expand their full downstream structure
        // This reveals all siblings, cousins, uncles - the full corporate web
        console.log('=== PHASE 2: Expanding All Parent Structures (Full Web) ===');
        const parentsToExpand: string[] = [];

        // Find all parent/shareholder nodes
        for (const edge of this.edges) {
            if (edge.data?.relationshipType === 'parent') {
                if (!parentsToExpand.includes(edge.source) && edge.source !== rootNzbn) {
                    parentsToExpand.push(edge.source);
                }
            }
        }

        console.log(`Found ${parentsToExpand.length} parents to expand`);

        // OPTIMIZATION: Run Phase 2 (parent expansion) and Phase 3 (root downstream) IN PARALLEL.
        // They crawl different entities and the shared visited Set is safe under JS async concurrency.
        // This saves ~11s by overlapping the slow Roles API calls.
        console.log('=== PHASE 2+3: Expanding Parents + Root Downstream IN PARALLEL ===');

        const phase2Promises = parentsToExpand.map(async (parentNzbn) => {
            const parentNode = this.nodes.get(parentNzbn);
            if (parentNode && parentNode.data.type === NodeType.COMPANY && parentNode.data.nzbn) {
                console.log(`📊 Expanding full structure for parent: ${parentNode.data.label}`);

                const cleanName = parentNode.data.entityName ||
                    parentNode.data.label.replace(/^\d+\s*-\s*/, '').trim();

                console.log(`🔍 API search name: "${cleanName}" (original label: "${parentNode.data.label}")`);
                await this.crawlDownstream(parentNzbn, cleanName, 0, onDebug);
            }
        });

        // Phase 3 runs IN PARALLEL with all Phase 2 parent expansions
        const phase3Promise = this.crawlDownstream(rootDetails.nzbn, rootDetails.entityName, 0, onDebug);

        await Promise.all([...phase2Promises, phase3Promise]);

        if (onDebug) {
            onDebug('audit', {
                totalNodes: this.nodes.size,
                totalEdges: this.edges.length,
                parentsExpanded: parentsToExpand.length
            }, `Built full corporate web with ${parentsToExpand.length} parent structures expanded`);
        }

        // PERFORMANCE TRACKING
        const endTime = performance.now();
        const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`✅ Graph build complete in ${durationSeconds}s (${this.nodes.size} nodes, ${this.edges.length} edges)`);

        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges,
        };
    }

    // --- Upstream: Find owners of the current entity ---
    private async crawlUpstream(details: NZBNFullEntity, depth: number = 0) {
        if (depth > 3) return; // Hard limit on depth

        const companyDetails = details['company-details'];
        const isExtensive = companyDetails?.extensiveShareholding;
        const shareholdings = companyDetails?.shareholding;

        // Show warning for extensive shareholdings, but still process them
        if (isExtensive) {
            console.log(`⚠️ Extensive shareholdings detected for ${details.entityName} - showing top shareholders`);
        }

        if (shareholdings && shareholdings.shareAllocation) {
            // OPTIMIZATION: Prefetch all corporate parent statuses in parallel.
            // This populates the entity cache so the sequential loop below gets instant cache hits.
            const parentNzbnsToPreFetch = shareholdings.shareAllocation
                .flatMap((alloc: any) => alloc.shareholder || [])
                .filter((h: any) => h.otherShareholder?.nzbn)
                .map((h: any) => h.otherShareholder!.nzbn as string);

            if (parentNzbnsToPreFetch.length > 1) {
                console.log(`🚀 Prefetching ${parentNzbnsToPreFetch.length} parent statuses in parallel`);
                await Promise.all(parentNzbnsToPreFetch.map(nzbn =>
                    this.getCachedOrFetch(nzbn, () =>
                        fetchEntitySummaryLight(nzbn, this.config, this.nzbnBaseUrl, this.logger)
                    ).catch(e => console.warn(`Prefetch failed for ${nzbn}`, e))
                ));
            }

            const totalShares = shareholdings.numberOfShares || 0;

            for (const alloc of shareholdings.shareAllocation) {
                // Calculate share percentage for this allocation
                const allocShares = alloc.allocation || 0;
                const sharePercent = (totalShares > 0 && allocShares > 0)
                    ? Math.round((allocShares / totalShares) * 100)
                    : 0;

                for (const holder of alloc.shareholder) {
                    // Process all shareholders, even if extensive
                    // (removed the skip for individualShareholder when isExtensive)

                    let holderId = '';
                    let holderLabel = '';
                    let isPerson = false;
                    let parentNzbn = '';

                    if (holder.individualShareholder) {
                        holderLabel = holder.individualShareholder.fullName ||
                            `${holder.individualShareholder.firstName} ${holder.individualShareholder.lastName}`;
                        holderId = `IND-${holderLabel.replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 5)}`;
                        isPerson = true;
                    } else if (holder.otherShareholder) {
                        holderLabel = holder.otherShareholder.currentEntityName || 'Unknown Company';
                        holderId = holder.otherShareholder.nzbn || `ORG-${Math.random().toString(36).substr(2, 5)}`;
                        parentNzbn = holder.otherShareholder.nzbn || '';
                        isPerson = false;

                        // FILTER: Check if parent is removed before adding (OPTIMIZED)
                        if (parentNzbn) {
                            try {
                                // OPTIMIZATION: Use cached lightweight endpoint
                                const parentData = await this.getCachedOrFetch(
                                    parentNzbn,
                                    () => fetchEntitySummaryLight(parentNzbn, this.config, this.nzbnBaseUrl, this.logger)
                                );

                                const isInactive = parentData.entityStatusDescription.toLowerCase().includes('removed') ||
                                    parentData.entityStatusDescription.toLowerCase().includes('deleted') ||
                                    parentData.entityStatusDescription.toLowerCase().includes('liquidat');

                                if (isInactive && !this.config.includeInactive) {
                                    console.log(`[Parent: ${holderLabel}] ⏭️ Skipped: Entity is ${parentData.entityStatusDescription} (includeInactive=false)`);
                                    continue; // Skip BEFORE marking as visited
                                }

                                // Store the sourceRegisterUniqueId for later use
                                var parentSourceRegisterUniqueId = parentData.sourceRegisterUniqueId;
                            } catch (e) {
                                // If we can't fetch, skip
                                console.warn(`Failed to verify parent status for ${parentNzbn}`, e);
                                continue;
                            }
                        }
                    }

                    if (!holderId || this.nodes.has(holderId)) continue;

                    // Add Node
                    this.addNode({
                        id: holderId,
                        type: isPerson ? 'personNode' : 'companyNode',
                        data: {
                            label: holderLabel,
                            nzbn: parentNzbn,
                            sourceRegisterUniqueId: isPerson ? undefined : parentSourceRegisterUniqueId,
                            type: isPerson ? NodeType.PERSON : NodeType.COMPANY,
                            status: isPerson ? undefined : 'Parent'
                        },
                        position: { x: 0, y: 0 }
                    });

                    // Add Edge (Parent -> Child) with share percentage if available
                    const edgeLabel = sharePercent > 0
                        ? `▼ Shareholder (${sharePercent}%)`
                        : '▼ Shareholder';
                    this.addEdge(holderId, details.nzbn, edgeLabel, 'parent');

                    // Recursive Upstream for Corporate Parents
                    if (!isPerson && parentNzbn && !this.visited.has(parentNzbn)) {
                        this.visited.add(parentNzbn);
                        try {
                            // OPTIMIZATION: Removed crawlSiblings here - Phase 2's crawlDownstream
                            // discovers all siblings with better data (share percentages, strict matching).
                            // This saves ~11s per parent by eliminating a redundant Roles API call.

                            // Recurse upstream
                            const parentDetails = await fetchEntityDetails(parentNzbn, this.config, this.nzbnBaseUrl, this.logger);
                            await this.crawlUpstream(parentDetails, depth + 1);
                        } catch (e) {
                            console.warn(`Failed upstream fetch for ${parentNzbn}`, e);
                        }
                    }
                }
            }
        } else if (details.roles && details.roles.length > 0) {
            // Processing non-company roles (e.g. General Partners of a Limited Partnership)
            for (const role of details.roles) {
                // Ignore resigned/inactive roles
                if (role.roleStatus && role.roleStatus.toLowerCase() !== 'active') continue;

                let holderId = '';
                let holderLabel = '';
                let isPerson = false;
                let parentNzbn = '';
                let parentSourceRegisterUniqueId: string | undefined = undefined;

                if (role.rolePerson?.fullName || role.rolePerson?.firstName) {
                    holderLabel = role.rolePerson.fullName || `${role.rolePerson.firstName} ${role.rolePerson.lastName}`;
                    holderId = `IND-${holderLabel.replace(/\s+/g, '-')}-${Math.random().toString(36).substr(2, 5)}`;
                    isPerson = true;
                } else if (role.roleEntity?.name || role.roleEntity?.nzbn) {
                    holderLabel = role.roleEntity.name || 'Unknown Entity';
                    parentNzbn = role.roleEntity.nzbn || '';
                    holderId = parentNzbn || `ORG-${Math.random().toString(36).substr(2, 5)}`;
                    isPerson = false;

                    if (parentNzbn) {
                        try {
                            const parentData = await this.getCachedOrFetch(
                                parentNzbn,
                                () => fetchEntitySummaryLight(parentNzbn, this.config, this.nzbnBaseUrl, this.logger)
                            );

                            // 🚀 FIX: IF holderLabel is Unknown, populate it now from the actual registry summary:
                            if (holderLabel === 'Unknown Entity' && parentData.entityName) {
                                holderLabel = parentData.entityName;
                            }

                            const isInactive = parentData.entityStatusDescription.toLowerCase().includes('removed') ||
                                parentData.entityStatusDescription.toLowerCase().includes('deleted') ||
                                parentData.entityStatusDescription.toLowerCase().includes('liquidat');

                            if (isInactive && !this.config.includeInactive) {
                                console.log(`[Role Entity: ${holderLabel}] ⏭️ Skipped: Entity is ${parentData.entityStatusDescription}`);
                                continue;
                            }
                            parentSourceRegisterUniqueId = parentData.sourceRegisterUniqueId;
                        } catch (e) {
                            console.warn(`Failed to verify role entity status for ${parentNzbn}`, e);
                            continue;
                        }
                    }
                } else {
                    continue; // Skip if no person or entity details
                }

                if (!holderId || this.nodes.has(holderId)) continue;

                this.addNode({
                    id: holderId,
                    type: isPerson ? 'personNode' : 'companyNode',
                    data: {
                        label: holderLabel,
                        nzbn: parentNzbn,
                        sourceRegisterUniqueId: parentSourceRegisterUniqueId,
                        type: isPerson ? NodeType.PERSON : NodeType.COMPANY,
                        status: role.roleType || 'Entity Role',
                        entityTypeDescription: isPerson ? undefined : 'Role Entity'
                    },
                    position: { x: 0, y: 0 }
                });

                this.addEdge(holderId, details.nzbn, `▼ ${role.roleType}`, 'parent');

                if (!isPerson && parentNzbn && !this.visited.has(parentNzbn)) {
                    this.visited.add(parentNzbn);
                    try {
                        // OPTIMIZATION: Removed crawlSiblings here - Phase 2 handles sibling discovery.
                        const parentDetails = await fetchEntityDetails(parentNzbn, this.config, this.nzbnBaseUrl, this.logger);
                        await this.crawlUpstream(parentDetails, depth + 1);
                    } catch (e) {
                        console.warn(`Failed upstream fetch for role ${parentNzbn}`, e);
                    }
                }
            }
        }
    }

    // --- Downstream: Find who the target owns ---
    private async crawlDownstream(ownerNzbn: string, ownerName: string, depth: number = 0, onDebug?: DebugCallback) {
        if (depth > 2) return;
        // OPTIMIZATION: Use smart rate limiting instead of hardcoded 150ms delay.
        // Since Roles API takes ~11s per call, we never hit 10 req/s — this becomes a no-op.
        await this.smartDelay();

        // "Use the Legal Name... exactly as returned"
        // We start with the ownerName which matches the entityName from NZBN details.

        // OPTIMIZATION: Use cached roles to avoid redundant ~11s API calls
        let results: CompaniesRoleSearchResult = await this.getCachedRoles(ownerName);
        let usedName = ownerName;

        // ---------------- LOGGING START ----------------
        console.log(`%c[Downstream] Raw API Response for ${usedName}:`, "color: #00ffff; font-weight: bold", results);
        console.log(`%c[Downstream] Total roles returned:`, "color: #00ffff", results.roles.length);

        // Log each role's type to see exact values
        results.roles.forEach((role, idx) => {
            console.log(`%c[Downstream] Role ${idx}:`, "color: #ffaa00", {
                roleType: role.roleType,
                roleTypeExact: JSON.stringify(role.roleType),
                associatedCompanyName: role.associatedCompanyName,
                associatedCompanyNzbn: role.associatedCompanyNzbn
            });
        });
        // ---------------- LOGGING END ------------------

        // Diagnostic Reporting
        if (onDebug) {
            // STRICT: Only count OrganisationShareholder
            const orgShareholders = results.roles.filter(r => r.roleType === 'OrganisationShareholder');
            const firstAssociated = orgShareholders.length > 0 ? orgShareholders[0].associatedCompanyName : 'None';

            const diagnosticMsg = orgShareholders.length > 0
                ? `Found ${orgShareholders.length} OrganisationShareholder roles using name "${usedName}".`
                : `Diagnostic: No OrganisationShareholder roles found for "${ownerName}" (tried: "${usedName}") in production.`;
            onDebug('downstream', results, diagnosticMsg);

            onDebug('audit', {
                searchName: usedName,
                status: results.status,
                totalResults: results.totalResults,
                rolesReturned: results.roles.length,
                orgShareholderCount: orgShareholders.length,
                firstMatch: firstAssociated
            });
        }

        for (const role of results.roles) {
            // --- Filter Logic Trace ---
            const logPrefix = `[RoleCheck: ${role.associatedCompanyName || 'Unknown'}]`;

            console.log(`${logPrefix} Checking roleType: "${role.roleType}"`);

            // FLEXIBLE: Check if roleType contains 'Shareholder' and is not Individual/Director
            const isOrgShareholder = role.roleType &&
                role.roleType.includes('Shareholder') &&
                !role.roleType.includes('Individual') &&
                !role.roleType.includes('Director');

            if (!isOrgShareholder) {
                console.log(`${logPrefix} ❌ Skipped: Role is '${role.roleType}', not matching OrganisationShareholder pattern.`);
                continue;
            }

            // CRITICAL FIX: The Roles API uses aggressive fuzzy matching.
            // Verify the returned role actually matches the company we searched for strictly.
            const matchedName = (role.name || '').toUpperCase().trim();
            const targetName = ownerName.toUpperCase().trim();

            // Normalize names by standardizing common abbreviations and stripping punctuation/spaces
            const normalizeName = (n: string) => n
                .replace(/\bLTD\.?\b/g, 'LIMITED')
                .replace(/\bCO\.?\b/g, 'COMPANY')
                .replace(/[^A-Z0-9]/g, '');

            const isStrictMatch =
                (role.nzbn && role.nzbn === ownerNzbn) ||
                (normalizeName(matchedName) === normalizeName(targetName));

            if (!isStrictMatch) {
                console.log(`${logPrefix} ❌ Skipped: Fuzzy match rejected. API returned "${role.name}" (NZBN: ${role.nzbn || 'N/A'}) but we need "${ownerName}".`);
                continue;
            }

            console.log(`${logPrefix} ✅ MATCHED! Processing as subsidiary.`);

            // CRITICAL FIX: For OrganisationShareholder roles, subsidiaries are in shareholdings array
            if (!role.shareholdings || role.shareholdings.length === 0) {
                console.log(`${logPrefix} ❌ No shareholdings array found - skipping.`);
                continue;
            }

            //Process each company in the shareholdings array
            for (const holding of role.shareholdings) {
                const childNzbn = holding.associatedCompanyNzbn;
                const childNameRaw = holding.associatedCompanyName;
                const holdingLogPrefix = `[Holding: ${childNameRaw || 'Unknown'}]`;

                console.log(`${holdingLogPrefix} Found subsidiary:`, {
                    name: childNameRaw,
                    nzbn: childNzbn,
                    sharePercentage: holding.sharePercentage
                });

                // Must have NZBN
                if (!childNzbn) {
                    console.warn(`${holdingLogPrefix} Skipped: Missing NZBN.`);
                    continue;
                }

                if (this.visited.has(childNzbn)) {
                    console.log(`${holdingLogPrefix} Skipped: Already visited.`);
                    continue;
                }

                if (childNzbn === this.rootNzbn) {
                    console.log(`${holdingLogPrefix} Skipped: Is Root Entity.`);
                    continue;
                }

                // Get Share Percentage for Edge Label
                const shareLabel = holding.sharePercentage !== undefined && holding.sharePercentage > 0
                    ? `▼ Shareholder (${holding.sharePercentage}%)`
                    : '▼ Shareholder';

                // Visual Debugging Console Log
                console.log(`%c[GraphBuilder] Creating Subsidiary Node: ${childNameRaw} (${childNzbn})`, "color: lime; font-weight: bold");

                // Create Edge
                this.addEdge(ownerNzbn, childNzbn, shareLabel, 'subsidiary');

                let childLabel = childNameRaw || 'Unknown Company';
                let childStatus = 'Subsidiary';

                try {
                    // OPTIMIZATION #3: Fetch with caching (avoids duplicate fetches)
                    const childSummary = await this.getCachedOrFetch(
                        childNzbn,
                        () => fetchEntitySummaryLight(childNzbn, this.config, this.nzbnBaseUrl, this.logger)
                    );
                    childLabel = childSummary.entityName;
                    childStatus = childSummary.entityStatusDescription;

                    // FILTER: Skip removed/inactive entities BEFORE marking as visited
                    const isInactive = childStatus.toLowerCase().includes('removed') ||
                        childStatus.toLowerCase().includes('deleted') ||
                        childStatus.toLowerCase().includes('liquidat');

                    if (isInactive && !this.config.includeInactive) {
                        console.log(`${holdingLogPrefix} ⏭️ Skipped: Entity is ${childStatus} (includeInactive=false)`);
                        continue; // Skip BEFORE marking as visited - prevents taking up space
                    }

                    // Only mark as visited if we're actually adding it
                    this.visited.add(childNzbn);

                    this.addNode({
                        id: childNzbn,
                        type: 'companyNode',
                        data: {
                            label: childLabel,
                            nzbn: childNzbn,
                            sourceRegisterUniqueId: childSummary.sourceRegisterUniqueId || holding.associatedCompanyNumber,
                            type: NodeType.COMPANY,
                            status: childStatus,
                        },
                        position: { x: 0, y: (depth + 1) * 200 }
                    });

                    // Recurse downstream
                    await this.crawlDownstream(childNzbn, childLabel, depth + 1, onDebug);

                } catch (e) {
                    console.warn(`Failed to fetch details for subsidiary ${childNzbn}`, e);
                    // Add node even if details fetch fails
                    this.addNode({
                        id: childNzbn,
                        type: 'companyNode',
                        data: {
                            label: childNameRaw || 'Unknown Company',
                            nzbn: childNzbn,
                            type: NodeType.COMPANY,
                            status: 'Unknown',
                        },
                        position: { x: 0, y: (depth + 1) * 200 }
                    });
                    this.visited.add(childNzbn);
                }
            }
        }
    }

    // --- Siblings: Find other companies owned by the Parent ---
    private async crawlSiblings(parentNzbn: string, parentName: string, originalChildNzbn: string) {
        await delay(150);

        const results = await fetchRolesByEntityName(parentName, this.config, this.companiesBaseUrl, this.logger);

        let siblingCount = 0;
        for (const role of results.roles) {
            if (siblingCount > 6) break; // Limit visual clutter

            if (role.roleType && role.roleType.toLowerCase().includes('shareholder')) {
                const siblingNzbn = role.associatedCompanyNzbn;
                const siblingName = role.associatedCompanyName;

                if (!siblingNzbn) continue; // Siblings need NZBNs to be worth showing in this context

                if (siblingNzbn === originalChildNzbn) continue;
                if (this.nodes.has(siblingNzbn)) continue;

                this.addNode({
                    id: siblingNzbn,
                    type: 'companyNode',
                    data: {
                        label: siblingName,
                        nzbn: siblingNzbn,
                        type: NodeType.COMPANY,
                        status: 'Sibling'
                    },
                    position: { x: 0, y: 0 }
                });

                this.addEdge(parentNzbn, siblingNzbn, 'Sibling', 'sibling');
                siblingCount++;
            }
        }
    }

    private addNode(node: GraphNode) {
        if (!this.nodes.has(node.id)) {
            this.nodes.set(node.id, node);
        }
    }

    private addEdge(source: string, target: string, label: string, type: 'parent' | 'subsidiary' | 'sibling' | 'common') {
        const id = `e-${source}-${target}`;
        if (this.edges.some(e => e.id === id)) return;

        this.edges.push({
            id,
            source,
            target,
            label,
            data: { percentage: 0, label, relationshipType: type },
            animated: type === 'subsidiary',
            style: { stroke: type === 'sibling' ? '#94a3b8' : '#2563eb' },
            markerEnd: 'arrowclosed' as any // Fix: Use string instead of object
        });
    }
}

// --- API Helpers ---

async function safeFetch(url: string, headers: HeadersInit, logger?: LoggerCallback) {
    const method = 'GET';

    // Log Request
    if (logger) {
        const maskedHeaders: Record<string, string> = {};
        if (typeof headers === 'object' && !Array.isArray(headers)) {
            Object.entries(headers as Record<string, string>).forEach(([k, v]) => {
                // Mask all but first 4 chars
                maskedHeaders[k] = v.length > 4 ? v.substring(0, 4) + '****' : '****';
            });
        }

        logger({
            timestamp: new Date().toISOString(),
            method,
            url,
            headers: maskedHeaders,
            status: 0,
            message: 'Sending Request...'
        });
    }

    try {
        const res = await fetch(url, { headers });

        // Log Response
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
        // Log Error
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

        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            throw new Error("CORS/Network Error: Check API Keys and Network.");
        }
        throw error;
    }
}


// LEGACY FUNCTION (Preserved for Time Snapshot feature)
// Fetches full entity details including shareholding history, roles, etc.
// Used when historical data is needed for time snapshot queries
async function fetchEntityDetailsFull(nzbn: string, config: ApiConfig, baseUrl: string, logger?: LoggerCallback): Promise<NZBNFullEntity> {
    const proxyPath = `${API_PATHS.nzbn}/entities/${nzbn}`;
    const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;
    const res = await safeFetch(url, {
        'x-user-api-key': config.nzbnKey || '',
        'x-api-type': 'nzbn',
        'Accept': 'application/json'
    }, logger);

    if (!res.ok) {
        if (res.status === 404) throw new Error(`Entity ${nzbn} not found.`);
        if (res.status === 401) throw new Error("NZBN API Unauthorized.");
        throw new Error(`NZBN API Error: ${res.status}`);
    }
    return await res.json();
}

// OPTIMIZED FUNCTION (Default for current graphs)
// Fetches minimal entity data (name, nzbn, status) for 70-80% speed improvement
// Uses direct primary key lookup instead of slow full-text search
async function fetchEntitySummary(nzbn: string, config: ApiConfig, baseUrl: string, logger?: LoggerCallback): Promise<{ entityName: string, nzbn: string, entityStatusDescription: string, sourceRegisterUniqueId?: string }> {
    const proxyPath = `${API_PATHS.nzbn}/entities/${encodeURIComponent(nzbn)}`;
    const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;
    const res = await safeFetch(url, {
        'x-user-api-key': config.nzbnKey || '',
        'x-api-type': 'nzbn',
        'Accept': 'application/json'
    }, logger);

    if (!res.ok) {
        if (res.status === 404) throw new Error(`Entity ${nzbn} not found.`);
        if (res.status === 401) throw new Error("NZBN API Unauthorized.");
        throw new Error(`NZBN API Error: ${res.status}`);
    }

    const data = await res.json();

    // Return just the minimal fields we need
    // Note: Full endpoint uses sourceRegisterUniqueIdentifier, search uses sourceRegisterUniqueId
    return {
        entityName: data.entityName,
        nzbn: data.nzbn,
        entityStatusDescription: data.entityStatusDescription || 'Unknown',
        sourceRegisterUniqueId: data.sourceRegisterUniqueId || data.sourceRegisterUniqueIdentifier
    };
}

// SELECTIVE OPTIMIZATION: Status-only check (for filtering)
// Uses direct primary key lookup instead of slow full-text search
async function fetchEntityStatusOnly(nzbn: string, config: ApiConfig, baseUrl: string, logger?: LoggerCallback): Promise<{ status: string, sourceRegisterUniqueId?: string }> {
    try {
        const proxyPath = `${API_PATHS.nzbn}/entities/${encodeURIComponent(nzbn)}`;
        const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;
        const res = await safeFetch(url, {
            'x-user-api-key': config.nzbnKey || '',
            'x-api-type': 'nzbn',
            'Accept': 'application/json'
        }, logger);

        if (!res.ok) throw new Error(`Status check failed: ${res.status}`);

        const data = await res.json();

        return {
            status: data.entityStatusDescription || 'Unknown',
            sourceRegisterUniqueId: data.sourceRegisterUniqueId || data.sourceRegisterUniqueIdentifier
        };
    } catch (e) {
        console.warn(`Status check failed for ${nzbn}`, e);
        return { status: 'Unknown', sourceRegisterUniqueId: undefined };
    }
}


// SELECTIVE OPTIMIZATION: Summary for subsidiaries (name + status only)
// Uses direct primary key lookup instead of slow full-text search
async function fetchEntitySummaryLight(nzbn: string, config: ApiConfig, baseUrl: string, logger?: LoggerCallback): Promise<{ entityName: string, entityStatusDescription: string, sourceRegisterUniqueId?: string }> {
    try {
        const proxyPath = `${API_PATHS.nzbn}/entities/${encodeURIComponent(nzbn)}`;
        const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;
        const res = await safeFetch(url, {
            'x-user-api-key': config.nzbnKey || '',
            'x-api-type': 'nzbn',
            'Accept': 'application/json'
        }, logger);

        if (!res.ok) throw new Error(`Summary fetch failed: ${res.status}`);

        const data = await res.json();

        return {
            entityName: data.entityName,
            entityStatusDescription: data.entityStatusDescription || 'Unknown',
            sourceRegisterUniqueId: data.sourceRegisterUniqueId || data.sourceRegisterUniqueIdentifier
        };
    } catch (e) {
        console.warn(`Summary check failed for ${nzbn}`, e);
        return { entityName: 'Unknown', entityStatusDescription: 'Unknown', sourceRegisterUniqueId: undefined };
    }
}

// Smart wrapper: Uses lightweight or full endpoint based on feature flag
async function fetchEntityDetails(nzbn: string, config: ApiConfig, baseUrl: string, logger?: LoggerCallback): Promise<NZBNFullEntity> {
    if (USE_LIGHTWEIGHT_ENDPOINTS) {
        // Fetch lightweight summary
        const summary = await fetchEntitySummary(nzbn, config, baseUrl, logger);

        // Convert to NZBNFullEntity format with minimal required fields
        return {
            entityName: summary.entityName,
            nzbn: summary.nzbn,
            entityStatusDescription: summary.entityStatusDescription,
            sourceRegisterUniqueId: summary.sourceRegisterUniqueId,
            'company-details': { shareholding: null } // Minimal stub
        } as NZBNFullEntity;
    } else {
        // Use legacy full endpoint for main data
        const fullDetails = await fetchEntityDetailsFull(nzbn, config, baseUrl, logger);

        // OPTIMIZATION: The full endpoint returns sourceRegisterUniqueIdentifier (not sourceRegisterUniqueId).
        // Map the field name instead of making a redundant second API call. Saves ~300ms per call.
        if (!fullDetails.sourceRegisterUniqueId && (fullDetails as any).sourceRegisterUniqueIdentifier) {
            fullDetails.sourceRegisterUniqueId = (fullDetails as any).sourceRegisterUniqueIdentifier;
        }

        return fullDetails;
    }
}

async function fetchRolesByEntityName(name: string, config: ApiConfig, baseUrl: string, logger?: LoggerCallback): Promise<CompaniesRoleSearchResult> {
    try {
        // Enclose in double quotes to force exact match and prevent MBIE from doing slow fuzzy searching/OR matching.
        // Without this MBIE will `OR` query every common word across 700k records, taking 30 seconds.
        const encodedName = encodeURIComponent(`"${name}"`);

        // UPDATED: Strictly using verified 'role-type' (singular) and enum 'SHR' with pagination
        const proxyPath = `${API_PATHS.companies}/search?name=${encodedName}&role-type=SHR&page-size=100`;
        const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;

        // Strict Specs: Visual Log confirmation
        console.log(`If I were to call this in the browser, the URL would look like this: ${url}`);

        console.log(`Fetching roles: ${url}`);

        const res = await safeFetch(url, {
            'x-user-api-key': config.companiesKey || '',
            'x-api-type': 'companies',
            'Accept': 'application/json'
        }, logger);

        const status = res.status;

        if (!res.ok) {
            console.warn(`Role search failed: ${res.status}`);
            return { roles: [], status };
        }

        const data = await res.json();
        return { ...data, status };
    } catch (e) {
        console.warn("Role Search Error", e);
        return { roles: [], status: 0 };
    }
}

async function fetchDirectorsByEntityName(name: string, config: ApiConfig, baseUrl: string, logger?: LoggerCallback): Promise<CompaniesRoleSearchResult> {
    try {
        // Enclose in double quotes to force exact match
        const encodedName = encodeURIComponent(`"${name}"`);
        const proxyPath = `${API_PATHS.companies}/search?name=${encodedName}&role-type=DIR&page-size=50`;
        const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;

        console.log(`Fetching directors: ${url}`);

        const res = await safeFetch(url, {
            'x-user-api-key': config.companiesKey || '',
            'x-api-type': 'companies',
            'Accept': 'application/json'
        }, logger);

        const status = res.status;

        if (!res.ok) {
            console.warn(`Director search failed: ${res.status}`);
            return { roles: [], status };
        }

        const data = await res.json();
        return { ...data, status };
    } catch (e) {
        console.warn("Director Search Error", e);
        return { roles: [], status: 0 };
    }
}

export const searchEntities = async (term: string, config: ApiConfig, logger?: LoggerCallback): Promise<EntitySearchResultItem[]> => {
    const baseUrl = `/api/proxy`;
    // Enclose in double quotes to force exact match
    const encodedTerm = encodeURIComponent(`"${term}"`);
    const proxyPath = `${API_PATHS.nzbn}/entities?search-term=${encodedTerm}&page-size=10`;
    const url = `${baseUrl}?path=${encodeURIComponent(proxyPath)}`;

    const response = await safeFetch(url, {
        'x-user-api-key': config.nzbnKey || '',
        'x-api-type': 'nzbn',
        'Accept': 'application/json'
    }, logger);

    if (!response.ok) throw new Error(`Search failed: ${response.status}`);

    const data = await response.json();
    return data.items || [];
};

export const generateOrgChart = async (rootNzbn: string, config: ApiConfig, onDebug?: DebugCallback, onLog?: LoggerCallback) => {
    const spider = new OrgSpider(config, onLog);
    return await spider.buildGraph(rootNzbn, onDebug);
};

export const getDirectors = fetchDirectorsByEntityName;