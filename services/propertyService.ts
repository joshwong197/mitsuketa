import type { MemorialRow } from '../utils/memorials.js';
import { signOut } from '../utils/propertySession.js';

/**
 * Client for /api/property — the LINZ Title Register feature (家族).
 *
 * Everything goes through the serverless handler: the LINZ API key is server-side
 * only and never reaches the browser. The session is an httpOnly cookie, so it is
 * not readable here either — `credentials: 'same-origin'` is what carries it.
 *
 * Every search needs a `reference`. The server rejects a blank one, because with
 * a shared credential the reference is the only thing that says what a search was
 * for.
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

export interface AddressResult {
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

export interface OwnerResult {
    query: string;
    results: OwnerRow[];
    truncated: boolean;
}

export interface TitleReport {
    title: Record<string, any> | null;
    owners: Record<string, any>[];
    memorials: MemorialRow[];
    estates: Record<string, any>[];
    address: string | null;
}

const ENDPOINT = '/api/property';

async function request<T>(params: Record<string, string>): Promise<T> {
    const url = `${ENDPOINT}?${new URLSearchParams(params)}`;
    const resp = await fetch(url, { credentials: 'same-origin' });
    if (resp.ok) return resp.json() as Promise<T>;

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
            'Property search is not enabled on this deployment.', code, 503);
    }
    throw new PropertyError(message, code, resp.status);
}

/** Returns the searcher name the server recorded. Throws on bad credentials. */
export async function login(searcher: string, password: string): Promise<string> {
    const resp = await fetch(`${ENDPOINT}?mode=login`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ searcher, password }),
    });
    if (resp.ok) {
        const body = await resp.json();
        return body.searcher ?? searcher;
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
        await fetch(`${ENDPOINT}?mode=logout`, {
            method: 'POST', credentials: 'same-origin',
        });
    } finally {
        signOut();
    }
}

export function searchAddress(
    query: string, reference: string, addressId?: number,
): Promise<AddressResult> {
    const params: Record<string, string> = { mode: 'address', ref: reference };
    if (addressId !== undefined) params.address_id = String(addressId);
    // Sent alongside address_id too, so the audit line records what was typed
    // rather than just the id that got picked from the candidate list.
    if (query) params.q = query;
    return request<AddressResult>(params);
}

export function searchOwner(query: string, reference: string): Promise<OwnerResult> {
    return request<OwnerResult>({ mode: 'owner', q: query, ref: reference });
}

export function fetchTitleReport(titleNo: string, reference: string): Promise<TitleReport> {
    return request<TitleReport>({ mode: 'title', title_no: titleNo, ref: reference });
}
