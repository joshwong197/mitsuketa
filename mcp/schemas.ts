// Zod input schemas for each MCP tool. Output is validated only by the
// service functions themselves — we don't add a second layer of typing
// over their existing TypeScript return types.

import { z } from 'zod';

const NzbnString = z
    .string()
    .trim()
    .regex(/^\d{13}$/, 'NZBN must be exactly 13 digits');

const NameString = z.string().trim().min(2, 'name must be at least 2 characters');

export const GetEntityFullInput = {
    nzbn: NzbnString.describe('13-digit NZ Business Number'),
};

export const GetEntityStatusHistoryInput = {
    nzbn: NzbnString.describe('13-digit NZ Business Number'),
};

export const SearchPersonInput = {
    name: NameString.describe('Full or partial person name (e.g. "John Smith")'),
};

export const GetCompanyDirectorsInput = {
    nzbn: NzbnString.describe('13-digit NZ Business Number'),
};

export const CheckDisqualificationInput = {
    name: NameString.describe('Full or partial person name to check against the disqualified-directors register'),
    pageSize: z.number().int().min(1).max(100).optional().describe('Results per page (default 10)'),
    page: z.number().int().min(0).optional().describe('Page number, 0-indexed (default 0)'),
};

export const CheckInsolvencyInput = {
    name: NameString.describe('Full or partial person name to check against the personal insolvency register'),
    pageSize: z.number().int().min(1).max(1000).optional().describe('Results per page (default 1000)'),
    page: z.number().int().min(1).optional().describe('Page number, 1-indexed (default 1)'),
};

export const GetCompanyStatusInput = {
    nzbn: NzbnString.optional().describe('Single NZBN to check (use this OR nzbns, not both)'),
    nzbns: z.array(NzbnString).min(1).max(50).optional().describe('Up to 50 NZBNs for batch lookup'),
};

export const BuildOwnershipGraphInput = {
    nzbn: NzbnString.describe('Root entity NZBN to build the ownership graph from'),
    direction: z
        .enum(['upstream', 'downstream', 'both'])
        .optional()
        .describe('upstream = parent/owner chain; downstream = subsidiaries; both = full graph (default)'),
    depth: z.number().int().min(1).max(4).optional().describe('Max crawl depth in either direction (default 3, max 4)'),
    enrich: z.boolean().optional().describe('If true, enriches every node with insolvency/admin status (default true)'),
    format: z
        .enum(['json', 'html', 'both'])
        .optional()
        .describe('json = raw node/edge data; html = interactive self-contained file; both (default)'),
};
