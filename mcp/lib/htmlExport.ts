// Self-contained HTML graph export.
// Inlines the prebuilt Cytoscape bundle plus a minimal HTML template so the
// resulting .html file opens offline with full pan/zoom/click/collapse.

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { GraphNode, GraphEdge } from '../../types.js';

export interface GenerateGraphHtmlOptions {
    title: string;
    theme?: 'light' | 'dark';
    subtitle?: string;
}

// Vercel bundles each serverless function, so `import.meta.url` at runtime
// points to the bundled location — not this source file. Resolving relative
// to it would miss the templates. We try a series of candidate roots and
// take the first one that contains the bundle file.
function findTemplatesDir(): string {
    const here = (() => {
        try {
            return dirname(fileURLToPath(import.meta.url));
        } catch {
            return process.cwd();
        }
    })();

    const candidates = [
        resolve(here, '..', 'templates'),                // dev: mcp/lib/ -> mcp/templates/
        resolve(process.cwd(), 'mcp', 'templates'),      // Vercel: cwd is project root
        resolve(here, '..', '..', 'mcp', 'templates'),   // bundled near api/mcp
        resolve(here, '..', '..', '..', 'mcp', 'templates'),
        '/var/task/mcp/templates',                       // Vercel Lambda fixed root
    ];

    for (const dir of candidates) {
        if (existsSync(resolve(dir, 'graph-bundle.js'))) return dir;
    }
    throw new Error(
        `Cannot locate mcp/templates/graph-bundle.js. Searched: ${candidates.join(', ')}. ` +
        `Confirm vercel.json includeFiles is shipping mcp/templates/ with the function.`,
    );
}

// Lazy initialisation — if templates aren't shipped, the other 7 tools still
// work; only build_ownership_graph with format='html'|'both' will fail.
let cachedBundle: string | null = null;
let cachedTemplate: string | null = null;

function getBundle(): string {
    if (cachedBundle === null) {
        const dir = findTemplatesDir();
        cachedBundle = readFileSync(resolve(dir, 'graph-bundle.js'), 'utf-8');
        cachedTemplate = readFileSync(resolve(dir, 'graph-template.html'), 'utf-8');
    }
    return cachedBundle!;
}

function getTemplate(): string {
    if (cachedTemplate === null) getBundle();
    return cachedTemplate!;
}

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

    return getTemplate()
        .replaceAll('{{TITLE}}', escapeHtml(opts.title))
        .replaceAll('{{SUBTITLE}}', escapeHtml(subtitle))
        .replace('{{THEME}}', opts.theme ?? 'light')
        .replace('{{BUNDLE}}', () => getBundle())
        .replace('{{DATA}}', () => data);
}
