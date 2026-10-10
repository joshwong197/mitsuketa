import dagre from '@dagrejs/dagre';
import { layoutDepths } from '../utils/layoutDepth';
import { Node, Edge, Position } from 'reactflow';
import { NODE_WIDTH, NODE_HEIGHT, LAYOUT_DIRECTION } from '../constants';

// PHASE 3 FEATURE FLAG - Set to false to revert to Phase 2 layout
const ENABLE_MULTI_ROW_LAYOUT = false; // DISABLED: Made layout worse (misaligned, 3x slower)
const MAX_SIBLINGS_PER_ROW = 4; // Maximum siblings before wrapping to new row (lowered to trigger more easily)
const MULTI_ROW_VERTICAL_GAP = 100; // Vertical gap between rows of siblings

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

// Helper function to calculate dynamic node width
const getNodeWidth = (label: string): number => {
  const labelLength = label?.length || 0;
  const minWidth = 180;
  const maxWidth = 400;
  return Math.min(maxWidth, Math.max(minWidth, labelLength * 8 + 60));
};

export const getLayoutedElements = (nodes: Node[], allEdges: Edge[]) => {
  const visibleIds = new Set(nodes.map(n => n.id));
  const edges = allEdges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
  // Dagre must contain only this case; previous layouts must not influence it.
  dagreGraph.nodes().forEach(id => dagreGraph.removeNode(id));
  dagreGraph.setGraph({
    rankdir: LAYOUT_DIRECTION, // TB (top-to-bottom)
    nodesep: 10, // Phase 2 stable setting
    ranksep: 180, // Phase 2 stable setting
    ranker: 'network-simplex',
    marginx: 50,
    marginy: 50
  });

  nodes.forEach((node) => {
    // Calculate node width based on label
    const nodeWidth = node.data?.label ? getNodeWidth(node.data.label) : NODE_WIDTH;
    dagreGraph.setNode(node.id, { width: nodeWidth, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const nodeWidth = node.data?.label ? getNodeWidth(node.data.label) : NODE_WIDTH;

    node.targetPosition = Position.Top;
    node.sourcePosition = Position.Bottom;

    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - NODE_HEIGHT / 2,
    };

    return node;
  });



  // MANUAL POST-PROCESSING: Center parents above their children using BOTTOM-UP approach
  // This fixes dagre's tendency to position parents offset to the right
  // Process nodes from leaves to root to ensure cascading centering works correctly
  if (layoutedNodes.length > 0 && edges.length > 0) {
    // Create a map of node ID to node for quick lookup
    const nodeMap = new Map(layoutedNodes.map(n => [n.id, n]));
    const incomingCount = new Map<string, number>();
    edges.forEach(edge => incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1));

    // Calculate depth for each node (distance from leaves)
    // Leaves have depth 0, their parents have depth 1, etc.
    const depthMap = layoutDepths(layoutedNodes, edges);

    // Group nodes by depth
    const nodesByDepth = new Map<number, string[]>();
    depthMap.forEach((depth, nodeId) => {
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth)!.push(nodeId);
    });

    // Get max depth
    const maxDepth = Math.max(...depthMap.values());

    // PHASE 3: MULTI-ROW LAYOUT COMPRESSION
    if (ENABLE_MULTI_ROW_LAYOUT) {
      console.log('🎯 PHASE 3: Multi-row layout compression enabled');

      // Process nodes from depth 0 (leaves) to maxDepth (root)
      for (let depth = 0; depth <= maxDepth; depth++) {
        const nodesAtDepth = nodesByDepth.get(depth) || [];

        nodesAtDepth.forEach(nodeId => {
          const childrenIds = edges.filter(e => e.source === nodeId).map(e => e.target);
          if (childrenIds.length === 0) return; // Skip leaf nodes
          // Multiple owners/directors can point to the same company. Dagre has
          // already spaced those peers; centring every parent over their shared
          // child would collapse them onto one another.
          if (childrenIds.some(id => (incomingCount.get(id) || 0) > 1)) return;

          const parent = nodeMap.get(nodeId);
          if (!parent) return;

          const children = childrenIds.map(id => nodeMap.get(id)).filter(Boolean) as Node[];
          if (children.length === 0) return;

          // MULTI-ROW LOGIC: If too many children, arrange them in multiple rows
          if (children.length > MAX_SIBLINGS_PER_ROW) {
            console.log(`📦 Reflowing ${children.length} children of ${parent.data?.label || nodeId} into multiple rows`);

            // Sort children by current X position (left to right)
            children.sort((a, b) => a.position.x - b.position.x);

            // Calculate rows
            const numRows = Math.ceil(children.length / MAX_SIBLINGS_PER_ROW);
            const childrenPerRow = Math.ceil(children.length / numRows);

            // Get leftmost child position as reference
            const leftmostX = Math.min(...children.map(c => c.position.x));

            // Reposition children into rows
            for (let row = 0; row < numRows; row++) {
              const rowStart = row * childrenPerRow;
              const rowEnd = Math.min(rowStart + childrenPerRow, children.length);
              const rowChildren = children.slice(rowStart, rowEnd);

              // Calculate row width and center it
              const rowWidth = rowChildren.reduce((sum, child, idx) => {
                const childWidth = child.data?.label ? getNodeWidth(child.data.label) : NODE_WIDTH;
                return sum + childWidth + (idx > 0 ? 10 : 0); // 10px gap
              }, 0);

              // Calculate starting X to center this row
              const totalPossibleWidth = childrenPerRow * (NODE_WIDTH + 10);
              const rowStartX = leftmostX + (totalPossibleWidth - rowWidth) / 2;

              // Position children in this row
              let currentX = rowStartX;
              rowChildren.forEach(child => {
                const childWidth = child.data?.label ? getNodeWidth(child.data.label) : NODE_WIDTH;
                child.position.x = currentX;
                child.position.y = child.position.y + (row * MULTI_ROW_VERTICAL_GAP);
                currentX += childWidth + 10;
              });
            }
          }

          // Recalculate parent centering after potential multi-row adjustment
          const childrenCenterX = children.reduce((sum, child) => {
            const childWidth = child.data?.label ? getNodeWidth(child.data.label) : NODE_WIDTH;
            return sum + (child.position.x + childWidth / 2);
          }, 0) / children.length;

          const parentWidth = parent.data?.label ? getNodeWidth(parent.data.label) : NODE_WIDTH;
          parent.position.x = childrenCenterX - parentWidth / 2;
        });
      }
    } else {
      // FALLBACK: Original Phase 2 bottom-up centering (no multi-row)
      console.log('⬅️ FALLBACK: Using Phase 2 single-row layout');

      for (let depth = 0; depth <= maxDepth; depth++) {
        const nodesAtDepth = nodesByDepth.get(depth) || [];

        nodesAtDepth.forEach(nodeId => {
          const childrenIds = edges.filter(e => e.source === nodeId).map(e => e.target);
          if (childrenIds.length === 0) return;
          if (childrenIds.some(id => (incomingCount.get(id) || 0) > 1)) return;

          const parent = nodeMap.get(nodeId);
          if (!parent) return;

          const children = childrenIds.map(id => nodeMap.get(id)).filter(Boolean) as Node[];
          if (children.length === 0) return;

          const childrenCenterX = children.reduce((sum, child) => {
            const childWidth = child.data?.label ? getNodeWidth(child.data.label) : NODE_WIDTH;
            return sum + (child.position.x + childWidth / 2);
          }, 0) / children.length;

          const parentWidth = parent.data?.label ? getNodeWidth(parent.data.label) : NODE_WIDTH;
          parent.position.x = childrenCenterX - parentWidth / 2;
        });
      }
    }


  }

  // Center the entire graph based on the TOPMOST node
  if (layoutedNodes.length > 0) {
    // Find the topmost node (smallest Y = highest in hierarchy)
    const topmostNode = layoutedNodes.reduce((top, node) =>
      node.position.y < top.position.y ? node : top
    );

    // Calculate center X of topmost node
    const topmostWidth = topmostNode.data?.label ? getNodeWidth(topmostNode.data.label) : NODE_WIDTH;
    const topmostCenterX = topmostNode.position.x + topmostWidth / 2;

    // Calculate viewport center (accounting for sidebar)
    const viewportCenter = (window.innerWidth - 200) / 2;

    // Offset to center the topmost node in viewport
    const offsetX = viewportCenter - topmostCenterX;

    // Apply offset to all nodes
    layoutedNodes.forEach(node => {
      node.position.x += offsetX;
    });
  }

  return { nodes: layoutedNodes, edges: allEdges };
};
