// Property searches and report opens go to Neon through propertyAudit.ts.
// Store only the input, matter reference and authenticated credential. Access
// events remain structured platform logs. No returned owner data is stored.

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
    /** Optional matter/file reference supplied with the search. */
    reference?: string;
    /** What was typed. Never what came back. */
    query?: string;
    /** Who signed in. Under per-user credentials this is their email address. */
    searcher?: string;
    /**
     * Whether an identity provider asserted `searcher`, or the person simply
     * typed it. Always false today — a password, per-user or shared, proves
     * knowledge of a secret, not ownership of a mailbox. Recorded explicitly so
     * that entries made before SSO stay distinguishable from ones made after,
     * instead of being silently conflated. See design/PROPERTY_ACCESS_PLAN.md.
     */
    verified?: boolean;
    ip?: string;
    accountId?: string;
    actor?: string;
}

import { recordSearch } from './propertyAudit.js';

export async function add(event: Omit<AuditEvent, 'at'>): Promise<string | undefined> {
    const mode = event.action === 'search-address' ? 'address'
        : event.action === 'search-owner' ? 'owner'
        : event.action === 'report-opened' ? 'title' : null;
    if (mode) {
        if (!event.searcher || !event.query) throw new Error('Search audit input is incomplete');
        return recordSearch({ mode, query: event.query, searcher: event.searcher,
            reference: event.reference, ip: event.ip, accountId: event.accountId, actor: event.actor });
    }
    const record: AuditEvent = { at: new Date().toISOString(), verified: false, ...event };
    // Access events remain platform logs. Searches above must reach Neon before
    // any LINZ request; a failed audit write blocks the search.
    console.log(`[property-audit] ${JSON.stringify(record)}`);
}
