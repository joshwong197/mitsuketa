// Mobile pins, notes and recents. Kept in this browser only (localStorage),
// like desktop save points. A pin keeps a small snapshot of what the register
// said when it was pinned, so the Pinned tab can say what changed since.

export type MobileKey = `c:${string}` | `p:${string}`; // c:NZBN, p:person name
export interface Snapshot { status?: string; directors?: string[]; holders?: Record<string, number | null>; roles?: string[] }
export interface Pin { key: MobileKey; name: string; pinnedAt: string; snap: Snapshot }
export interface Recent { key: MobileKey; name: string; sub: string }

const read = <T>(k: string, fallback: T): T => {
    try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? fallback; } catch { return fallback; }
};
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

const PINS = 'mitsuketa_m_pins', NOTES = 'mitsuketa_m_notes', RECENT = 'mitsuketa_m_recent';
export const loadPins = () => read<Pin[]>(PINS, []);
export const savePins = (pins: Pin[]) => write(PINS, pins);
export const loadNotes = () => read<Record<string, string>>(NOTES, {});
export const saveNotes = (notes: Record<string, string>) => write(NOTES, notes);
export const loadRecent = () => read<Recent[]>(RECENT, []);
export function pushRecent(entry: Recent): Recent[] {
    const next = [entry, ...loadRecent().filter(r => r.key !== entry.key)].slice(0, 20);
    write(RECENT, next);
    return next;
}

const pctText = (n: number | null) => n === null ? 'unknown share' : `${Math.round(n * 10) / 10}%`;
/** Plain-language list of what differs between a pin's snapshot and the register now. */
export function diffSnapshot(was: Snapshot, now: Snapshot): string[] {
    const out: string[] = [];
    if (was.status !== undefined && now.status !== undefined && was.status !== now.status) out.push(`Status changed from ${was.status} to ${now.status}`);
    const sets = (label: [string, string], a: string[] = [], b: string[] = []) => {
        b.filter(x => !a.includes(x)).forEach(x => out.push(`${label[0]}: ${x}`));
        a.filter(x => !b.includes(x)).forEach(x => out.push(`${label[1]}: ${x}`));
    };
    sets(['New director', 'No longer a director'], was.directors, now.directors);
    if (was.holders && now.holders) {
        sets(['New shareholder', 'No longer a shareholder'], Object.keys(was.holders), Object.keys(now.holders));
        for (const k of Object.keys(now.holders)) {
            if (k in was.holders && was.holders[k] !== null && now.holders[k] !== null && Math.abs(was.holders[k]! - now.holders[k]!) >= 0.05)
                out.push(`${k}: ${pctText(was.holders[k])} → ${pctText(now.holders[k])}`);
        }
    }
    sets(['New role', 'Role ended'], was.roles, now.roles);
    return out;
}
