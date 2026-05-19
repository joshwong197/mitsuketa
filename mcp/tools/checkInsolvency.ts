import { searchInsolvency } from '../../src/api/insolvencyApi';
import { buildApiConfig, getProxyBaseUrl } from '../lib/config';
import { CheckInsolvencyInput } from '../schemas';
import type { ToolContext } from './shared';

export const checkInsolvency = {
    name: 'mitsuketa_check_insolvency',
    config: {
        title: 'Check NZ personal insolvency register',
        description:
            'Search the NZ Insolvency Trustee Services register for personal bankruptcy records by name. Returns estate number, adjudication date, insolvency type (e.g. Bankruptcy), current status (Current Bankrupt / Discharged / Annulled), and trustee. Excludes company insolvency types (liquidations, administrations). Results are ephemeral and never persisted by this server.',
        inputSchema: CheckInsolvencyInput,
    },
    handler: async (args: { name: string; pageSize?: number; page?: number }, ctx: ToolContext) => {
        const data = await searchInsolvency(
            args.name,
            buildApiConfig(),
            undefined,
            args.pageSize ?? 1000,
            args.page ?? 1,
            getProxyBaseUrl(ctx.req),
        );
        return {
            content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        };
    },
};
