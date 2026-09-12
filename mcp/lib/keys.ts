// Shared API-key resolution used by both the browser-facing proxy
// (api/proxy.ts) and the MCP server transport (api/mcp/[transport].ts).
//
// Priority: user-provided key > org-level env-var key > empty string.

export type ApiType = 'nzbn' | 'companies' | 'disqualified' | 'insolvency';

const ENV_VAR_BY_TYPE: Record<ApiType, string> = {
    nzbn: 'ORG_NZBN_KEY',
    companies: 'ORG_COMPANIES_KEY',
    disqualified: 'ORG_DISQUALIFIED_KEY',
    insolvency: 'ORG_INSOLVENCY_KEY',
};

export function resolveApiKey(apiType: string | undefined, userKey?: string): string {
    if (userKey && userKey.trim() !== '') return userKey;
    if (!apiType) return '';
    const envName = ENV_VAR_BY_TYPE[apiType as ApiType];
    return envName ? (process.env[envName] || '') : '';
}
