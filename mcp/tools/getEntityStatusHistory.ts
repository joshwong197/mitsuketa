import { fetchEntityStatusHistory } from '../../src/api/companyStatusApi';
import { buildApiConfig, getProxyBaseUrl } from '../lib/config';
import { GetEntityStatusHistoryInput } from '../schemas';
import type { ToolContext } from './shared';

export const getEntityStatusHistory = {
    name: 'mitsuketa_get_entity_status_history',
    config: {
        title: 'Get NZ entity status history',
        description:
            'Return the chronological list of past entity-status descriptions for an NZBN (e.g. "Registered" → "In Liquidation" → "Removed"). Useful for spotting historic insolvency events on a company that is now removed or back in good standing.',
        inputSchema: GetEntityStatusHistoryInput,
    },
    handler: async (args: { nzbn: string }, ctx: ToolContext) => {
        const data = await fetchEntityStatusHistory(args.nzbn, buildApiConfig(), getProxyBaseUrl(ctx.req));
        return {
            content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        };
    },
};
