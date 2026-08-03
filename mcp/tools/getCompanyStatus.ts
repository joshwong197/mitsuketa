import { fetchCompanyStatus } from '../../src/api/companyStatusApi.js';
import { buildApiConfig, getProxyBaseUrl } from '../lib/config.js';
import { GetCompanyStatusInput } from '../schemas.js';
import type { ToolContext } from './shared.js';

export const getCompanyStatus = {
    name: 'mitsuketa_get_company_status',
    config: {
        title: 'Get NZ company insolvency/admin status',
        description:
            'Return risk-enrichment fields for one or more NZ companies: current entity status, whether the company is in receivership/liquidation/voluntary or statutory administration, whether removal has commenced, and whether it has historic insolvency events (with the type). Pass `nzbn` for a single company or `nzbns` (max 50) for a batch.',
        inputSchema: GetCompanyStatusInput,
    },
    handler: async (args: { nzbn?: string; nzbns?: string[] }, ctx: ToolContext) => {
        const config = buildApiConfig();
        const baseUrl = getProxyBaseUrl(ctx.req);

        if (args.nzbn && args.nzbns) {
            throw new Error('Provide either `nzbn` or `nzbns`, not both.');
        }
        if (!args.nzbn && (!args.nzbns || args.nzbns.length === 0)) {
            throw new Error('Provide `nzbn` (single) or `nzbns` (array of up to 50).');
        }

        if (args.nzbn) {
            const data = await fetchCompanyStatus(args.nzbn, config, undefined, baseUrl);
            return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
        }

        const results: Record<string, unknown> = {};
        const batchSize = 5;
        for (let i = 0; i < args.nzbns!.length; i += batchSize) {
            const batch = args.nzbns!.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map((nzbn) => fetchCompanyStatus(nzbn, config, undefined, baseUrl)),
            );
            batch.forEach((nzbn, idx) => {
                results[nzbn] = batchResults[idx];
            });
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
    },
};
