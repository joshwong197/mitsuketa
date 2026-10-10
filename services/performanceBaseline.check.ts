// Offline diagnostic baseline. Every fetch is replaced; this cannot contact providers.
// Queue/failure cases are regression assertions. Traversal is also checked;
// virtual timings are not claimed live speed improvements.
import assert from 'node:assert/strict';
import { gatedFetch, retryAfterMs } from '../utils/dispatchGate';
import { generateOrgChart } from './apiService';
import { enrichPersonNodes } from '../src/api/personStatusApi';
import { NodeType, type ApiConfig, type GraphNode } from '../types';

const original = { fetch: globalThis.fetch, now: Date.now, timer: globalThis.setTimeout, clearTimer: globalThis.clearTimeout, log: console.log, warn: console.warn, error: console.error };
const config = { nzbnKey: '', companiesKey: '', disqualifiedDirectorsKey: '', insolvencyKey: '', includeInactive: true } as ApiConfig;
const results: Record<string, unknown> = {};
let clock = 100000;
let timerId = 0;
let timers: { at: number; id: number; callback: () => void }[] = [];
Date.now = () => clock;
globalThis.setTimeout = ((callback: () => void, ms = 0) => { timers.push({ at: clock + Number(ms), id: ++timerId, callback }); return timerId; }) as typeof setTimeout;
globalThis.clearTimeout = ((id: unknown) => { timers = timers.filter(timer => timer.id !== id); }) as typeof clearTimeout;
async function run<T>(operation: Promise<T>): Promise<T> {
    let done = false; let value!: T; let failure: unknown;
    operation.then(v => { value = v; done = true; }, e => { failure = e; done = true; });
    for (let steps = 0; !done && steps < 10000; steps++) {
        for (let flush = 0; flush < 100; flush++) await Promise.resolve();
        if (done) break;
        timers.sort((a, b) => a.at - b.at || a.id - b.id);
        const next = timers.shift();
        assert.ok(next, 'Unsettled operation without fixture timer');
        clock = next.at; next.callback();
    }
    assert.ok(done, 'Fixture exceeded step bound');
    if (failure) throw failure;
    return value;
}
try {
    console.log = console.warn = console.error = () => {};
    const attempts: { url: string; ms: number }[] = [];
    let first = true;
    const start = clock;
    globalThis.fetch = async input => {
        attempts.push({ url: String(input), ms: clock - start });
        if (first) { first = false; return new Response('', { status: 429, headers: { 'Retry-After': '2' } }); }
        return new Response('{}');
    };
    await run(Promise.all(['first', 'queued'].map(name => gatedFetch(`https://fixture.invalid/${name}`, { headers: { 'x-api-type': 'gate-fixture' } }))));
    results.cooldown = { retryAfterMs: 2000, attempts, cooldownRespected: attempts.slice(1).every(a => a.ms >= 2000) };
    assert.ok(attempts.slice(1).every(a => a.ms >= 2000), 'Queued requests and retries must respect cooldown');
    assert.equal(retryAfterMs('Wed, 21 Oct 2015 07:28:00 GMT', Date.parse('Wed, 21 Oct 2015 07:27:58 GMT')), 2000);
    assert.equal(retryAfterMs('invalid'), 0);
    assert.equal(retryAfterMs('0'), 0);

    let active = 0, peak = 0;
    globalThis.fetch = async () => {
        active++; peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 900));
        active--; return new Response('{}');
    };
    await run(Promise.all(Array.from({ length: 8 }, () => gatedFetch('https://fixture.invalid/cap', { headers: new Headers({ 'X-Api-Type': 'cap-fixture' }) }))));
    assert.equal(peak, 2, 'Bound in-flight requests even when responses are slow');
    const cancelled = new AbortController(); cancelled.abort();
    await assert.rejects(run(gatedFetch('https://fixture.invalid/cancelled', { signal: cancelled.signal })), { name: 'AbortError' });

    // A globally fair reservation schedule fills every 65ms global slot when
    // several ready services have work. This is an invariant check, not a
    // comparison with the previous scheduler.
    const utilisation: number[] = [];
    const utilisationStart = clock;
    globalThis.fetch = async () => { utilisation.push(clock - utilisationStart); return new Response('{}'); };
    await run(Promise.all(Array.from({ length: 9 }, (_, index) => gatedFetch(
        `https://fixture.invalid/utilisation/${index}`,
        { headers: { 'x-api-type': `utilisation-${index % 3}` } }
    ))));
    const reservationSpanMs = utilisation.at(-1)! - utilisation[0];
    results.fairGlobalReservations = { dispatches: utilisation, reservationSpanMs };
    assert.deepEqual(utilisation.map((at, index) => index === 0 ? 0 : at - utilisation[index - 1]), [0, 65, 65, 65, 65, 65, 65, 65, 65], 'Ready services consume consecutive global slots');
    assert.equal(reservationSpanMs, 520, 'Nine requests use eight 65ms global gaps');

    // A cooling service must not block the next eligible service. The retry is
    // kept behind its own Retry-After while an unrelated request gets the next
    // global slot.
    const cooldownOrder: { name: string; ms: number }[] = [];
    let coolingAttempts = 0;
    const cooldownStart = clock;
    globalThis.fetch = async input => {
        const name = String(input).split('/').at(-1)!;
        cooldownOrder.push({ name, ms: clock - cooldownStart });
        if (name === 'cooling' && coolingAttempts++ === 0) return new Response('', { status: 429, headers: { 'Retry-After': '2' } });
        return new Response('{}');
    };
    const cooling = gatedFetch('https://fixture.invalid/cooling', { headers: { 'x-api-type': 'cooling-fixture' } });
    for (let flush = 0; flush < 30; flush++) await Promise.resolve();
    const bypass = gatedFetch('https://fixture.invalid/bypass', { headers: { 'x-api-type': 'bypass-fixture' } });
    await run(Promise.all([cooling, bypass]));
    const bypassAt = cooldownOrder.find(entry => entry.name === 'bypass')!.ms;
    const retryAt = cooldownOrder.filter(entry => entry.name === 'cooling')[1]!.ms;
    results.cooldownBypass = { cooldownOrder, bypassAt, retryAt };
    assert.ok(bypassAt < 2000, 'Eligible service bypasses a cooling service');
    assert.ok(retryAt >= 2000, 'Cooling retry still respects Retry-After');

    // Cancellation removes an already queued waiter immediately; it never
    // reaches fetch after the occupied service releases its slot.
    const cancellationCalls: string[] = [];
    globalThis.fetch = async input => {
        cancellationCalls.push(String(input));
        await new Promise(resolve => setTimeout(resolve, 500));
        return new Response('{}');
    };
    const occupying = gatedFetch('https://fixture.invalid/occupying', { headers: { 'x-api-type': 'cancel-queue-fixture' } });
    const queuedAbort = new AbortController();
    const queuedCancelled = gatedFetch('https://fixture.invalid/queued-cancelled', { headers: { 'x-api-type': 'cancel-queue-fixture' }, signal: queuedAbort.signal });
    queuedAbort.abort();
    await assert.rejects(run(queuedCancelled), { name: 'AbortError' });
    await run(occupying);
    assert.deepEqual(cancellationCalls.map(url => url.split('/').at(-1)), ['occupying'], 'Aborted queued request never dispatches');
    results.queuedAbort = { dispatched: cancellationCalls.length };

    let retryCount = 0;
    const retryStart = clock;
    globalThis.fetch = async () => { retryCount++; return new Response('', { status: 429 }); };
    const exhausted = await run(gatedFetch('https://fixture.invalid/exhausted', { headers: { 'x-api-type': 'exhaustion-fixture' } }));
    results.retryExhaustion = { attempts: retryCount, status: exhausted.status, virtualDurationMs: clock - retryStart };
    assert.equal(retryCount, 5, 'Retries are finite');
    assert.equal(exhausted.status, 429);

    globalThis.fetch = async () => new Response('unavailable', { status: 503 });
    const person = { id: 'fixture-person', position: { x: 0, y: 0 }, data: { type: NodeType.PERSON, label: 'Fixture Person', isDisqualified: true, hasInsolvencyRecord: true, insolvencyCurrent: true } } as GraphNode;
    const checked = await run(enrichPersonNodes([person], config));
    results.failedRegisterRefresh = { before: person.data, after: checked[0].data };
    assert.equal(checked[0].data.isDisqualified, true, 'Failed refresh must preserve evidence');
    assert.equal(checked[0].data.hasInsolvencyRecord, true);
    assert.equal(checked[0].data.insolvencyCurrent, true);
    assert.equal(checked[0].data.disqualifiedCheck, 'unavailable');
    assert.equal(checked[0].data.insolvencyCheck, 'unavailable');

    const traversal: unknown[] = [];
    for (const slower of ['LEFT LIMITED', 'RIGHT LIMITED']) {
        const entity = (id: string, name: string) => ({ nzbn: id, entityName: name, entityStatusDescription: 'Registered', roles: [], 'company-details': { shareholding: { numberOfShares: 100, shareAllocation: [] } } });
        const entities: Record<string, unknown> = { '111': entity('111', 'ROOT LIMITED'), '222': entity('222', 'LEFT LIMITED'), '333': entity('333', 'RIGHT LIMITED'), '444': entity('444', 'SHARED LIMITED') };
        const names: Record<string, string> = { 'ROOT LIMITED': '111', 'LEFT LIMITED': '222', 'RIGHT LIMITED': '333', 'SHARED LIMITED': '444' };
        const holdings: Record<string, string[]> = { 'ROOT LIMITED': ['222', '333'], 'LEFT LIMITED': ['444'], 'RIGHT LIMITED': ['444'], 'SHARED LIMITED': [] };
        const requests: string[] = [];
        globalThis.fetch = async input => {
            const path = new URL(String(input), 'https://fixture.invalid').searchParams.get('path') || '';
            requests.push(path);
            const id = path.match(/\/entities\/(\d+)$/)?.[1];
            if (id && entities[id]) return new Response(JSON.stringify(entities[id]));
            const parsed = new URL(path, 'https://fixture.invalid');
            if (parsed.pathname.endsWith('/search')) {
                const name = (parsed.searchParams.get('name') || '').replaceAll('"', '');
                assert.ok(name in names, `Unexpected fixture name: ${name}`);
                await new Promise(resolve => setTimeout(resolve, name === slower ? 100 : 1));
                return new Response(JSON.stringify({ roles: holdings[name].length ? [{ roleType: 'OrganisationShareholder', name, nzbn: names[name], shareholdings: holdings[name].map(child => ({ associatedCompanyNzbn: child, associatedCompanyName: (entities[child] as any).entityName, sharePercentage: 50 })) }] : [] }));
            }
            throw new Error(`Unexpected fixture fetch: ${path}`);
        };
        const started = clock;
        const graph = await run(generateOrgChart('111', config));
        const edges = graph.edges.map(e => `${e.source}->${e.target}`).sort();
        const expected = ['111->222', '111->333', '222->444', '333->444'];
        assert.deepEqual(edges, expected, 'Keep both owners of the shared subsidiary');
        traversal.push({ slower, nodes: graph.nodes.map(n => n.id).sort(), edges, missingEdges: expected.filter(e => !edges.includes(e)), requestCount: requests.length, virtualDurationMs: clock - started });
    }
    results.diamondTraversal = traversal;
    original.log(JSON.stringify(results, null, 2));
} finally {
    globalThis.fetch = original.fetch; Date.now = original.now; globalThis.setTimeout = original.timer; globalThis.clearTimeout = original.clearTimer;
    console.log = original.log; console.warn = original.warn; console.error = original.error;
}
