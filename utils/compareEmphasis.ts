import type { CSSProperties } from 'react';

/**
 * Compare-mode emphasis post-pass. Applied AFTER assignDepths →
 * getLayoutedElements → styleEdgesByDepth:
 * - path nodes/edges untouched (full ink);
 * - context nodes: opacity .15 + pointerEvents none (same mechanism as
 *   App.tsx handleHideParents — node.style only, zero CustomNodes edits);
 * - context edges: MULTIPLY the opacity styleEdgesByDepth set (compose,
 *   don't replace — styleEdgesByDepth stays the single edge-styling authority).
 * handleShowAll un-dims nodes for free. No new colors: emphasis is presence
 * of ink, de-emphasis is absence.
 */

const CONTEXT_OPACITY = 0.15;

export function applyCompareEmphasis<
  N extends { id: string; style?: CSSProperties },
  E extends { id: string; style?: CSSProperties },
>(
  nodes: N[],
  edges: E[],
  pathNodeIds: string[],
  pathEdgeIds: string[]
): { nodes: N[]; edges: E[] } {
  const pathNodes = new Set(pathNodeIds);
  const pathEdges = new Set(pathEdgeIds);

  return {
    nodes: nodes.map((n) =>
      pathNodes.has(n.id)
        ? n
        : {
            ...n,
            style: { ...n.style, opacity: CONTEXT_OPACITY, pointerEvents: 'none' as const },
          }
    ),
    edges: edges.map((e) => {
      if (pathEdges.has(e.id)) return e;
      const base = typeof e.style?.opacity === 'number' ? e.style.opacity : 1;
      return {
        ...e,
        style: { ...e.style, opacity: base * CONTEXT_OPACITY },
      };
    }),
  };
}
