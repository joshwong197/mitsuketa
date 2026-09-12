// In-memory store for generated graph artefacts (HTML or JSON).
//
// Lives in the same module space as api/mcp.ts so the tool handler (which
// writes) and the GET handlers (which read) share the same Map. On Vercel
// this works reliably within a warm function instance — if the user clicks
// the link minutes after the tool call, the instance is almost certainly
// still warm.
//
// Caveats:
//   - A cold instance won't have the entry. Readers return 404 with a
//     friendly "regenerate the graph" message.
//   - Vercel can fan out to multiple parallel instances. Within one chat
//     session this is essentially never observed.
//
// For multi-instance durability, swap the Map for Vercel Blob/KV.

import { randomBytes } from 'crypto';

interface Entry {
    payload: string;
    expiresAt: number;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_ENTRIES = 50;        // cap memory; oldest entries evicted first

const htmlStore = new Map<string, Entry>();
const jsonStore = new Map<string, Entry>();

function sweep(store: Map<string, Entry>): void {
    const now = Date.now();
    for (const [id, entry] of store) {
        if (entry.expiresAt < now) store.delete(id);
    }
    while (store.size > MAX_ENTRIES) {
        const oldest = store.keys().next().value;
        if (!oldest) break;
        store.delete(oldest);
    }
}

function put(store: Map<string, Entry>, payload: string): string {
    sweep(store);
    const id = randomBytes(12).toString('base64url');
    store.set(id, { payload, expiresAt: Date.now() + TTL_MS });
    return id;
}

function get(store: Map<string, Entry>, id: string): string | null {
    sweep(store);
    const entry = store.get(id);
    return entry ? entry.payload : null;
}

export const putGraph = (html: string): string => put(htmlStore, html);
export const getGraph = (id: string): string | null => get(htmlStore, id);

export const putGraphData = (json: string): string => put(jsonStore, json);
export const getGraphData = (id: string): string | null => get(jsonStore, id);
