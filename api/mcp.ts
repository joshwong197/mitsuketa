// Vercel serverless function — MCP HTTP transport.
// Endpoint: POST /api/mcp (and GET for SSE).
//
// Each request creates a fresh McpServer + StreamableHTTPServerTransport;
// the transport handles the JSON-RPC handshake and dispatches tool calls
// into our handlers. Rate limiting is applied before dispatch.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../mcp/lib/rateLimit';

export const config = {
    // Allow up to 60s for slow tools like build_ownership_graph.
    maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Dynamic imports so a module-load failure surfaces as a clean JSON error,
    // not a Vercel FUNCTION_INVOCATION_FAILED with no message visible to the client.
    let StreamableHTTPServerTransport: any;
    let createMcpServer: any;
    try {
        ({ StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js'));
        ({ createMcpServer } = await import('../mcp/server'));
    } catch (err: any) {
        console.error('MCP import error:', err);
        return res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: `MCP import failed: ${err?.message || String(err)}`, data: { stack: err?.stack } },
            id: null,
        });
    }

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

    let server: any;
    let transport: any;
    try {
        server = createMcpServer({ req });
        transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await server.connect(transport);
        await transport.handleRequest(req as any, res as any, req.body);
    } catch (err: any) {
        console.error('MCP runtime error:', err);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: err?.message || 'Internal MCP error', data: { stack: err?.stack } },
                id: null,
            });
        }
    }
}
