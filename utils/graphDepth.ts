import { GraphNode, GraphEdge } from '../types';

/**
 * Assigns data.depth (hops from the target node) to every node via a BFS
 * over the edges treated as UNDIRECTED. The root is the node with
 * data.isTarget; if none is marked, the first node in the array is used.
 * Nodes unreachable from the root (disconnected components) get depth 2,
 * matching the ink-wash (2+ hops) tier used by the node styling.
 *
 * Pure function — does not mutate the input arrays/objects.
 */
export const assignDepths = (
    nodes: GraphNode[],
    edges: GraphEdge[]
): GraphNode[] => {
    if (nodes.length === 0) return nodes;

    const rootId = nodes.find(n => n.data.isTarget)?.id ?? nodes[0].id;

    // Build an undirected adjacency list
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) {
        adjacency.set(node.id, []);
    }
    for (const edge of edges) {
        if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
        adjacency.get(edge.source)!.push(edge.target);
        adjacency.get(edge.target)!.push(edge.source);
    }

    const depths = new Map<string, number>();
    depths.set(rootId, 0);
    const queue: string[] = [rootId];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const currentDepth = depths.get(current)!;
        for (const neighbor of adjacency.get(current) ?? []) {
            if (!depths.has(neighbor)) {
                depths.set(neighbor, currentDepth + 1);
                queue.push(neighbor);
            }
        }
    }

    return nodes.map(node => ({
        ...node,
        data: {
            ...node.data,
            depth: depths.get(node.id) ?? 2,
        },
    }));
};

// self-check (read-through verification, no test framework in this repo):
//
// nodes: A(target) - B - C     D (disconnected)
// edges: A-B, B-C
//
// assignDepths([A,B,C,D], [{source:'A',target:'B'}, {source:'B',target:'C'}])
//   BFS from A (isTarget):
//     depths: A=0
//     visit A's neighbors: B -> depth 1, queue=[B]
//     visit B's neighbors: A (seen), C -> depth 1+1=2, queue=[C]
//     visit C's neighbors: B (seen)
//   D never reached -> depths.get(D) is undefined -> falls back to 2
//   => A.depth=0, B.depth=1, C.depth=2, D.depth=2
//
// If no node has isTarget, rootId falls back to nodes[0].id, and depths
// are computed the same way relative to that root.
