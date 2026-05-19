// Vercel serverless function — MCP HTTP transport.
// Endpoint: POST /api/mcp (and GET for SSE).
//
// Each request creates a fresh McpServer + StreamableHTTPServerTransport;
// the transport handles the JSON-RPC handshake and dispatches tool calls
// into our handlers. Rate limiting is applied before dispatch.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { createMcpServer } from '../../mcp/server';
import { checkRateLimit } from '../../mcp/lib/rateLimit';

export const config = {
    // Allow up to 60s for slow tools like build_ownership_graph.
    maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || 'anonymous';
    const rl = checkRateLimit(clientIp);
    if (!rl.allowed) {
        return res.status(429).json({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Rate limit exceeded (200 requests / minute). Try again in a moment.',
            },
            id: null,
        });
    }

    const server = createMcpServer({ req });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    try {
        await server.connect(transport);
        await transport.handleRequest(req as any, res as any, req.body);
    } catch (err: any) {
        console.error('MCP transport error:', err);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: err?.message || 'Internal MCP error' },
                id: null,
            });
        }
    }
}
