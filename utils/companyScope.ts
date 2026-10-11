import type { GraphEdge, GraphNode } from '../types';
import { computePersonRoleFlags } from './personRoles';
import { removedCompany } from './relationshipStatus';

/** Simple reports current register allocations, even if a listed holder is removed. */
export function companyNodeAllowed(node: GraphNode, scope: string | undefined, includeRemoved: boolean) {
    return node.type !== 'companyNode' || !!node.data.isTarget || scope === 'simple' || includeRemoved || !removedCompany(node.data);
}

/** Match a fresh Simple search: current role/shareholder edges into the target only. */
export function immediateCompanyGraph(nodes: GraphNode[], edges: GraphEdge[], targetId: string) {
    const incoming = edges.filter(edge => edge.target === targetId && !edge.data?.isCeased && !edge.data?.currentUnverified && edge.data?.relationshipType !== 'sibling');
    const ids = new Set([targetId, ...incoming.map(edge => edge.source)]);
    const immediateNodes = nodes.filter(node => ids.has(node.id)).map(node => ({
        ...node,
        data: { ...node.data, roleKind: node.data.type === 'person' ? undefined : node.data.roleKind,
            isVisible: true, hiddenDescendantCount: undefined, isBranchExpanded: false,
            ...(node.id === targetId ? { companySearchScope: 'simple' as const } : {}) },
    }));
    return { nodes: computePersonRoleFlags(immediateNodes, incoming), edges: incoming };
}

/** Project data without replacing controlled React Flow positions or measurements. */
export function immediateCompanyView(liveNodes: GraphNode[], memoryNodes: GraphNode[], edges: GraphEdge[], targetId: string) {
    const immediate = immediateCompanyGraph(memoryNodes, edges, targetId);
    const liveById = new Map(liveNodes.map(node => [node.id, node]));
    return {
        nodes: immediate.nodes.map(node => {
            const live = liveById.get(node.id);
            return { ...node, ...live, data: { ...node.data, ...live?.data,
                roleKind: node.data.roleKind, isVisible: true, hiddenDescendantCount: undefined, isBranchExpanded: false,
                ...(node.id === targetId ? { companySearchScope: 'simple' as const } : {}) } };
        }),
        edges: immediate.edges,
    };
}
