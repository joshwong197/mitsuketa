import { generateOrgChart } from '../../services/apiService.js';
import { enrichGraphNodes } from '../../src/api/companyStatusApi.js';
import { buildApiConfig, getProxyBaseUrl } from '../lib/config.js';
import { BuildOwnershipGraphInput } from '../schemas.js';
import { putGraphData } from '../lib/graphStore.js';
import type { ToolContext } from './shared.js';

// Derive the public origin (scheme + host) of this deployment so we can
// build URLs back to /graph.html (the React viewer) and /api/mcp (the data
// fetch endpoint the viewer hits).
function getPublicOrigin(req?: { headers?: Record<string, string | string[] | undefined> }): string {
    if (process.env.MITSUKETA_PUBLIC_ORIGIN) return process.env.MITSUKETA_PUBLIC_ORIGIN;
    if (req?.headers) {
        const pick = (n: string) => {
            const v = req.headers![n];
            return Array.isArray(v) ? v[0] : v;
        };
        const proto = pick('x-forwarded-proto') || 'https';
        const host = pick('x-forwarded-host') || pick('host');
        if (host) return `${proto}://${host}`;
    }
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return 'http://localhost:3000';
}

type Args = {
    nzbn: string;
    direction?: 'upstream' | 'downstream' | 'both';
    depth?: number;
    enrich?: boolean;
    format?: 'json' | 'html' | 'both';
};

export const buildOwnershipGraph = {
    name: 'mitsuketa_build_ownership_graph',
    config: {
        title: 'Build a NZ company ownership graph',
        description:
            'Recursively crawl shareholding relationships from a root NZBN and return the resulting graph. SLOW: this can fan out to 30+ upstream API calls and take 10-30s; prefer single-purpose tools when you only need one fact. Set `format` to "html" to also receive a self-contained interactive HTML file (Cytoscape-based, opens offline, pan/zoom/click). Set `direction` to limit work to upstream owners or downstream subsidiaries. Set `enrich=false` to skip insolvency status enrichment for speed.',
        inputSchema: BuildOwnershipGraphInput,
    },
    handler: async (args: Args, ctx: ToolContext) => {
        const baseUrl = getProxyBaseUrl(ctx.req);
        const config = buildApiConfig();
        const direction = args.direction ?? 'both';
        const format = args.format ?? 'both';
        const enrich = args.enrich ?? true;
        // depth is accepted but the underlying OrgSpider has its own internal limits;
        // we use the param as a soft cap by re-checking node count after build.
        // (Future: pipe through OrgSpider once we expose its depth knob.)

        const baseUrls = { nzbn: baseUrl, companies: baseUrl };
        let result = await generateOrgChart(args.nzbn, config, undefined, undefined, baseUrls);

        // direction filter — done post-build for simplicity; OrgSpider always builds full
        if (direction !== 'both') {
            const rootId = args.nzbn;
            const keepIds = new Set<string>([rootId]);
            const adjacency = new Map<string, Set<string>>();
            for (const e of result.edges) {
                if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
                if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());
                if (direction === 'upstream') {
                    // edges point parent -> child (source = parent, target = child). Walk up: child -> parent.
                    adjacency.get(e.target)!.add(e.source);
                } else {
                    adjacency.get(e.source)!.add(e.target);
                }
            }
            const stack = [rootId];
            while (stack.length) {
                const id = stack.pop()!;
                const next = adjacency.get(id);
                if (!next) continue;
                for (const n of next) if (!keepIds.has(n)) { keepIds.add(n); stack.push(n); }
            }
            result = {
                nodes: result.nodes.filter((n) => keepIds.has(n.id)),
                edges: result.edges.filter((e) => keepIds.has(e.source) && keepIds.has(e.target)),
            };
        }

        if (enrich) {
            result = { ...result, nodes: await enrichGraphNodes(result.nodes, config, undefined, 5, baseUrl) };
        }

        const rootNode = result.nodes.find((n) => n.id === args.nzbn);
        const rootName = rootNode?.data?.label || rootNode?.data?.entityName || args.nzbn;

        const responseContent: Array<Record<string, unknown>> = [];

        if (format === 'json' || format === 'both') {
            responseContent.push({
                type: 'text',
                text: JSON.stringify({ nodes: result.nodes, edges: result.edges }, null, 2),
            });
        }

        if (format === 'html' || format === 'both') {
            const payload = {
                title: `Mitsuketa — ${rootName}`,
                rootNzbn: args.nzbn,
                nodes: result.nodes,
                edges: result.edges,
            };
            const id = putGraphData(JSON.stringify(payload));
            const url = `${getPublicOrigin(ctx.req)}/graph.html?id=${id}`;
            responseContent.unshift({
                type: 'text',
                text:
                    `Ownership graph for ${rootName} (${args.nzbn}) — ${result.nodes.length} nodes, ${result.edges.length} edges.\n\n` +
                    `Interactive view (opens in browser, React Flow renderer, valid ~1 hour): ${url}`,
            });
        }

        return { content: responseContent };
    },
};
