// In-memory store for generated graph HTML.
//
// Lives in the same module space as api/mcp.ts so the tool handler (which
// writes) and the GET handler (which reads) share the same Map. On Vercel
// this works reliably within a warm function instance — if the user clicks
// the link minutes after the tool call, the instance is almost certainly
// still warm.
//
// Caveats:
//   - A cold instance won't have the entry. The reader returns 404 with a
//     friendly "regenerate the graph" message.
//   - Vercel can fan out to multiple parallel instances. Within one chat
//     session this is essentially never observed, but the failure mode is
//     the same friendly 404.
//
// For multi-instance durability, swap the Map for Vercel Blob/KV.

import { randomBytes } from 'crypto';

interface Entry {
    html: string;
    expiresAt: number;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_ENTRIES = 50;        // cap memory; oldest entries evicted first

const store = new Map<string, Entry>();

function sweep(): void {
    const now = Date.now();
    for (const [id, entry] of store) {
        if (entry.expiresAt < now) store.delete(id);
    }
    // Hard cap — drop oldest insertion-order entries until under cap.
    while (store.size > MAX_ENTRIES) {
        const oldest = store.keys().next().value;
        if (!oldest) break;
        store.delete(oldest);
    }
}

export function putGraph(html: string): string {
    sweep();
    const id = randomBytes(12).toString('base64url');
    store.set(id, { html, expiresAt: Date.now() + TTL_MS });
    return id;
}

export function getGraph(id: string): string | null {
    sweep();
    const entry = store.get(id);
    return entry ? entry.html : null;
}
