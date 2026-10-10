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
    accountId?: string;
    actor?: string;
    operationId: string;
    titleNo?: string;
}

export interface SearchAuditContinuation {
    searcher: string;
    reference?: string;
    accountId?: string;
    actor?: string;
    operationId: string;
    titleNo?: string;
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
            'INSERT INTO search_audit (mode, query, title_no, actor, matter_ref, ip, account_id, operation_id, opened_titles) '
            + "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $3::text IS NULL THEN '{}'::text[] ELSE ARRAY[$3::text] END) "
            + 'ON CONFLICT (actor, operation_id) WHERE operation_id IS NOT NULL DO UPDATE SET '
            + 'title_no=COALESCE(search_audit.title_no, EXCLUDED.title_no), '
            + 'opened_titles=CASE WHEN EXCLUDED.title_no IS NULL OR EXCLUDED.title_no=ANY(search_audit.opened_titles) '
            + 'THEN search_audit.opened_titles ELSE array_append(search_audit.opened_titles, EXCLUDED.title_no) END '
            + 'WHERE search_audit.mode=EXCLUDED.mode AND search_audit.query=EXCLUDED.query '
            + 'AND search_audit.matter_ref IS NOT DISTINCT FROM EXCLUDED.matter_ref '
            + 'AND search_audit.account_id IS NOT DISTINCT FROM EXCLUDED.account_id RETURNING audit_reference',
            [input.mode, input.query, input.titleNo || (input.mode === 'title' ? input.query : null),
                input.actor || `password:${input.searcher}`, input.reference || null, normalizeIp(input.ip),
                input.accountId || null, input.operationId],
        );
        if (!rows[0]?.audit_reference) throw new AuditUnavailableError();
        return String(rows[0].audit_reference);
    } catch {
        // DB errors can contain connection details; expose/log no raw exception.
        throw new AuditUnavailableError();
    }
}

export async function continueSearch(input: SearchAuditContinuation, execute: Query = query): Promise<string> {
    try {
        const actor = input.actor || `password:${input.searcher}`;
        const rows = await execute(
            'UPDATE search_audit SET title_no=COALESCE(title_no,$5), '
            + 'opened_titles=CASE WHEN $5::text IS NULL OR $5=ANY(opened_titles) THEN opened_titles '
            + 'ELSE array_append(opened_titles,$5) END '
            + 'WHERE operation_id=$1 AND actor=$2 AND account_id IS NOT DISTINCT FROM $3 '
            + 'AND matter_ref IS NOT DISTINCT FROM $4 RETURNING audit_reference',
            [input.operationId, actor, input.accountId || null, input.reference || null, input.titleNo || null],
        );
        if (!rows[0]?.audit_reference) throw new AuditUnavailableError();
        return String(rows[0].audit_reference);
    } catch {
        throw new AuditUnavailableError();
    }
}

export async function recentSearches(searcher?: string, execute: Query = query) {
    try {
        return await execute(
            "SELECT COALESCE(s.audit_reference::text, 'AUD-' || s.id) AS audit_reference, s.created_at, s.mode, s.query, "
            + "s.title_no, s.opened_titles, s.actor, COALESCE(a.email::text, CASE WHEN s.actor LIKE 'password:%' THEN substring(s.actor from 10) ELSE s.actor END) AS searcher, "
            + 's.matter_ref, s.ip FROM search_audit s LEFT JOIN account a ON a.id=s.account_id '
            + 'WHERE ($1::text IS NULL OR s.actor=$1 OR a.email=$2) '
            + 'ORDER BY s.created_at DESC, s.id DESC LIMIT 200',
            [searcher ? `password:${searcher.trim().toLowerCase()}` : null, searcher?.trim().toLowerCase() || null],
        );
    } catch {
        throw new AuditUnavailableError();
    }
}
