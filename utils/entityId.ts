/**
 * Deterministic id for a company the register never linked to an NZBN — after
 * resolveEntityNzbn() (services/apiService.ts) has failed to recover one.
 *
 * Keyed on the Companies Office register number when the payload carries one,
 * otherwise on the normalised name, so the same unlinked holder appearing under
 * two subsidiaries collapses to one node. The old `ORG-${Math.random()}` id made
 * every appearance a separate node, and made the node impossible to address
 * from notes, diffs or expansion.
 *
 * No dependencies, so apiService can import it without a cycle — same reasoning
 * as utils/personId.ts.
 */
export const unlinkedCompanyId = (name: string, companyNumber?: string): string => {
  const number = (companyNumber || '').trim();
  if (number) return `ORG-CN-${number}`;
  const slug = (name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `ORG-${slug || 'UNKNOWN'}`;
};

/** Uppercase, punctuation-flattened name used for exact register matching. */
export const normaliseEntityName = (name: string): string =>
  (name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
