import { PersonCompanyResult } from '../types';

/**
 * Groups a person's company results by the address the register publishes for
 * each role, most-used first.
 *
 * Deliberately not called "residential": from 18 Nov 2026 a director may publish
 * an alternative address instead, and the API is not expected to say which is
 * which. See design/HANDOVER.md — the match verdict needs revisiting before then.
 *
 * Pure — every field is already in memory from the person search, so this costs
 * no API calls. That is why the summary can sit on the individual page up front
 * rather than behind the KYD panel (design/HANDOVER.md §4 KYD).
 *
 * Shared by the KYD panel's address comparison and the identity spine so the two
 * can never disagree about which address is the most used.
 */
export interface AddressGroup {
    /** Address lines joined for display, without the postcode. */
    address: string;
    /** Display form including postcode where the register has one. */
    fullAddress: string;
    /** Company names filed against this address, in result order. */
    companies: string[];
    /** True when at least one company at this address is live and the role current. */
    isActive: boolean;
}

const addressKey = (lines: string[]): string =>
    lines.join(', ').toLowerCase().replace(/\s+/g, ' ').trim();

export function summariseAddresses(results: PersonCompanyResult[]): AddressGroup[] {
    const byKey = new Map<string, AddressGroup>();

    for (const r of results) {
        const lines = r.physicalAddress?.addressLines;
        if (!lines?.length) continue;

        const key = addressKey(lines);
        const address = lines.join(', ');
        const live = (r.entityStatusCode || 0) < 80 && !r.isInactive;

        const existing = byKey.get(key);
        if (existing) {
            existing.companies.push(r.companyName);
            if (live) existing.isActive = true;
        } else {
            byKey.set(key, {
                address,
                fullAddress: address + (r.physicalAddress!.postCode ? `, ${r.physicalAddress!.postCode}` : ''),
                companies: [r.companyName],
                isActive: live,
            });
        }
    }

    // Most-used first — the top row is the one a reader treats as "their" address.
    return [...byKey.values()].sort((a, b) => b.companies.length - a.companies.length);
}
