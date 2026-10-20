import React, { useEffect, useState } from 'react';

type NameLookup = { name: string; current: boolean; status: 'ok' | 'unavailable'; count?: number };
type JdoResult =
    | { status: 'pending' }
    | { status: 'unavailable'; error?: string }
    | { status: 'ok' | 'partial'; names: NameLookup[]; count: number; capped: boolean; notes: string[];
        results: { title: string; url: string; matched: string[] }[]; checkedAt: number };

const JDO_HOME = 'https://www.justice.govt.nz/courts/decisions/jdo/';
const shown = (n: number | undefined) => n === undefined ? '—' : n >= 50 ? '50+' : String(n);

// Lists Judicial Decisions Online hits for the exact searched name (and, for a
// company, its former registered names) and links each one back to justice.govt.nz.
// Possible name matches only: never a finding.
export const JdoMatches: React.FC<{ name: string; kind?: 'person' | 'company'; nzbn?: string }> = ({ name, kind = 'person', nzbn }) => {
    const [state, setState] = useState<JdoResult>({ status: 'pending' });
    useEffect(() => {
        let active = true;
        setState({ status: 'pending' });
        const params = new URLSearchParams({ kind, name, ...(nzbn ? { nzbn } : {}) });
        fetch(`/api/jdo?${params}`)
            .then(r => r.json())
            .then(body => { if (active) setState(body?.status === 'ok' || body?.status === 'partial' ? body : { status: 'unavailable', error: body?.error }); })
            .catch(() => { if (active) setState({ status: 'unavailable' }); });
        return () => { active = false; };
    }, [name, kind, nzbn]);

    const done = state.status === 'ok' || state.status === 'partial' ? state : null;
    const several = !!done && done.names.length > 1;
    const label = (n: string) => done?.names.find(x => x.name === n)?.current ? n : `${n} (former name)`;
    const stamp = done ? new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(done.checkedAt) : null;

    return <div className="border border-rule" aria-live="polite">
        <div className="p-3 bg-paper2">
            {state.status === 'pending' && <p className="text-ink-mid text-sm" role="status">Searching Judicial Decisions Online for "{name}"…</p>}
            {state.status === 'unavailable' && <p className="text-ink-mid text-sm">Judicial Decisions Online lookup unavailable{state.error ? ` (${state.error})` : ''}. Do not treat this as no matches.</p>}
            {done && <>
                <p className="font-bold text-ink" style={{ fontSize: '13px' }}>
                    {done.count === 0 && !done.capped ? 'No published decisions returned' : `${done.capped ? '50+' : done.count} published decision${done.count === 1 ? '' : 's'}`}
                    {several ? ` containing the exact current or former name` : ` containing the exact phrase "${done.names[0].name}"`}
                </p>
                {several && <ul className="mt-1.5 mb-1.5" style={{ fontSize: '12px' }}>
                    {done.names.map(n => <li key={n.name} className="flex justify-between gap-3 text-ink-mid">
                        <span>"{n.name}"{n.current ? '' : ' · former name'}</span>
                        <span className="tabular-nums text-ink">{n.status === 'ok' ? shown(n.count) : 'unavailable'}</span>
                    </li>)}
                </ul>}
                <p className="text-ink-mid" style={{ fontSize: '12px' }}>
                    Possible name matches only. The phrase can appear anywhere in a decision, and a match does not confirm the same {kind === 'company' ? 'company' : 'person'} or a party.
                    {done.capped && ' JDO returns at most 50 results per name; only those are listed.'}
                </p>
                {done.notes.map(n => <p key={n} className="text-ink-mid mt-1" style={{ fontSize: '12px' }}>{n} Do not treat missing results as no matches.</p>)}
            </>}
        </div>
        {done && done.results.length > 0 && <details className="border-t border-rule">
            <summary className="px-3 py-2 cursor-pointer text-accent" style={{ fontSize: '12.5px' }}>
                Show {done.results.length} decision{done.results.length === 1 ? '' : 's'}
            </summary>
            <ol className="divide-y divide-rule border-t border-rule">
                {done.results.map(r => <li key={r.url} className="px-3 py-2" style={{ fontSize: '12.5px' }}>
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-ink hover:text-accent underline decoration-rule underline-offset-2">{r.title}</a>
                    {several && <p className="text-ink-pale mt-0.5" style={{ fontSize: '11px' }}>Matched: {r.matched.map(label).join(' · ')}</p>}
                </li>)}
            </ol>
        </details>}
        <p className="px-3 py-2 border-t border-rule text-ink-pale" style={{ fontSize: '11px' }}>
            Source: <a href={JDO_HOME} target="_blank" rel="noreferrer" className="underline">Judicial Decisions Online</a>, Ministry of Justice. Published decisions only: suppressed and unpublished decisions are not included, and District Court decisions are a selection.
            {' '}{kind === 'company' ? 'Names are searched with both "Limited" and "Ltd".' : 'Other forms of the name (initials, surname first, middle names) are not searched.'}
            {stamp && ` Checked ${stamp}.`}
        </p>
    </div>;
};
