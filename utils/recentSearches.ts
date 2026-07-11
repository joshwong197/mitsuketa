/**
 * Recent-searches persistence for FindScreen.
 * localStorage key "mitsuketa:recent" holds a JSON array, most-recent-first:
 *   [{ q: "fletcher building", mode: "company" }, ...]
 * `q` is the raw query text (name, NZBN, or NZCN); `mode` matches
 * FindScreen's company/person toggle. Deduped case-insensitively per mode,
 * capped at 8 entries.
 */

export interface RecentSearch {
  q: string;
  mode: 'company' | 'person';
}

const KEY = 'mitsuketa:recent';
const MAX = 8;

export function loadRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is RecentSearch =>
          !!e &&
          typeof e.q === 'string' &&
          e.q.trim() !== '' &&
          (e.mode === 'company' || e.mode === 'person'),
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

/** Prepend `entry`, dedupe, cap, persist. Returns the new list. */
export function addRecentSearch(entry: RecentSearch): RecentSearch[] {
  const q = entry.q.trim();
  if (!q) return loadRecentSearches();
  const next = [
    { q, mode: entry.mode },
    ...loadRecentSearches().filter(
      (e) => !(e.mode === entry.mode && e.q.toLowerCase() === q.toLowerCase()),
    ),
  ].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — recents just won't persist */
  }
  return next;
}

export function clearRecentSearches(): RecentSearch[] {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return [];
}
