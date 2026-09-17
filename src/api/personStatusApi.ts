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
    concurrency: number = 25,
    baseUrl: string = '/api/proxy'
): Promise<GraphNode[]> {
    const personNodes = nodes.filter(n => n.data.type === NodeType.PERSON && n.data.label?.trim());

    const resultByNodeId = new Map<string, { isDisqualified: boolean; hasInsolvencyRecord: boolean; insolvencyCurrent: boolean }>();

    // Continuous pool: each person is 2 register calls; a slow one no longer
    // stalls a whole batch. The global dispatch gate still bounds the rate.
    await mapPool(personNodes, concurrency, async (node) => {
        const name = node.data.label.trim();
        const [disqualified, insolvency] = await Promise.allSettled([
            searchDisqualifiedDirectors(name, config, logger, 10, 0, baseUrl),
            searchInsolvency(name, config, logger, 1000, 1, baseUrl),
        ]);

        const isDisqualified = disqualified.status === 'fulfilled' && disqualified.value.roles.length > 0;
        const insolvencyRecords = insolvency.status === 'fulfilled' ? insolvency.value.searchResults : [];
        const hasInsolvencyRecord = insolvencyRecords.length > 0;
        const insolvencyCurrent = insolvencyRecords.some(isInsolvencyRecordCurrent);

        resultByNodeId.set(node.id, { isDisqualified, hasInsolvencyRecord, insolvencyCurrent });
    });

    console.log(`✅ Checked ${resultByNodeId.size} unique person(s) against the Disqualified Directors and Insolvency registers`);

    return nodes.map(node => {
        const result = resultByNodeId.get(node.id);
        if (!result) return node;
        return {
            ...node,
            data: {
                ...node.data,
                isDisqualified: result.isDisqualified,
                hasInsolvencyRecord: result.hasInsolvencyRecord,
                insolvencyCurrent: result.insolvencyCurrent,
            }
        };
    });
}
