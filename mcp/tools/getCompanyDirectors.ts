import { fetchDirectorsFromRolesEndpoint } from '../../services/directorService.js';
import { getProxyBaseUrl } from '../lib/config.js';
import { GetCompanyDirectorsInput } from '../schemas.js';
import type { ToolContext } from './shared.js';

export const getCompanyDirectors = {
    name: 'mitsuketa_get_company_directors',
    config: {
        title: 'Get current directors of a NZ company',
        description:
            'List current directors of a NZ company by NZBN. Returns first/last/middle name, appointment date, designation, and whether the director is an individual or another corporate entity.',
        inputSchema: GetCompanyDirectorsInput,
    },
    handler: async (args: { nzbn: string }, ctx: ToolContext) => {
        // apiKey is left blank; the proxy falls back to the ORG_NZBN_KEY env var.
        const data = await fetchDirectorsFromRolesEndpoint(args.nzbn, '', getProxyBaseUrl(ctx.req));
        return {
            content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        };
    },
};
