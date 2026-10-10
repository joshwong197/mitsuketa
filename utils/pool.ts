// Run `fn` over `items` with at most `concurrency` in flight at once — a
// continuous worker pool, NOT a per-batch barrier. A batch loop
// (`for (…i += C) await Promise.all(slice)`) stalls the whole batch on its
// slowest item; a pool starts the next item the instant a worker frees up, so
// one slow register lookup never holds up the rest. Every call still funnels
// through safeFetch's global dispatch gate, so the API rate limit is respected
// regardless of how high `concurrency` goes.
export async function mapPool<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker));
    return results;
}
