// Runtime configuration for the MCP server.
//
// Service functions are reused from the browser code path. They take an
// ApiConfig (carrying API keys) and a baseUrl pointing to /api/proxy.
// In the MCP server we don't have a browser, so:
//   - ApiConfig keys are left empty — the proxy resolves keys from
//     ORG_*_KEY env vars (same fallback the browser uses today).
//   - baseUrl is a fully-qualified URL to this deployment's /api/proxy.

import type { ApiConfig } from '../../types.js';

export function getProxyBaseUrl(req?: { headers?: Record<string, string | string[] | undefined> }): string {
    // 1. Explicit override (useful for tests / local dev pointing at a remote proxy).
    if (process.env.MITSUKETA_PROXY_URL) return process.env.MITSUKETA_PROXY_URL;

    // 2. Derive from the incoming request when running on Vercel.
    if (req?.headers) {
        const forwardedProto = pickHeader(req.headers, 'x-forwarded-proto') || 'https';
        const host = pickHeader(req.headers, 'x-forwarded-host') || pickHeader(req.headers, 'host');
        if (host) return `${forwardedProto}://${host}/api/proxy`;
    }

    // 3. Vercel injects VERCEL_URL (without scheme) in production.
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api/proxy`;

    // 4. Local dev fallback.
    return 'http://localhost:3000/api/proxy';
}

function pickHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
    const v = headers[name];
    if (Array.isArray(v)) return v[0];
    return v;
}

// Service functions expect an ApiConfig. The MCP server doesn't have user keys
// — the proxy falls back to ORG_*_KEY env vars when these are empty.
export function buildApiConfig(): ApiConfig {
    return {
        nzbnKey: '',
        companiesKey: '',
        disqualifiedDirectorsKey: '',
        insolvencyKey: '',
    };
}
