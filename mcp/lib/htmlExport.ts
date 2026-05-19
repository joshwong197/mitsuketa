// Self-contained HTML graph export.
// Inlines the prebuilt Cytoscape bundle plus a minimal HTML template so the
// resulting .html file opens offline with full pan/zoom/click/collapse.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { GraphNode, GraphEdge } from '../../types';

export interface GenerateGraphHtmlOptions {
    title: string;
    theme?: 'light' | 'dark';
    subtitle?: string;
}

// __dirname-equivalent in ESM. The build artifacts live next to this file's
// source (`mcp/lib/` -> `mcp/templates/`).
const here = dirname(fileURLToPath(import.meta.url));

// Read once, at module load, so cold-start cost is paid once per function instance.
const BUNDLE_JS = readFileSync(resolve(here, '..', 'templates', 'graph-bundle.js'), 'utf-8');
const TEMPLATE = readFileSync(resolve(here, '..', 'templates', 'graph-template.html'), 'utf-8');

function escapeHtml(s: string): string {
    return s.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Strip fields that aren't needed at render time to keep the file small.
function toExportNode(n: GraphNode): Record<string, unknown> {
    const d = n.data || ({} as any);
    return {
        id: n.id,
        label: d.label,
        entityName: d.entityName,
        nzbn: d.nzbn,
        sourceRegisterUniqueId: d.sourceRegisterUniqueId,
        status: d.status,
        entityTypeCode: d.entityTypeCode,
        entityTypeDescription: d.entityTypeDescription,
        type: d.type,
        isInExternalAdmin: d.isInExternalAdmin,
        externalAdminType: d.externalAdminType,
        removalCommenced: d.removalCommenced,
        hasHistoricInsolvency: d.hasHistoricInsolvency,
        historicInsolvencyType: d.historicInsolvencyType,
        appointmentDate: d.appointmentDate,
        vacationDate: d.vacationDate,
        isTarget: d.isTarget,
    };
}

function toExportEdge(e: GraphEdge): Record<string, unknown> {
    return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        percentage: e.data?.percentage,
        relationshipType: e.data?.relationshipType,
    };
}

export function generateGraphHtml(
    nodes: GraphNode[],
    edges: GraphEdge[],
    opts: GenerateGraphHtmlOptions,
): string {
    const payload = {
        nodes: nodes.map(toExportNode),
        edges: edges.map(toExportEdge),
    };

    // Escape `</script>` to prevent breaking out of the inline script tag.
    const data = JSON.stringify(payload).replace(/<\/script/gi, '<\\/script');

    const subtitle = opts.subtitle ?? `${nodes.length} entities · ${edges.length} relationships`;

    return TEMPLATE
        .replaceAll('{{TITLE}}', escapeHtml(opts.title))
        .replaceAll('{{SUBTITLE}}', escapeHtml(subtitle))
        .replace('{{THEME}}', opts.theme ?? 'light')
        .replace('{{BUNDLE}}', () => BUNDLE_JS)
        .replace('{{DATA}}', () => data);
}
