/** Longest distance to a leaf in the condensation DAG. Cycles occupy one
 * level; iterative walks avoid stack overflow and never discard data edges. */
export function layoutDepths(nodes: { id: string }[], edges: { source: string; target: string }[]): Map<string, number> {
    const ids = new Set(nodes.map(n => n.id));
    const out = new Map([...ids].map(id => [id, [] as string[]]));
    const incoming = new Map([...ids].map(id => [id, [] as string[]]));
    for (const e of edges) if (ids.has(e.source) && ids.has(e.target)) {
        out.get(e.source)!.push(e.target); incoming.get(e.target)!.push(e.source);
    }
    const seen = new Set<string>(), order: string[] = [];
    for (const id of ids) {
        if (seen.has(id)) continue;
        const stack: [string, number][] = [[id, 0]]; seen.add(id);
        while (stack.length) {
            const entry = stack[stack.length - 1], children = out.get(entry[0])!;
            if (entry[1] < children.length) {
                const child = children[entry[1]++];
                if (!seen.has(child)) { seen.add(child); stack.push([child, 0]); }
            } else { order.push(entry[0]); stack.pop(); }
        }
    }
    const component = new Map<string, number>(); let count = 0;
    for (const id of order.reverse()) {
        if (component.has(id)) continue;
        const stack = [id]; component.set(id, count);
        while (stack.length) for (const parent of incoming.get(stack.pop()!)!) {
            if (!component.has(parent)) { component.set(parent, count); stack.push(parent); }
        }
        count++;
    }
    const children = Array.from({ length: count }, () => new Set<number>());
    const parents = Array.from({ length: count }, () => new Set<number>());
    for (const e of edges) {
        const a = component.get(e.source), b = component.get(e.target);
        if (a !== undefined && b !== undefined && a !== b) { children[a].add(b); parents[b].add(a); }
    }
    const remaining = children.map(s => s.size), depths = Array(count).fill(0);
    const ready = remaining.flatMap((n, i) => n === 0 ? [i] : []);
    for (let i = 0; i < ready.length; i++) for (const p of parents[ready[i]]) {
        depths[p] = Math.max(depths[p], depths[ready[i]] + 1);
        if (--remaining[p] === 0) ready.push(p);
    }
    return new Map([...ids].map(id => [id, depths[component.get(id)!]]));
}
