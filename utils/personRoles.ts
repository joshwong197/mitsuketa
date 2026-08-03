import { GraphEdge, GraphNode, NodeType } from '../types';

/**
 * Rolls up each person node's `roleKind` from the edges touching it — the
 * union of every relationship that node has anywhere on the chart, per the
 * design agreement (design/HANDOVER.md §5): "the node shows the union of
 * roles across the whole chart; the edges carry the specifics." A person who
 * directs company A and holds shares in company B gets one node marked
 * 'both', not two single-role nodes.
 *
 * Pure — no API calls. Call after any crawl/merge that adds person nodes or
 * edges (services/apiService.ts buildGraph/expandNode, services/compareService.ts
 * findConnection) so CustomNodes' PersonNode can pick the seal glyph and ring style.
 */
export function computePersonRoleFlags(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const roleByNodeId = new Map<string, Set<'shareholder' | 'director'>>();

  const record = (nodeId: string, kind: 'shareholder' | 'director' | 'both' | undefined) => {
    if (!kind) return;
    let set = roleByNodeId.get(nodeId);
    if (!set) {
      set = new Set();
      roleByNodeId.set(nodeId, set);
    }
    if (kind === 'both') {
      set.add('shareholder');
      set.add('director');
    } else {
      set.add(kind);
    }
  };

  for (const edge of edges) {
    record(edge.source, edge.data?.roleKind);
    record(edge.target, edge.data?.roleKind);
  }

  return nodes.map((node) => {
    if (node.data.type !== NodeType.PERSON) return node;
    const roles = roleByNodeId.get(node.id);
    if (!roles || roles.size === 0) return node;
    const roleKind = roles.size === 2 ? 'both' : roles.has('director') ? 'director' : 'shareholder';
    if (node.data.roleKind === roleKind) return node;
    return { ...node, data: { ...node.data, roleKind } };
  });
}
