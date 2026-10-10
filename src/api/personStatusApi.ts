import { ApiConfig, GraphNode, LoggerCallback, NodeType } from '../../types.js';
import { searchDisqualifiedDirectors } from './disqualifiedDirectorsApi.js';
import { searchInsolvency, isInsolvencyRecordCurrent } from './insolvencyApi.js';
import { mapPool } from '../../utils/pool.js';

/**
 * Batch-enrich person nodes on an org chart with disqualified-director and
 * insolvency register checks. Runs automatically — the graph already dedupes
 * people to one node per identity (personId(), see services/apiService.ts
 * crawlUpstream), so a person who's director/shareholder across many
 * companies on the same chart is still checked exactly once, not once per
 * appearance (design/HANDOVER.md §4.1).
 *
 * Mirrors enrichGraphNodes' shape (companyStatusApi.ts) but for person nodes,
 * which enrichGraphNodes explicitly skips.
 */
export async function enrichPersonNodes(
    nodes: GraphNode[],
    config: ApiConfig,
    logger?: LoggerCallback,
    concurrency: number = 16,
    baseUrl: string = '/api/proxy',
    onProgress?: (updates: GraphNode[]) => void
): Promise<GraphNode[]> {
    const personNodes = nodes.filter(n => n.data.type === NodeType.PERSON && n.data.label?.trim())
        .sort((a, b) => Number(!!b.data.isVisible) - Number(!!a.data.isVisible));
    let pendingUpdates: GraphNode[] = [], lastFlush = Date.now();
    const flush = () => {
        if (pendingUpdates.length) onProgress?.(pendingUpdates);
        pendingUpdates = []; lastFlush = Date.now();
    };

    const resultByNodeId = new Map<string, Partial<GraphNode['data']>>();
    // A name can appear as several graph identities (different addresses).
    // Reuse only the identical register query, not the identity/evidence decision.
    const checks = new Map<string, Promise<Partial<GraphNode['data']>>>();

    // Continuous pool: each person is 2 register calls; a slow one no longer
    // stalls a whole batch. The global dispatch gate still bounds the rate.
    await mapPool(personNodes, concurrency, async (node) => {
        const name = node.data.label.trim();
        const key = name.toUpperCase().replace(/\s+/g, ' ');
        let check = checks.get(key);
        if (!check) {
        check = (async () => {
        const [disqualified, insolvency] = await Promise.allSettled([
            searchDisqualifiedDirectors(name, config, logger, 10, 0, baseUrl),
            searchInsolvency(name, config, logger, 1000, 1, baseUrl),
        ]);

        const patch: Partial<GraphNode['data']> = {
            disqualifiedCheck: disqualified.status === 'fulfilled' ? 'complete' : 'unavailable',
            insolvencyCheck: 'unavailable',
        };
        if (disqualified.status === 'fulfilled') patch.isDisqualified = disqualified.value.roles.length > 0;
        if (insolvency.status === 'fulfilled') {
            const records = insolvency.value.searchResults;
            const complete = !records.some(r => r.detailUnavailable);
            patch.insolvencyCheck = complete ? 'complete' : 'unavailable';
            patch.hasInsolvencyRecord = records.length > 0;
            // An incomplete refresh must not erase existing positive evidence.
            if (complete || records.some(isInsolvencyRecordCurrent)) patch.insolvencyCurrent = records.some(isInsolvencyRecordCurrent);
        }
        return patch;
        })();
        checks.set(key, check);
        }
        const result = await check;
        resultByNodeId.set(node.id, result);
        pendingUpdates.push({ ...node, data: { ...node.data, ...result } });
        if (pendingUpdates.length >= 20 || Date.now() - lastFlush >= 1000) flush();
        if (resultByNodeId.size % 200 === 0) console.log(`Person check progress: ${resultByNodeId.size}/${personNodes.length}`);
    });
    flush();

    const unavailable = [...resultByNodeId.values()].filter(r => r.disqualifiedCheck === 'unavailable' || r.insolvencyCheck === 'unavailable').length;
    console.log(`Person checks settled: ${resultByNodeId.size}; ${unavailable} with unavailable checks`);

    return nodes.map(node => {
        const result = resultByNodeId.get(node.id);
        if (!result) return node;
        return {
            ...node,
            data: {
                ...node.data,
                ...result,
            }
        };
    });
}
