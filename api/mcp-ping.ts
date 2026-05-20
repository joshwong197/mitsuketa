// Minimal diagnostic endpoint. If GET /api/mcp-ping returns JSON with status=ok,
// the Vercel function infrastructure is working in this project — so any failure
// on /api/mcp is specific to the MCP code, not the deployment / runtime / routing.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
    res.status(200).json({
        status: 'ok',
        runtime: process.version,
        cwd: process.cwd(),
        env: {
            hasNzbnKey: !!process.env.ORG_NZBN_KEY,
            hasCompaniesKey: !!process.env.ORG_COMPANIES_KEY,
            hasDisqualifiedKey: !!process.env.ORG_DISQUALIFIED_KEY,
            hasInsolvencyKey: !!process.env.ORG_INSOLVENCY_KEY,
            vercelUrl: process.env.VERCEL_URL,
            vercelEnv: process.env.VERCEL_ENV,
        },
    });
}
