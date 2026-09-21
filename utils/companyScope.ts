import type { GraphEdge, GraphNode } from '../types';
import { computePersonRoleFlags } from './personRoles';

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
