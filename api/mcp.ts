// Vercel serverless function — MCP HTTP transport.
// Endpoint: POST /api/mcp (and GET for SSE).
//
// Each request creates a fresh McpServer + StreamableHTTPServerTransport;
// the transport handles the JSON-RPC handshake and dispatches tool calls
// into our handlers. Rate limiting is applied before dispatch.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../mcp/lib/rateLimit.js';
import { getGraph, getGraphData } from '../mcp/lib/graphStore.js';

export const config = {
    // Allow up to 60s for slow tools like build_ownership_graph.
    maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Short-circuit: GET /api/mcp?graphId=X serves a previously-generated
    // ownership graph HTML. Same function = same module memory as the tool
    // that wrote it. See mcp/lib/graphStore.ts for the durability caveats.
    // JSON data fetch for the React-based /graph.html viewer page.
    if (req.method === 'GET' && typeof req.query.graphData === 'string') {
        const json = getGraphData(req.query.graphData);
        if (!json) {
            res.setHeader('Cache-Control', 'no-store');
            return res.status(404).json({ error: 'Graph data not found or expired' });
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(json);
    }

    if (req.method === 'GET' && typeof req.query.graphId === 'string') {
        const html = getGraph(req.query.graphId);
        if (!html) {
            res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.send(
                `<!doctype html><meta charset="utf-8"><title>Graph expired</title>` +
                `<div style="font:16px/1.5 system-ui;max-width:560px;margin:80px auto;padding:0 24px;color:#333">` +
                `<h1 style="margin:0 0 8px">Graph not found</h1>` +
                `<p>This ownership graph link has expired or the serving function instance was recycled.</p>` +
                `<p>Ask Claude to regenerate it — re-run the same prompt and a fresh link will be issued.</p>` +
                `</div>`,
            );
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        return res.send(html);
    }

    // Dynamic imports so a module-load failure surfaces as a clean JSON error,
    // not a Vercel FUNCTION_INVOCATION_FAILED with no message visible to the client.
    let StreamableHTTPServerTransport: any;
    let createMcpServer: any;
    try {
        ({ StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js'));
        ({ createMcpServer } = await import('../mcp/server.js'));
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
