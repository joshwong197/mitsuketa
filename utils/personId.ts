/**
 * Deterministic person ID: `P-` + normalized uppercase name. Tokens are
 * sorted so "Smith, John" and "John Smith" intersect — two registers that
 * disagree on name ordering still resolve to the same individual. (Caveat
 * surfaced in the UI: same-name individuals cannot be distinguished.)
 *
 * The single source of truth for person identity across the graph crawl
 * (services/apiService.ts), the compare BFS (services/compareService.ts,
 * which re-exports this), case notes, and status diffing. No dependencies,
 * so it can be imported by apiService without creating a cycle through
 * compareService (which itself imports from apiService).
 */
export const personId = (name: string): string =>
  'P-' +
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .sort()
    .join('-');

export const displayPersonName = (name: string): string =>
  name.replace(/\s+/g, ' ').trim();
