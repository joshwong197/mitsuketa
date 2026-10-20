import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from '../mcp/lib/rateLimit.js';
import { resolveApiKey } from '../mcp/lib/keys.js';

// One Judicial Decisions Online lookup per user search (one query per name for
// companies with former names). Returns hit counts and decision titles with
// links back to justice.govt.nz; no judgment text is fetched, stored or served here.
const JDO_ORIGIN = 'https://www.justice.govt.nz';
const JDO_LIMIT_PER_MINUTE = 30;
// JDO returns at most 50 results and no further pages, so 50 means "50 or more".
export const JDO_RESULT_CAP = 50;
// ponytail: caps JDO calls per company search; raise if long rename histories get cut.
const MAX_FORMER_NAMES = 5;

type Hit = { title: string; url: string };
export type NameLookup = { name: string; current: boolean; phrases: string[] } & (
    { status: 'ok'; count: number; results: Hit[] } | { status: 'unavailable' });

/** Collapse whitespace and drop quotes; null if the name can't be searched safely. */
export function jdoPhrase(name: unknown): string | null {
    if (typeof name !== 'string') return null;
    const phrase = name.replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
    // Needs two words: a lone surname would match unrelated people.
    if (phrase.length < 3 || phrase.length > 120 || !phrase.includes(' ')) return null;
    return phrase;
}

const companyBase = (phrase: string) => phrase.match(/^(.+?)\s+(?:limited|ltd\.?)$/i)?.[1];

/** Exact phrases to search. Companies get both suffix spellings judgments use. */
export function jdoPhrases(phrase: string, kind: unknown): string[] {
    const base = kind === 'company' ? companyBase(phrase) : undefined;
    return base ? [`${base} Limited`, `${base} Ltd`] : [phrase];
}

// Quoted phrases go in JDO's full-text field, which matches them exactly:
// "Ritesh Mani" will not match "Suni Mani", or "Ritesh" and "Mani" apart.
// The case-name field would miss most people, who appear as surname only ("MANI v ...").
// JDO treats OR between quoted phrases as a union.
export function jdoSearchUrl(phrases: string[]) {
    const p = new URLSearchParams({
        court: 'All', location: 'All', judge: '', counsel: '', caseName: '', fileNumber: '', citation: '',
        judgmentDate: '', minuteReference: '', searchTerms: phrases.map(x => `"${x}"`).join(' OR '), page: '1', sort: 'judgmentdate desc',
    });
    return `${JDO_ORIGIN}/jdo-search-api/?${p}`;
}

/** Judgment date from the title's trailing "[12 August 2026]" or "29 September 2010"; 0 if absent. */
export function judgmentTime(title: string) {
    const m = title.match(/(\d{1,2} [A-Za-z]+ \d{4})\]?\s*$/);
    return m ? Date.parse(m[1]) || 0 : 0;
}

/** Union of per-name hits, each tagged with every name that matched it, newest first. */
export function mergeLookups(lookups: NameLookup[]) {
    const byUrl = new Map<string, Hit & { matched: string[] }>();
    for (const l of lookups) if (l.status === 'ok') for (const r of l.results) {
        const hit = byUrl.get(r.url) ?? { ...r, matched: [] };
        hit.matched.push(l.name);
        byUrl.set(r.url, hit);
    }
    const results = [...byUrl.values()].sort((a, b) => judgmentTime(b.title) - judgmentTime(a.title));
    const capped = lookups.some(l => l.status === 'ok' && l.count >= JDO_RESULT_CAP);
    return { results, count: results.length, capped };
}

async function searchName(name: string, current: boolean, kind: unknown): Promise<NameLookup> {
    const phrases = jdoPhrases(name, kind);
    try {
        const response = await fetch(jdoSearchUrl(phrases), { signal: AbortSignal.timeout(8000) });
        const data = response.ok ? await response.json() : null;
        if (typeof data?.count !== 'number' || !Array.isArray(data.results)) return { name, current, phrases, status: 'unavailable' };
        const results = data.results
            .filter((r: any) => typeof r?.caseName === 'string' && /^\/jdo_documents\/[\w.-]+\.pdf$/i.test(r?.url))
            .map((r: any) => ({ title: r.caseName.replace(/_x000b_/g, ' ').replace(/\s+/g, ' ').trim(), url: JDO_ORIGIN + r.url }));
        return { name, current, phrases, status: 'ok', count: data.count, results };
    } catch (err) {
        console.error('JDO lookup error:', err);
        return { name, current, phrases, status: 'unavailable' };
    }
}

/** Former registered names from the NZBN register; null if the register could not be read. */
async function formerNames(nzbn: string, current: string): Promise<string[] | null> {
    try {
        const r = await fetch(`https://api.business.govt.nz/gateway/nzbn/v5/entities/${nzbn}/history/entity-names`, {
            headers: { 'Ocp-Apim-Subscription-Key': resolveApiKey('nzbn'), Accept: 'application/json' },
            signal: AbortSignal.timeout(8000),
        });
        const rows = r.ok ? await r.json() : null;
        if (!Array.isArray(rows)) return null;
        const key = (n: string) => (companyBase(n) ?? n).toLowerCase();
        const seen = new Set([key(current)]);
        const names: string[] = [];
        for (const row of rows) {
            const n = jdoPhrase(row?.entityName ?? row?.name);
            if (n && !seen.has(key(n))) { seen.add(key(n)); names.push(n); }
        }
        return names.slice(0, MAX_FORMER_NAMES);
    } catch {
        return null;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const clientIp = (req.headers['x-forwarded-for'] as string) || 'anonymous';
    const rl = checkRateLimit(clientIp, 'jdo', JDO_LIMIT_PER_MINUTE);
    if (!rl.allowed) {
        res.setHeader('Retry-After', '60');
        return res.status(429).json({ status: 'unavailable', error: 'Rate limit exceeded' });
    }

    const kind = req.query.kind === 'company' ? 'company' : 'person';
    const name = jdoPhrase(req.query.name);
    if (!name) return res.status(400).json({ status: 'unavailable', error: 'Enter a full name of two or more words' });
    const nzbn = typeof req.query.nzbn === 'string' && /^\d{13}$/.test(req.query.nzbn) ? req.query.nzbn : null;

    const former = kind === 'company' && nzbn ? await formerNames(nzbn, name) : [];
    const lookups = await Promise.all([searchName(name, true, kind), ...(former ?? []).map(n => searchName(n, false, kind))]);
    if (lookups.every(l => l.status === 'unavailable')) return res.status(502).json({ status: 'unavailable', error: 'JDO could not be reached' });

    const notes: string[] = [];
    if (former === null) notes.push('Former names could not be retrieved from the register; only the current name was searched.');
    if (lookups.some(l => l.status === 'unavailable')) notes.push('Some names could not be searched.');
    res.setHeader('Cache-Control', 'private, max-age=600');
    return res.status(200).json({
        status: notes.length ? 'partial' : 'ok',
        names: lookups.map(({ results: _r, ...l }: any) => l),
        ...mergeLookups(lookups), notes, checkedAt: Date.now(),
    });
}
