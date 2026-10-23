import type { EntityProfile } from './entityProfile';

// Who is behind a company: follow corporate shareholders up the register and
// multiply the percentages down each path. Used by the mobile company screen.

export interface Holding { names: string[]; nzbn: string; pct: number | null }
export interface Hop { name: string; nzbn: string }
export interface UltimateOwner extends Holding { via: Hop[]; end?: 'unresolved' | 'widely-held' }

type Loader = (nzbn: string) => Promise<EntityProfile>;

/** Direct holdings, merged per holder. Joint holders stay together as one holding. */
export function holdings(p: Pick<EntityProfile, 'allocations' | 'totalShares'>): Holding[] {
    const merged = new Map<string, Holding>();
    for (const a of p.allocations) {
        // Corporate holders come back as "1104175 - NAME LIMITED"; the number is the company number.
        const names = a.holders.map(h => h.name.replace(/^\d+\s+-\s+/, '')).filter(Boolean);
        if (!names.length) continue;
        const nzbn = a.holders.length === 1 ? a.holders[0].nzbn : '';
        const pct = p.totalShares && a.shares !== null ? a.shares / p.totalShares * 100 : null;
        const key = nzbn || names.map(n => n.toLowerCase()).sort().join('|');
        const prev = merged.get(key);
        if (prev) prev.pct = prev.pct === null || pct === null ? null : prev.pct + pct;
        else merged.set(key, { names, nzbn, pct });
    }
    return [...merged.values()].sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
}

// ponytail: walks at most `budget` parent companies; past that the holder is
// shown as unresolved. Raise it if real groups need deeper chains.
export async function ultimateOwners(root: EntityProfile, load: Loader, budget = 25, maxDepth = 8): Promise<UltimateOwner[]> {
    const out = new Map<string, UltimateOwner>();
    let loads = 0;
    const add = (h: Holding, pct: number | null, via: Hop[], end?: UltimateOwner['end']) => {
        const key = h.nzbn || h.names.map(n => n.toLowerCase()).sort().join('|');
        const prev = out.get(key);
        if (prev) prev.pct = prev.pct === null || pct === null ? null : prev.pct + pct;
        else out.set(key, { ...h, pct, via, end });
    };
    const walk = async (p: EntityProfile, factor: number | null, via: Hop[], seen: Set<string>): Promise<void> => {
        await Promise.all(holdings(p).map(async h => {
            const pct = factor === null || h.pct === null ? null : factor * h.pct / 100;
            if (!h.nzbn) return add(h, pct, via);
            if (seen.has(h.nzbn)) return; // circular holding: already counted on this path
            if (via.length >= maxDepth || loads >= budget) return add(h, pct, via, 'unresolved');
            loads++;
            let parent: EntityProfile;
            try { parent = await load(h.nzbn); } catch { return add(h, pct, via, 'unresolved'); }
            // A corporate holder with no shareholding on the register (overseas, trust, society) is where the trail ends.
            if (parent.extensive) return add(h, pct, via, 'widely-held');
            if (!parent.allocations.length) return add(h, pct, via);
            await walk(parent, pct, [...via, { name: parent.name || h.names[0], nzbn: h.nzbn }], new Set([...seen, h.nzbn]));
        }));
    };
    await walk(root, 100, [], new Set([root.nzbn]));
    return [...out.values()].sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
}
