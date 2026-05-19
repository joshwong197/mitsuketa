// MCP server factory. Creates a fresh McpServer per HTTP request so each
// request has its own per-request context (used to derive the proxy URL
// from the inbound headers).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { getEntityFull } from './tools/getEntityFull';
import { getEntityStatusHistory } from './tools/getEntityStatusHistory';
import { searchPerson } from './tools/searchPerson';
import { getCompanyDirectors } from './tools/getCompanyDirectors';
import { checkDisqualification } from './tools/checkDisqualification';
import { checkInsolvency } from './tools/checkInsolvency';
import { getCompanyStatus } from './tools/getCompanyStatus';
import { buildOwnershipGraph } from './tools/buildOwnershipGraph';

import type { ToolContext } from './tools/shared';

const SERVER_INFO = {
    name: 'mitsuketa',
    version: '0.1.0',
};

const TOOLS = [
    getEntityFull,
    getEntityStatusHistory,
    searchPerson,
    getCompanyDirectors,
    checkDisqualification,
    checkInsolvency,
    getCompanyStatus,
    buildOwnershipGraph,
];

export function createMcpServer(ctx: ToolContext): McpServer {
    const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } });

    for (const tool of TOOLS) {
        server.registerTool(tool.name, tool.config as any, async (args: any) => {
            return (await tool.handler(args, ctx)) as any;
        });
    }

    return server;
}
