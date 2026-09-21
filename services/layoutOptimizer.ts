import { layoutDepths } from '../utils/layoutDepth';
import { Node, Edge } from 'reactflow';

// Helper function to get node width
const getNodeWidth = (node: Node): number => {
    const label = node.data?.label || '';
    const labelLength = label.length;
    const minWidth = 180;
    const maxWidth = 400;
    return Math.min(maxWidth, Math.max(minWidth, labelLength * 8 + 60));
};

const NODE_HEIGHT = 80;
const SIBLING_GAP = 25; // Gap between siblings in same parent group
const INTER_GROUP_GAP = 80; // Gap between different parent groups
const VIEWPORT_CENTER = 600; // Fixed center point for pyramid

// Calculate depth for each node
// Group nodes by their parent
function groupNodesByParent(
    nodes: Node[],
    edges: Edge[],
    level: number,
    depthMap: Map<string, number>,
    nodeMap: Map<string, Node>
): Map<string, Node[]> {
    const groupedByParent = new Map<string, Node[]>();

    // Get all nodes at this level
    const nodesAtLevel = nodes.filter(n => depthMap.get(n.id) === level);

    // Group by parent
    nodesAtLevel.forEach(node => {
        const parentEdge = edges.find(e => e.target === node.id);
        const parentId = parentEdge?.source || 'orphan';

        if (!groupedByParent.has(parentId)) {
            groupedByParent.set(parentId, []);
        }
        groupedByParent.get(parentId)!.push(node);
    });

    return groupedByParent;
}

// Main optimization function
export function tidyUpLayout(nodes: Node[], allEdges: Edge[]): { nodes: Node[], edges: Edge[] } {
    const visibleIds = new Set(nodes.map(n => n.id));
    const edges = allEdges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));

    // Clone nodes to avoid mutation
    const optimizedNodes = nodes.map(n => ({ ...n, position: { ...n.position } }));
    const nodeMap = new Map(optimizedNodes.map(n => [n.id, n]));
    const incomingCount = new Map<string, number>();
    edges.forEach(edge => incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1));

    // Calculate depths
    const depthMap = layoutDepths(optimizedNodes, edges);
    const maxDepth = Math.max(...Array.from(depthMap.values()));


    // Step 1: IMPROVED PYRAMID - Process bottom-up with parent-aware sorting
    for (let level = 0; level <= maxDepth; level++) {

        // Group nodes by parent at this level
        const groupsByParent = groupNodesByParent(optimizedNodes, edges, level, depthMap, nodeMap);

        if (groupsByParent.size === 0) continue;


        // Calculate dimensions for each parent group
        const siblingGroups: Array<{
            parentId: string;
            parent: Node | null;
            nodes: Node[];
            totalWidth: number;
            parentX: number; // Parent's X position for sorting
        }> = [];

        groupsByParent.forEach((siblings, parentId) => {
            // Sort siblings by their original X position to maintain left-to-right order
            siblings.sort((a, b) => a.position.x - b.position.x);

            // Calculate total width needed for this sibling group
            const totalWidth = siblings.reduce((sum, n, idx) => {
                return sum + getNodeWidth(n) + (idx > 0 ? SIBLING_GAP : 0);
            }, 0);

            // Get parent node (if exists)
            const parent = nodeMap.get(parentId) || null;
            const parentX = parent ? parent.position.x : siblings[0].position.x;

            siblingGroups.push({
                parentId,
                parent,
                nodes: siblings,
                totalWidth,
                parentX
            });
        });

        // IMPROVED: Sort groups by their parent's X position
        // This maintains the visual left-to-right flow from the parent level
        siblingGroups.sort((a, b) => a.parentX - b.parentX);


        // Calculate total width needed for all groups at this level
        const totalLevelWidth = siblingGroups.reduce((sum, g, idx) => {
            return sum + g.totalWidth + (idx > 0 ? INTER_GROUP_GAP : 0);
        }, 0);


        // Position groups centered around viewport center
        let groupStartX = VIEWPORT_CENTER - totalLevelWidth / 2;

        siblingGroups.forEach((group, groupIdx) => {
            let nodeX = groupStartX;

            const parentLabel = group.parent?.data?.label || 'orphan';

            // Position each node in this group
            group.nodes.forEach(node => {
                node.position.x = nodeX;
                nodeX += getNodeWidth(node) + SIBLING_GAP;
            });

            groupStartX += group.totalWidth + INTER_GROUP_GAP;
        });
    }

    // Step 2: Center parents above their children (bottom-up)

    for (let level = 1; level <= maxDepth; level++) {
        const parentsAtLevel = optimizedNodes.filter(n => depthMap.get(n.id) === level);

        parentsAtLevel.forEach(parent => {
            const childrenIds = edges.filter(e => e.source === parent.id).map(e => e.target);
            // Owners and directors often share the same child company. Keep the
            // peer spacing from step 1 instead of stacking every parent over it.
            if (childrenIds.some(id => (incomingCount.get(id) || 0) > 1)) return;
            const children = childrenIds.map(id => nodeMap.get(id)).filter(Boolean) as Node[];

            if (children.length === 0) return;

            // Calculate center of children
            const childrenCenterX = children.reduce((sum, child) => {
                const childWidth = getNodeWidth(child);
                return sum + (child.position.x + childWidth / 2);
            }, 0) / children.length;

            // Center parent
            const parentWidth = getNodeWidth(parent);
            parent.position.x = childrenCenterX - parentWidth / 2;

        });
    }

    // Step 3: Align nodes at same level vertically

    for (let level = 0; level <= maxDepth; level++) {
        const nodesAtLevel = optimizedNodes.filter(n => depthMap.get(n.id) === level);
        if (nodesAtLevel.length <= 1) continue;

        const avgY = nodesAtLevel.reduce((sum, n) => sum + n.position.y, 0) / nodesAtLevel.length;
        nodesAtLevel.forEach(n => n.position.y = avgY);
    }


    return { nodes: optimizedNodes, edges: allEdges };
}
