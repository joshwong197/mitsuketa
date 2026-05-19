import { searchByPersonName } from '../../services/directorSearchService';
import { enrichCompanyResults } from '../../src/api/companyStatusApi';
import { buildApiConfig, getProxyBaseUrl } from '../lib/config';
import { SearchPersonInput } from '../schemas';
import type { ToolContext } from './shared';

export const searchPerson = {
    name: 'mitsuketa_search_person',
    config: {
        title: 'Search NZ companies by a person\'s name',
        description:
            'Find every NZ-registered company where a person is a director or shareholder. Returns one row per company with role type, shareholding %, company status, and (when known) the person\'s residential address. Includes a strict name filter to avoid false positives from the Companies Office substring search. Results are enriched with insolvency/admin status so you can see at a glance which of the person\'s companies are in liquidation/receivership.',
        inputSchema: SearchPersonInput,
    },
    handler: async (args: { name: string }, ctx: ToolContext) => {
        const baseUrl = getProxyBaseUrl(ctx.req);
        const config = buildApiConfig();
        const raw = await searchByPersonName(args.name, '', undefined, baseUrl);
        const enriched = await enrichCompanyResults(raw, config, undefined, 5, undefined, baseUrl);
        return {
            content: [{ type: 'text' as const, text: JSON.stringify(enriched, null, 2) }],
        };
    },
};
