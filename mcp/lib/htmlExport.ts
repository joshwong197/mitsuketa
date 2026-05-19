// Self-contained HTML graph export.
// Real implementation lands in a follow-up commit; this is a placeholder so
// buildOwnershipGraph can compile and we can verify the tool wiring first.

import type { GraphNode, GraphEdge } from '../../types';

export interface GenerateGraphHtmlOptions {
    title: string;
    theme?: 'light' | 'dark';
}

export function generateGraphHtml(
    nodes: GraphNode[],
    edges: GraphEdge[],
    opts: GenerateGraphHtmlOptions,
): string {
    // TODO(phase-d): replace with the Cytoscape-based renderer.
    const escapedTitle = opts.title.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
    const safeData = JSON.stringify({ nodes, edges }, null, 2)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e');
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapedTitle}</title>
<style>body{font:14px system-ui;padding:20px}pre{background:#f6f6f6;padding:12px;overflow:auto}</style>
</head><body>
<h1>${escapedTitle}</h1>
<p>Placeholder HTML export. Interactive graph rendering will be added in Phase D.</p>
<p>${nodes.length} nodes, ${edges.length} edges.</p>
<pre>${safeData}</pre>
</body></html>`;
}
