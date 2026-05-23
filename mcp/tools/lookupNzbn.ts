import { searchEntities } from '../../services/apiService.js';
import { buildApiConfig, getProxyBaseUrl } from '../lib/config.js';
import { LookupNzbnInput } from '../schemas.js';
import type { ToolContext } from './shared.js';

export const lookupNzbn = {
    name: 'mitsuketa_lookup_nzbn',
    config: {
        title: 'Look up NZ company NZBN by name',
        description:
            'Resolve a NZ company name (full or partial) to one or more 13-digit NZBNs. Returns name, NZBN, entity type, and current status for each match. Use this first when the user gives a company name and you need an NZBN to call the other Mitsuketa tools (get_entity_full, get_company_status, build_ownership_graph, etc.).',
        inputSchema: LookupNzbnInput,
    },
    handler: async (args: { name: string; page?: number }, ctx: ToolContext) => {
        const data = await searchEntities(
            args.name,
            buildApiConfig(),
            undefined,
            args.page ?? 0,
            getProxyBaseUrl(ctx.req),
        );
        return {
            content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        };
    },
};
