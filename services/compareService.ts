import { ApiConfig, GraphEdge, GraphNode, LoggerCallback, NodeType } from '../types.js';
import { fetchEntityDetails, fetchRolesByEntityName, resolveEntityNzbn } from './apiService.js';
import { searchByPersonName } from './directorSearchService.js';
import { personId, displayPersonName } from '../utils/personId.js';

export { personId, displayPersonName };

/**
 * Compare feature — bidirectional BFS between two endpoints (company/person)
 * over the NZ registers, per design/COMPARE_PLAN.md.
 *
 * API cost model:
 * - Company upstream neighbors: ONE fetchEntityDetails call (~0.3–1s) gives
 *   corporate parents, individual shareholders AND directors (roles array).
 * - Person neighbors: ONE searchByPersonName call (~1–3s) gives all companies
 *   the person is linked to (directorships + shareholdings, strict-filtered).
 * - Company downstream subsidiaries: fetchRolesByEntityName (~11s) — used ONLY
 *   for the two endpoint companies at depth 0, never for interior nodes.
 */

export type CompareEndpoint =
  | { kind: 'company'; nzbn: string; name: string }
  | { kind: 'person'; name: string };

export interface CompareProgress {
  hop: number;
  entitiesExamined: number;
  apiCalls: number;
  currentName?: string;
}

export interface CompareResult {
  found: boolean;
  hops: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  pathNodeIds: string[];
  pathEdgeIds: string[];
  stats: {
    apiCalls: number;
    entitiesExamined: number;
    truncated: boolean;
  };
}

export interface CompareOptions {
  maxHops?: number;
  onProgress?: (p: CompareProgress) => void;
  onLog?: LoggerCallback;
  shouldCancel?: () => boolean;
}

// Budgets (see plan §Algorithm 4)
const DEFAULT_MAX_HOPS = 4;
const MAX_API_CALLS = 50;
const MAX_FRONTIER_PER_LEVEL = 15;
const MAX_WALL_CLOCK_MS = 90_000;
const MAX_CONTEXT_NODES = 40;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Neighbor {
  node: GraphNode;
  edge: GraphEdge;
}

interface Visit {
  depth: number;
  /** All same-depth predecessors — kept so every shortest path can be reconstructed. */
  parents: Array<{ id: string; edgeId: string }>;
}

const makeCompanyNode = (nzbn: string, label: string, status?: string): GraphNode => ({
  id: nzbn,
  type: 'companyNode',
  data: {
    label,
    entityName: label,
    nzbn,
    type: NodeType.COMPANY,
    status,
    isVisible: true,
  },
  position: { x: 0, y: 0 },
});

const makePersonNode = (name: string): GraphNode => ({
  id: personId(name),
  type: 'personNode',
  data: {
    label: displayPersonName(name),
    type: NodeType.PERSON,
    isVisible: true,
  },
  position: { x: 0, y: 0 },
});

const makeEdge = (
  source: string,
  target: string,
  label: string,
  relationshipType: 'parent' | 'subsidiary' | 'sibling' | 'common',
  isCeased = false,
  roleKind?: 'shareholder' | 'director' | 'both'
): GraphEdge => ({
  id: `e-${source}-${target}`,
  source,
  target,
  data: { percentage: 0, label, relationshipType, isCeased, roleKind },
  style: isCeased
    ? { stroke: 'var(--ink-wash)', strokeWidth: 1.4, strokeDasharray: '6 5', opacity: 0.75 }
    : roleKind === 'director' || roleKind === 'both'
      ? { stroke: 'var(--ink-mid)', strokeDasharray: '5 4' }
      : { stroke: 'var(--ink-mid)' },
  markerEnd: 'arrowclosed',
});

// Combines a shareholder edge label and a director edge label for the same
// person/company pair into one — mirrors apiService.ts mergeRoleEdgeLabels.
const mergeRoleEdgeLabels = (a: string, b: string): string => {
  const pct = a.match(/\((\d+)%\)/) || b.match(/\((\d+)%\)/);
  return `▼ Director & Shareholder${pct ? ` (${pct[1]}%)` : ''}`;
};

/**
 * Merges a shareholder Neighbor and a director Neighbor to the SAME node
 * (person→company or company→company) into one 'both' edge. Two edges
 * between the same node pair render as coincident, illegible lines on a real
 * layout (both nodes have exactly one handle per side) — confirmed against a
 * live chart — so this collapses them before they ever reach the graph.
 */
const mergeRoleNeighbors = (neighbors: Neighbor[]): Neighbor[] => {
  const byNodeId = new Map<string, Neighbor>();
  for (const n of neighbors) {
    const existing = byNodeId.get(n.node.id);
    if (existing && existing.edge.data?.roleKind && n.edge.data?.roleKind && existing.edge.data.roleKind !== n.edge.data.roleKind) {
      existing.edge.data.roleKind = 'both';
      existing.edge.data.label = mergeRoleEdgeLabels(existing.edge.data.label, n.edge.data.label);
      if (!existing.edge.data.isCeased && !n.edge.data.isCeased) {
        existing.edge.style = { stroke: 'var(--ink-mid)', strokeDasharray: '5 4' };
      }
      continue;
    }
    byNodeId.set(n.node.id, n);
  }
  return Array.from(byNodeId.values());
};

// Mirrors the strict-match normalization at apiService.ts:514 — the Roles API
// fuzzy-matches aggressively, so downstream hits must be verified by name/NZBN.
const normalizeCompanyName = (n: string): string =>
  n
    .toUpperCase()
    .trim()
    .replace(/\bLTD\.?\b/g, 'LIMITED')
    .replace(/\bCO\.?\b/g, 'COMPANY')
    .replace(/[^A-Z0-9]/g, '');

export async function findConnection(
  a: CompareEndpoint,
  b: CompareEndpoint,
  config: ApiConfig,
  options: CompareOptions = {}
): Promise<CompareResult> {
  const maxHops = options.maxHops ?? DEFAULT_MAX_HOPS;
  const { onProgress, onLog, shouldCancel } = options;
  const startTime = Date.now();

  let apiCalls = 0;
  let entitiesExamined = 0;
  let truncated = false;

  // Smart rate limiting — same shape as OrgSpider.smartDelay
  const requestTimes: number[] = [];
  const smartDelay = async () => {
    const now = Date.now();
    while (requestTimes.length > 0 && now - requestTimes[0] > 1000) requestTimes.shift();
    if (requestTimes.length > 10) await delay(100);
    requestTimes.push(Date.now());
  };

  // Everything discovered during the search — reused (no extra calls) as the
  // 1-hop context around the found path.
  const discoveredNodes = new Map<string, GraphNode>();
  const discoveredEdges = new Map<string, GraphEdge>();

  const recordNode = (node: GraphNode) => {
    if (!discoveredNodes.has(node.id)) discoveredNodes.set(node.id, node);
  };
  const recordEdge = (edge: GraphEdge) => {
    if (!discoveredEdges.has(edge.id)) discoveredEdges.set(edge.id, edge);
  };

  // ---- Neighbor adapters --------------------------------------------------

  /** All upstream neighbors + directors of a company: ONE cheap call. */
  const expandCompanyUpstream = async (nzbn: string): Promise<Neighbor[]> => {
    const neighbors: Neighbor[] = [];
    await smartDelay();
    apiCalls++;
    let details;
    try {
      details = await fetchEntityDetails(nzbn, config, '/api/proxy', onLog);
    } catch (e) {
      console.warn(`[Compare] Entity fetch failed for ${nzbn}`, e);
      return neighbors;
    }

    // Refresh the company node's label/status from the register
    const self = discoveredNodes.get(nzbn);
    if (self && details.entityName) {
      self.data.label = details.entityName;
      self.data.entityName = details.entityName;
      if (!self.data.status) self.data.status = details.entityStatusDescription;
      self.data.sourceRegisterUniqueId = self.data.sourceRegisterUniqueId || details.sourceRegisterUniqueId;
    }

    // Shareholders (mirrors OrgSpider.crawlUpstream parsing)
    const shareholdings = details['company-details']?.shareholding;
    if (shareholdings?.shareAllocation) {
      const totalShares = (shareholdings as any).numberOfShares || 0;
      for (const alloc of shareholdings.shareAllocation) {
        const allocShares = alloc.allocation || 0;
        const sharePercent =
          totalShares > 0 && allocShares > 0 ? Math.round((allocShares / totalShares) * 100) : 0;
        const edgeLabel = sharePercent > 0 ? `▼ Shareholder (${sharePercent}%)` : '▼ Shareholder';

        for (const holder of alloc.shareholder || []) {
          if (holder.individualShareholder) {
            const fullName =
              holder.individualShareholder.fullName ||
              `${holder.individualShareholder.firstName || ''} ${holder.individualShareholder.lastName || ''}`;
            if (!fullName.trim()) continue;
            const node = makePersonNode(fullName);
            neighbors.push({ node, edge: makeEdge(node.id, nzbn, edgeLabel, 'parent', false, 'shareholder') });
          } else if (holder.otherShareholder) {
            // A corporate holder with no `nzbn` on the shareholding record is
            // not necessarily overseas or unregistered — the register simply did
            // not link it. Recover the NZBN (one cached search) so the BFS can
            // walk through it; a holder that stays unresolved is still skipped,
            // because there is nothing to expand without an NZBN.
            let parentNzbn = holder.otherShareholder.nzbn || '';
            if (!parentNzbn) {
              apiCalls++;
              parentNzbn = await resolveEntityNzbn(
                holder.otherShareholder.companyNumber,
                holder.otherShareholder.currentEntityName,
                config,
                '/api/proxy',
                onLog
              );
            }
            if (!parentNzbn) continue;
            const node = makeCompanyNode(
              parentNzbn,
              holder.otherShareholder.currentEntityName || 'Unknown Company'
            );
            neighbors.push({ node, edge: makeEdge(parentNzbn, nzbn, edgeLabel, 'parent') });
          }
        }
      }
    }

    // Directors + entity roles (mirrors handleShowDirectors' active-director filter)
    for (const role of details.roles || []) {
      const roleType = (role.roleType || '').toLowerCase();
      const roleStatus = (role.roleStatus || '').toLowerCase();
      const ended = !!(role as any).endDate;
      const isActive = roleStatus === 'active' && !ended;
      if (role.rolePerson?.fullName || role.rolePerson?.firstName) {
        if (roleType !== 'director' || !isActive) continue;
        const fullName =
          role.rolePerson.fullName ||
          [role.rolePerson.firstName, (role.rolePerson as any).middleNames || role.rolePerson.middleName, role.rolePerson.lastName]
            .filter(Boolean)
            .join(' ');
        if (!fullName.trim()) continue;
        const node = makePersonNode(fullName);
        neighbors.push({ node, edge: makeEdge(node.id, nzbn, '▼ Director', 'parent', false, 'director') });
      } else if (role.roleEntity?.entityName || role.roleEntity?.name || role.roleEntity?.nzbn) {
        // Non-person roles (e.g. General Partner of a Limited Partnership).
        // roleEntity.nzbn is documented as "currently not populated", so these
        // only ever link up by resolving the name.
        if (!isActive) continue;
        const roleEntityName = role.roleEntity.entityName || role.roleEntity.name || '';
        let roleEntityNzbn = role.roleEntity.nzbn || '';
        if (!roleEntityNzbn && roleEntityName) {
          apiCalls++;
          roleEntityNzbn = await resolveEntityNzbn(undefined, roleEntityName, config, '/api/proxy', onLog);
        }
        if (!roleEntityNzbn) continue;
        const node = makeCompanyNode(roleEntityNzbn, roleEntityName || 'Unknown Entity');
        neighbors.push({ node, edge: makeEdge(node.id, nzbn, `▼ ${role.roleType}`, 'parent') });
      }
    }

    return mergeRoleNeighbors(neighbors);
  };

  /**
   * Downstream subsidiaries — the slow (~11s) Roles API call. Endpoint
   * companies at depth 0 ONLY (covers the "shared subsidiary" pairing).
   */
  const expandCompanyDownstream = async (nzbn: string, name: string): Promise<Neighbor[]> => {
    const neighbors: Neighbor[] = [];
    await smartDelay();
    apiCalls++;
    const results = await fetchRolesByEntityName(name, config, '/api/proxy', onLog);
    for (const role of results.roles || []) {
      const isOrgShareholder =
        role.roleType &&
        role.roleType.includes('Shareholder') &&
        !role.roleType.includes('Individual') &&
        !role.roleType.includes('Director');
      if (!isOrgShareholder) continue;

      // Strict fuzzy-match rejection (apiService.ts:510-523)
      const isStrictMatch =
        (role.nzbn && role.nzbn === nzbn) ||
        normalizeCompanyName(role.name || '') === normalizeCompanyName(name);
      if (!isStrictMatch) continue;

      for (const holding of role.shareholdings || []) {
        const childNzbn = holding.associatedCompanyNzbn;
        if (!childNzbn || childNzbn === nzbn) continue;
        const shareLabel =
          holding.sharePercentage !== undefined && holding.sharePercentage > 0
            ? `▼ Shareholder (${holding.sharePercentage}%)`
            : '▼ Shareholder';
        const node = makeCompanyNode(childNzbn, holding.associatedCompanyName || 'Unknown Company');
        neighbors.push({ node, edge: makeEdge(nzbn, childNzbn, shareLabel, 'subsidiary') });
      }
    }
    return neighbors;
  };

  /** All company neighbors of a person: ONE call (strict name filter inside). */
  const expandPerson = async (name: string): Promise<Neighbor[]> => {
    const neighbors: Neighbor[] = [];
    await smartDelay();
    apiCalls++;
    const pid = personId(name);
    let results;
    try {
      results = await searchByPersonName(name, config.companiesKey, onLog);
    } catch (e) {
      console.warn(`[Compare] Person search failed for "${name}"`, e);
      return neighbors;
    }
    for (const r of results) {
      if (!r.nzbn) continue;
      const label =
        r.roleType === 'Director & Shareholder'
          ? `▼ Director & Shareholder${r.shareholding > 0 ? ` (${r.shareholding}%)` : ''}`
          : r.isDirector
            ? '▼ Director'
            : `▼ Shareholder${r.shareholding > 0 ? ` (${r.shareholding}%)` : ''}`;
      const roleKind: 'shareholder' | 'director' | 'both' =
        r.roleType === 'Director & Shareholder' ? 'both' : r.isDirector ? 'director' : 'shareholder';
      const node = makeCompanyNode(r.nzbn, r.companyName, r.status);
      neighbors.push({ node, edge: makeEdge(pid, r.nzbn, label, 'parent', !!r.isInactive, roleKind) });
    }
    return neighbors;
  };

  // ---- Bidirectional BFS --------------------------------------------------

  interface SideState {
    visited: Map<string, Visit>;
    frontier: string[]; // node ids at current depth
    depth: number;
    endpoint: CompareEndpoint;
  }

  const initSide = (endpoint: CompareEndpoint): SideState => {
    const node =
      endpoint.kind === 'company'
        ? makeCompanyNode(endpoint.nzbn, endpoint.name)
        : makePersonNode(endpoint.name);
    recordNode(node);
    return {
      visited: new Map([[node.id, { depth: 0, parents: [] }]]),
      frontier: [node.id],
      depth: 0,
      endpoint,
    };
  };

  const sideA = initSide(a);
  const sideB = initSide(b);
  const aId = sideA.frontier[0];
  const bId = sideB.frontier[0];

  const emitProgress = (currentName?: string) =>
    onProgress?.({
      hop: Math.min(sideA.depth + sideB.depth + 1, maxHops),
      entitiesExamined,
      apiCalls,
      currentName,
    });

  const buildResult = (found: boolean, meetIds: string[]): CompareResult => {
    let pathNodeIds: string[] = [];
    let pathEdgeIds: string[] = [];
    let hops = 0;

    if (found && meetIds.length > 0) {
      // Union of every node/edge on ANY shortest path: walk the parents
      // links backwards from all meeting nodes, on both sides.
      const pathNodes = new Set<string>();
      const pathEdges = new Set<string>();
      const walk = (side: SideState, startIds: string[]) => {
        const seen = new Set<string>(); // per-side: parents links are side-specific
        const queue = [...startIds];
        while (queue.length > 0) {
          const id = queue.pop()!;
          if (seen.has(id)) continue;
          seen.add(id);
          pathNodes.add(id);
          const visit = side.visited.get(id);
          if (!visit) continue;
          for (const p of visit.parents) {
            pathEdges.add(p.edgeId);
            queue.push(p.id);
          }
        }
      };
      walk(sideA, meetIds);
      walk(sideB, meetIds);
      pathNodeIds = Array.from(pathNodes);
      pathEdgeIds = Array.from(pathEdges);
      hops = Math.min(
        ...meetIds.map(
          (id) => (sideA.visited.get(id)?.depth ?? 0) + (sideB.visited.get(id)?.depth ?? 0)
        )
      );
    }

    if (!found) {
      return {
        found: false,
        hops: 0,
        nodes: [],
        edges: [],
        pathNodeIds: [],
        pathEdgeIds: [],
        stats: { apiCalls, entitiesExamined, truncated },
      };
    }

    // Assemble path nodes + already-discovered 1-hop context (no extra calls)
    const pathNodeSet = new Set(pathNodeIds);
    const contextIds: string[] = [];
    for (const edge of discoveredEdges.values()) {
      if (contextIds.length >= MAX_CONTEXT_NODES) break;
      const srcOnPath = pathNodeSet.has(edge.source);
      const tgtOnPath = pathNodeSet.has(edge.target);
      if (srcOnPath !== tgtOnPath) {
        const other = srcOnPath ? edge.target : edge.source;
        if (!pathNodeSet.has(other) && !contextIds.includes(other) && discoveredNodes.has(other)) {
          contextIds.push(other);
        }
      }
    }

    const includedIds = new Set([...pathNodeIds, ...contextIds]);
    const nodes: GraphNode[] = [];
    for (const id of includedIds) {
      const base = discoveredNodes.get(id);
      if (!base) continue;
      const isEndpoint = id === aId || id === bId;
      nodes.push({
        ...base,
        data: {
          ...base.data,
          isVisible: true,
          onComparePath: pathNodeSet.has(id) || undefined,
          isCompareEndpoint: isEndpoint || undefined,
          isTarget: isEndpoint, // endpoints get the existing stamp treatment
        },
      });
    }

    const edges: GraphEdge[] = [];
    for (const edge of discoveredEdges.values()) {
      if (includedIds.has(edge.source) && includedIds.has(edge.target)) {
        edges.push(edge);
      }
    }

    return {
      found: true,
      hops,
      nodes,
      edges,
      pathNodeIds,
      pathEdgeIds,
      stats: { apiCalls, entitiesExamined, truncated },
    };
  };

  // Trivial case: the two endpoints are the same entity
  if (aId === bId) {
    return buildResult(true, [aId]);
  }

  emitProgress();

  while (
    sideA.depth + sideB.depth < maxHops &&
    sideA.frontier.length > 0 &&
    sideB.frontier.length > 0
  ) {
    if (shouldCancel?.()) return buildResult(false, []);
    if (apiCalls >= MAX_API_CALLS || Date.now() - startTime > MAX_WALL_CLOCK_MS) {
      truncated = true;
      break;
    }

    // Expand the SMALLER frontier one level
    const side = sideA.frontier.length <= sideB.frontier.length ? sideA : sideB;
    const other = side === sideA ? sideB : sideA;

    let frontier = side.frontier;
    if (frontier.length > MAX_FRONTIER_PER_LEVEL) {
      truncated = true;
      frontier = frontier.slice(0, MAX_FRONTIER_PER_LEVEL);
    }

    emitProgress(discoveredNodes.get(frontier[0])?.data.label);

    // One level of expansion, in parallel (throttled via smartDelay)
    const expansions = await Promise.all(
      frontier.map(async (id) => {
        const node = discoveredNodes.get(id);
        if (!node) return { id, neighbors: [] as Neighbor[] };
        entitiesExamined++;
        let neighbors: Neighbor[];
        if (node.type === 'personNode') {
          neighbors = await expandPerson(node.data.label);
        } else {
          const isEndpointCompany = side.depth === 0;
          neighbors = await expandCompanyUpstream(id);
          if (isEndpointCompany) {
            // Depth 0 only: the slow downstream call (max 2 across the whole run)
            const name = node.data.entityName || node.data.label;
            try {
              neighbors = neighbors.concat(await expandCompanyDownstream(id, name));
            } catch (e) {
              console.warn(`[Compare] Downstream expansion failed for ${name}`, e);
            }
          }
        }
        return { id, neighbors };
      })
    );

    // Integrate the level, then intersect with the other side's visited set
    const nextDepth = side.depth + 1;
    const nextFrontier: string[] = [];
    const meets = new Set<string>();

    for (const { id: fromId, neighbors } of expansions) {
      for (const { node, edge } of neighbors) {
        recordNode(node);
        recordEdge(edge);
        const existing = side.visited.get(node.id);
        if (existing === undefined) {
          side.visited.set(node.id, { depth: nextDepth, parents: [{ id: fromId, edgeId: edge.id }] });
          nextFrontier.push(node.id);
          if (other.visited.has(node.id)) meets.add(node.id);
        } else if (existing.depth === nextDepth) {
          // Another shortest route to the same node — keep the extra parent
          if (!existing.parents.some((p) => p.edgeId === edge.id)) {
            existing.parents.push({ id: fromId, edgeId: edge.id });
          }
        }
      }
    }

    side.frontier = nextFrontier;
    side.depth = nextDepth;
    emitProgress();

    if (meets.size > 0) {
      // All meeting nodes at the minimal total depth (all shortest paths)
      const totals = Array.from(meets).map(
        (id) => (side.visited.get(id)!.depth) + (other.visited.get(id)!.depth)
      );
      const minTotal = Math.min(...totals);
      const meetIds = Array.from(meets).filter(
        (id) => side.visited.get(id)!.depth + other.visited.get(id)!.depth === minTotal
      );
      return buildResult(true, meetIds);
    }
  }

  return buildResult(false, []);
}
