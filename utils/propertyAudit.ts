// Server-only Neon adapter. This module must never be imported by React.
import { neon } from '@neondatabase/serverless';
import { isIP } from 'node:net';

export class AuditUnavailableError extends Error {
    constructor() { super('Search audit is unavailable'); }
}

export interface SearchAuditInput {
    mode: 'address' | 'owner' | 'title';
    query: string;
    searcher: string;
    reference?: string;
    ip?: string;
}

type Query = (sql: string, params: unknown[]) => Promise<Record<string, any>[]>;

function query(sql: string, params: unknown[]) {
    if (!process.env.DATABASE_URL) throw new AuditUnavailableError();
    return neon(process.env.DATABASE_URL).query(sql, params);
}

export function normalizeIp(value?: string): string | null {
    const first = value?.split(',')[0].trim();
    return first && isIP(first) ? first : null;
}

export function canReadAudit(searcher: string): boolean {
    return (process.env.PROPERTY_AUDIT_ADMINS || '').split(',')
        .map(value => value.trim().toLowerCase()).filter(Boolean)
        .includes(searcher.trim().toLowerCase());
}

export async function recordSearch(input: SearchAuditInput, execute: Query = query): Promise<string> {
    try {
        // Explicit allowlist: returned report objects can never be spread into
        // the stored record. A credential name is not verified mailbox ownership.
        const rows = await execute(
            'INSERT INTO search_audit (mode, query, title_no, actor, matter_ref, ip) '
            + 'VALUES ($1,$2,$3,$4,$5,$6) RETURNING audit_reference',
            [input.mode, input.query, input.mode === 'title' ? input.query : null,
                `password:${input.searcher}`, input.reference || null, normalizeIp(input.ip)],
        );
        if (!rows[0]?.audit_reference) throw new AuditUnavailableError();
        return String(rows[0].audit_reference);
    } catch {
        // DB errors can contain connection details; expose/log no raw exception.
        throw new AuditUnavailableError();
    }
}

export async function recentSearches(searcher?: string, execute: Query = query) {
    try {
        return await execute(
            "SELECT COALESCE(audit_reference::text, 'AUD-' || id) AS audit_reference, created_at, mode, query, "
            + 'title_no, actor, matter_ref, ip FROM search_audit '
            + 'WHERE ($1::text IS NULL OR actor=$1) '
            + 'ORDER BY created_at DESC, id DESC LIMIT 200',
            [searcher ? `password:${searcher.trim().toLowerCase()}` : null],
        );
    } catch {
        throw new AuditUnavailableError();
    }
}
