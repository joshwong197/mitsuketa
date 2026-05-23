import { fetchEntityDetails } from '../../services/apiService.js';
import { buildApiConfig, getProxyBaseUrl } from '../lib/config.js';
import { GetEntityFullInput } from '../schemas.js';
import type { ToolContext } from './shared.js';

export const getEntityFull = {
    name: 'mitsuketa_get_entity_full',
    config: {
        title: 'Get full NZ entity details',
        description:
            'Look up a NZ company by its 13-digit NZBN and return the full entity record — name, status, shareholding allocations (who owns shares), and roles (directors and shareholders). Use this when you need the corporate-structure data. If you only have a company name, call mitsuketa_lookup_nzbn first to resolve it to an NZBN.',
        inputSchema: GetEntityFullInput,
    },
    handler: async (args: { nzbn: string }, ctx: ToolContext) => {
        const data = await fetchEntityDetails(args.nzbn, buildApiConfig(), getProxyBaseUrl(ctx.req));
        return {
            content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        };
    },
};
