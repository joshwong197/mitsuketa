// MCP server factory. Creates a fresh McpServer per HTTP request so each
// request has its own per-request context (used to derive the proxy URL
// from the inbound headers).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { getEntityFull } from './tools/getEntityFull.js';
import { getEntityStatusHistory } from './tools/getEntityStatusHistory.js';
import { searchPerson } from './tools/searchPerson.js';
import { getCompanyDirectors } from './tools/getCompanyDirectors.js';
import { checkDisqualification } from './tools/checkDisqualification.js';
import { checkInsolvency } from './tools/checkInsolvency.js';
import { getCompanyStatus } from './tools/getCompanyStatus.js';
import { buildOwnershipGraph } from './tools/buildOwnershipGraph.js';

import type { ToolContext } from './tools/shared.js';

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
