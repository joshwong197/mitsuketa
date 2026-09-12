import { PersonCompanyResult } from '../types';

/**
 * The name to display for a searched individual.
 *
 * Prefers the register's own spelling — role records carry firstName/lastName as
 * filed — so a search typed "ritesh mani" shows as the registered "Ritesh MANI"
 * rather than being guessed at. Falls back to title-casing the query when the
 * register gives us nothing, and leaves an already mixed-case string alone (it
 * either came from the register or the user capitalised it deliberately).
 *
 * Shared so the case-file panel and the page masthead cannot disagree — they did:
 * the masthead showed the register spelling while the panel still showed whatever
 * was typed.
 */
export function displaySubjectName(query: string, results: PersonCompanyResult[]): string {
    const first = results.find(r => r.firstName)?.firstName?.trim();
    const last = results.find(r => r.lastName)?.lastName?.trim();
    if (first && last) return `${first} ${last}`;

    const s = (query ?? '').trim();
    if (!s || (s !== s.toLowerCase() && s !== s.toUpperCase())) return s;
    return s
        .toLowerCase()
        .replace(/(^|[\s,'’-])([a-z])/g, (_m, sep, c) => sep + c.toUpperCase())
        // "mcgill" → "Mcgill" above, then → "McGill". Mac- is left alone on
        // purpose: Mackenzie takes it, Macey does not, and we can't tell which.
        .replace(/\bMc([a-z])/g, (_m, c) => 'Mc' + c.toUpperCase());
}
