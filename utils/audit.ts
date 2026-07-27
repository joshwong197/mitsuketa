// Audit trail for property searches.
//
// The LINZ Licence for Personal Data wants a record of who searched for what.
// With a shared credential the log records *why* (the reference the searcher
// typed) rather than *who*, plus whatever name they entered — unverified, but
// recorded.
//
// Record the INPUT, never the OUTPUT. The query is the accountable act; copying
// the personal data returned into a second store gives it a second retention
// story and makes the log its own privacy problem.
//
// ponytail: writes structured JSON to stdout, which on Vercel means the platform
// log — durable, but only readable via `vercel logs`, not in-app. Swap the body
// of add() for an INSERT when the Neon Postgres database is provisioned; that
// also unlocks the admin view, which needs a queryable store and a stated
// retention period with a deletion routine.

export type AuditAction =
    | 'sign-in'
    | 'sign-in-failed'
    | 'search-address'
    | 'search-owner'
    | 'report-opened'
    | 'refused';

export interface AuditEvent {
    at: string;
    action: AuditAction;
    /** The matter/file reference the searcher supplied. Required on searches. */
    reference?: string;
    /** What was typed. Never what came back. */
    query?: string;
    /** Self-declared, unverified — a shared credential can't prove identity. */
    searcher?: string;
    ip?: string;
}

export async function add(event: Omit<AuditEvent, 'at'>): Promise<void> {
    const record: AuditEvent = { at: new Date().toISOString(), ...event };
    // One line, prefixed so it can be grepped out of the platform log.
    console.log(`[property-audit] ${JSON.stringify(record)}`);
}
