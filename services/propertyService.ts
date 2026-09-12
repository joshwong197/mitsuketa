import type { MemorialRow } from '../utils/memorials.js';
import { signOut, sessionGeneration } from '../utils/propertySession.js';
import { propertyAuthHeaders, exitPropertyAuth, usesClerk } from '../utils/propertyAuthClient';

/**
 * Client for /api/property — the LINZ Title Register feature (家族).
 *
 * Everything goes through the serverless handler: the LINZ API key is server-side
 * only and never reaches the browser. The session is an httpOnly cookie, so it is
 * not readable here either — `credentials: 'same-origin'` is what carries it.
 *
 * Searches may carry a matter reference independently of the signed-in account.
 * Responses include the durable Neon audit ID for the search/report request.
 */

export class PropertyError extends Error {
    constructor(message: string, readonly code: string, readonly status: number) {
        super(message);
    }
}

/** The session is gone or was never valid — the caller should re-lock the UI. */
export class SessionExpiredError extends PropertyError {}

export interface AddressCandidate {
    address_id: number;
    full_address: string;
    suburb_locality?: string | null;
    town_city?: string | null;
    territorial_authority?: string | null;
}

export interface TitleSummary {
    title_no: string;
    type?: string | null;
    status?: string | null;
    land_district?: string | null;
    owners?: string | null;
}

export interface AuditReference {
    audit_reference?: string;
    matter_reference?: string;
}

export interface AddressResult extends AuditReference {
    resolution_status: 'ok' | 'not_found' | 'no_title' | 'no_geometry' | 'needs_confirmation';
    query: string;
    resolved_address?: Record<string, any>;
    titles?: TitleSummary[];
    candidates?: AddressCandidate[];
    note?: string;
}

export interface OwnerRow {
    title_no?: string | null;
    corporate_name?: string | null;
    prime_surname?: string | null;
    prime_other_names?: string | null;
    land_district?: string | null;
    title?: TitleSummary | null;
}

export interface OwnerResult extends AuditReference {
    query: string;
    results: OwnerRow[];
    truncated: boolean;
}

export interface TitleReport extends AuditReference {
    title: Record<string, any> | null;
    owners: Record<string, any>[];
    memorials: MemorialRow[];
    estates: Record<string, any>[];
    address: string | null;
    /** Parcel outline for the aerial map; null when the title carries none. */
    geometry?: { type: string; coordinates: any } | null;
    bbox?: [number, number, number, number] | null;
}


const ENDPOINT = '/api/property';

/** Aerial tile URL — proxied so the LINZ key never reaches the browser. */
export function tileUrl(z: number, x: number, y: number): string {
    return `${ENDPOINT}?mode=tile&z=${z}&x=${x}&y=${y}`;
}


async function request<T>(params: Record<string, string>): Promise<T> {
    const generation = sessionGeneration();
    const url = `${ENDPOINT}?${new URLSearchParams(params)}`;
    const resp = await fetch(url, { credentials: 'same-origin', headers: await propertyAuthHeaders() });
    if (generation !== sessionGeneration()) throw new SessionExpiredError('Your account changed. Run the search again.', 'session_changed', 401);
    if (resp.ok) {
        const data = await resp.json() as T;
        if (generation !== sessionGeneration()) throw new SessionExpiredError('Your account changed. Run the search again.', 'session_changed', 401);
        return data;
    }

    let code = 'request_failed';
    let message = `Request failed (${resp.status}).`;
    try {
        const body = await resp.json();
        code = body.error ?? code;
        message = body.message ?? message;
    } catch {
        // Non-JSON error body; keep the defaults.
    }
    if (resp.status === 401) {
        // Drop the client's unlock state so the UI shows the login screen again
        // rather than looping on a session the server has already forgotten.
        signOut();
        throw new SessionExpiredError('Your session has ended. Sign in again.', code, 401);
    }
    if (resp.status === 503) {
        throw new PropertyError(
            code === 'audit_unavailable' ? message : 'Property search is not enabled on this deployment.', code, 503);
    }
    throw new PropertyError(message, code, resp.status);
}

/** Returns the searcher name the server recorded. Throws on bad credentials. */
export async function login(searcher: string, password: string): Promise<{ searcher: string; canAudit: boolean }> {
    const resp = await fetch(`${ENDPOINT}?mode=login`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ searcher, password }),
    });
    if (resp.ok) {
        const body = await resp.json();
        return { searcher: body.searcher ?? searcher, canAudit: body.canAudit === true };
    }
    let code = 'login_failed';
    let message = 'Sign-in failed.';
    try {
        const body = await resp.json();
        code = body.error ?? code;
        if (body.message) message = body.message;
    } catch {
        // keep defaults
    }
    if (resp.status === 401) message = 'Those credentials were not accepted.';
    if (resp.status === 503) {
        message = 'Property search is not enabled on this deployment.';
    }
    throw new PropertyError(message, code, resp.status);
}

export async function logout(): Promise<void> {
    try {
        if (usesClerk()) { await exitPropertyAuth(); return; }
        await fetch(`${ENDPOINT}?mode=logout`, {
            method: 'POST', credentials: 'same-origin',
        });
    } finally {
        signOut();
    }
}

export function searchAddress(
    query: string, addressId?: number, reference?: string,
): Promise<AddressResult> {
    const params: Record<string, string> = { mode: 'address' };
    if (addressId !== undefined) params.address_id = String(addressId);
    // Sent alongside address_id too, so the audit line records what was typed
    // rather than just the id that got picked from the candidate list.
    if (query) params.q = query;
    if (reference) params.ref = reference;
    return request<AddressResult>(params);
}

export function searchOwner(query: string, reference = ''): Promise<OwnerResult> {
    return request<OwnerResult>({ mode: 'owner', q: query, ref: reference });
}

export function fetchTitleReport(titleNo: string, reference = ''): Promise<TitleReport> {
    return request<TitleReport>({ mode: 'title', title_no: titleNo, ref: reference });
}

export interface SearchAuditRow {
    audit_reference: string;
    created_at: string;
    mode: string;
    query: string;
    title_no: string | null;
    actor: string | null;
    matter_ref: string | null;
    ip: string | null;
}

export function fetchSearchAudit(searcher = ''): Promise<{ rows: SearchAuditRow[] }> {
    return request({ mode: 'audit', searcher });
}
