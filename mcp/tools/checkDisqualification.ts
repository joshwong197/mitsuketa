import { searchDisqualifiedDirectors } from '../../src/api/disqualifiedDirectorsApi.js';
import { buildApiConfig, getProxyBaseUrl } from '../lib/config.js';
import { CheckDisqualificationInput } from '../schemas.js';
import type { ToolContext } from './shared.js';

export const checkDisqualification = {
    name: 'mitsuketa_check_disqualification',
    config: {
        title: 'Check NZ disqualified directors register',
        description:
            'Search the NZ disqualified-directors register by name. Returns disqualification criteria (reason, start/end dates), aliases, and the companies the disqualified person was associated with. Use this to flag individuals who are banned from holding directorships.',
        inputSchema: CheckDisqualificationInput,
    },
    handler: async (args: { name: string; pageSize?: number; page?: number }, ctx: ToolContext) => {
        const data = await searchDisqualifiedDirectors(
            args.name,
            buildApiConfig(),
            undefined,
            args.pageSize ?? 10,
            args.page ?? 0,
            getProxyBaseUrl(ctx.req),
        );
        return {
            content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        };
    },
};
