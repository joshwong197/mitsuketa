import React, { createContext, lazy, Suspense, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Analytics } from '@vercel/analytics/react';
import type { ApiConfig, EntitySearchResultItem, PersonCompanyResult } from '../types';
import { fetchEntityDetails, fetchRolesByEntityName, searchEntitiesDeep } from '../services/apiService';
import { searchByPersonName } from '../services/directorSearchService';
import { cachedEntityProfile, rememberEntityProfile, type EntityProfile } from '../services/entityProfile';
import { loadEntityRecord } from '../services/entityRecordService';
import { holdings, ultimateOwners, type UltimateOwner } from '../services/ownership';
import type { TitleReport } from '../services/propertyService';
import { getSession, subscribe } from '../utils/propertySession';
import { isActivePersonCompany } from '../utils/personCompanyStatus';
import { insolvencyLinkedSummary, timingLabel } from '../utils/insolvencyTiming';
import { enrichCompanyResults } from '../src/api/companyStatusApi';
import { searchDisqualifiedDirectors, type DisqualifiedDirector } from '../src/api/disqualifiedDirectorsApi';
import { formatBirth, isInsolvencyRecordCurrent, searchInsolvency, type InsolvencyRecord } from '../src/api/insolvencyApi';
import { diffSnapshot, loadNotes, loadPins, loadRecent, pushRecent, saveNotes, savePins, type MobileKey, type Pin, type Snapshot } from '../utils/mobileStore';
import { EntityRecord, registerDate } from './EntityRecord';
import './mobile.css';

// Phone layout (below 768px, chosen in index.tsx). Built for quick company
// checks: one screen per company or person, each with its own #/m/ address,
// so the browser's back gesture and shared links work. Property search reuses
// the desktop PropertyScreen, which owns sign-in, approval and audit.
const PropertyScreen = lazy(() => import('./PropertyScreen').then(m => ({ default: m.PropertyScreen })));
const PropertyReport = lazy(() => import('./PropertyReport'));

type Kind = 'company' | 'person' | 'address';
type Route =
    | { v: 'search'; kind: Kind; q: string }
    | { v: 'company' | 'record'; nzbn: string }
    | { v: 'person'; name: string }
    | { v: 'title' | 'pinned' | 'recent' };

const KINDS: [Kind, string, string][] = [['company', '社', 'Company'], ['person', '人', 'Person'], ['address', '地', 'Address']];
const enc = encodeURIComponent;
export function toHash(r: Route): string {
    switch (r.v) {
        case 'search': return `#/m/search/${r.kind}${r.q ? `/${enc(r.q)}` : ''}`;
        case 'company': return `#/m/company/${r.nzbn}`;
        case 'record': return `#/m/company/${r.nzbn}/record`;
        case 'person': return `#/m/person/${enc(r.name)}`;
        default: return `#/m/${r.v}`;
    }
}
export function parseHash(hash: string): Route {
    const [, m, v, a = '', b = ''] = hash.split('/');
    const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
    if (m === 'm') {
        if (v === 'company' && /^\d{13}$/.test(a)) return b === 'record' ? { v: 'record', nzbn: a } : { v: 'company', nzbn: a };
        if (v === 'person' && a) return { v: 'person', name: dec(a) };
        if (v === 'title' || v === 'pinned' || v === 'recent') return { v };
        if (v === 'search' && KINDS.some(k => k[0] === a)) return { v: 'search', kind: a as Kind, q: dec(b) };
    }
    return { v: 'search', kind: 'company', q: '' };
}

// User API keys are no longer editable; empty keys fall back to org keys server-side.
const config: ApiConfig = (() => { try { return JSON.parse(localStorage.getItem('mitsuketa_config') || 'null'); } catch { return null; } })()
    || { nzbnKey: '', companiesKey: '', disqualifiedDirectorsKey: '', insolvencyKey: '' };
const loadProfile = async (nzbn: string) => cachedEntityProfile(nzbn) || rememberEntityProfile(await fetchEntityDetails(nzbn, config));
const personCache = new Map<string, Promise<PersonCompanyResult[]>>();
function loadPerson(name: string, fresh = false) {
    const k = name.toLowerCase();
    if (fresh || !personCache.has(k)) personCache.set(k, searchByPersonName(name, config.companiesKey).catch(e => { personCache.delete(k); throw e; }));
    return personCache.get(k)!;
}
let lastReport: TitleReport | null = null; // title reports need a matter reference, so they live in memory, not the URL

const directors = (p: EntityProfile) => p.roles.filter(r => !r.historical && /director/i.test(r.role));
const companySnap = (p: EntityProfile): Snapshot => ({
    status: p.status, directors: directors(p).map(r => r.name).sort(),
    holders: Object.fromEntries(holdings(p).map(h => [h.names.join(' & '), h.pct === null ? null : Math.round(h.pct * 10) / 10])),
});
// Built from the role search alone (not enrichment), so a pin compares like with like.
const personSnap = (rs: PersonCompanyResult[]): Snapshot => ({ roles: rs.filter(r => !r.isInactive).map(r => `${r.companyName} · ${r.roleType}`).sort() });
const enriched = new Map<string, PersonCompanyResult[]>(); // name → results with company status flags
async function snapFor(key: MobileKey): Promise<Snapshot> {
    const id = key.slice(2);
    return key.startsWith('c:') ? companySnap(rememberEntityProfile(await fetchEntityDetails(id, config))) : personSnap(await loadPerson(id, true));
}

const pct = (n: number | null) => n === null ? '' : n > 0 && n < 0.1 ? '<0.1%' : `${Math.round(n * 10) / 10}%`;
const tone = (s = '') => /liquidat|receiver|administration|statutory/i.test(s) ? 'bad' : /^registered$/i.test(s.trim()) ? 'ok' : 'faded';
const personStatus = (r: PersonCompanyResult) => r.externalAdminType || r.entityStatusDescription || r.status;

// Register marks, same glyphs, tones and order as desktop (PersonSearchResults):
// 紅 insolvency, 琥 removal in progress (still stoppable), 消 removed.
type Stamp = { glyph: string; tone: 'crit' | 'amber' | 'wash' | 'green'; label: string };
const ADMIN = /liquidat|receiver|administration|statutory/i;
const DEAD = /removed|struck|deregister|dissolv|deleted|amalgamat|closed|inactive/i;
function stampsFor(c: { status?: string; inAdmin?: boolean; removed?: boolean; previous?: string; removalCommenced?: boolean }): Stamp[] {
    const s: Stamp[] = [];
    if (c.inAdmin) s.push({ glyph: '紅', tone: 'crit', label: c.status || 'External administration' });
    if (c.previous) s.push({ glyph: '紅', tone: 'crit', label: `Previously in ${c.previous.replace(/^in\s+/i, '')}` });
    if (c.removalCommenced && !c.removed) s.push({ glyph: '琥', tone: 'amber', label: 'Removal in progress' });
    if (c.removed) s.push({ glyph: '消', tone: 'wash', label: 'Removed from the register' });
    return s;
}
const roleStamps = (r: PersonCompanyResult) => {
    const removed = r.entityStatusDescription ? /removed/i.test(r.entityStatusDescription) || /^inactive$/i.test(r.entityStatusDescription) : (r.entityStatusCode || 0) >= 80;
    return stampsFor({ status: r.externalAdminType || r.entityStatusDescription, inAdmin: r.isInExternalAdmin, removed,
        previous: removed && r.hasHistoricInsolvency ? r.historicInsolvencyType || 'Insolvency' : undefined, removalCommenced: r.removalCommenced });
};
const profileStamps = (p: EntityProfile) => {
    const inAdmin = ADMIN.test(p.status);
    const past = p.insolvencies.filter((_, i) => !(inAdmin && i === 0));
    return stampsFor({ status: p.status, inAdmin, removed: DEAD.test(p.status), previous: past[0]?.type, removalCommenced: p.removalCommenced });
};
const Stamps: React.FC<{ s: Stamp[]; labels?: boolean; big?: boolean }> = ({ s, labels, big }) => s.length ? <span className={`m-stamps${big ? ' m-big' : ''}`}>
    {s.map((x, i) => <span key={i} className={`m-stamp m-st-${x.tone}`} title={x.label} aria-hidden="true">{x.glyph}</span>)}
    {labels ? <span className={`m-stamp-text m-st-text-${s[0].tone}`}>{s.filter(x => x.tone !== 'wash' || s.length === 1).map(x => x.label).join(' · ')}</span>
        : <span className="m-sr">{s.map(x => x.label).join(', ')}</span>}
</span> : null;

interface Ctx {
    nav: (r: Route, replace?: boolean) => void;
    pins: Pin[]; togglePin: (key: MobileKey, name: string, snap: Snapshot) => void; markSeen: (key: MobileKey, snap: Snapshot) => void;
    notes: Record<string, string>; openNote: (key: MobileKey, name: string) => void;
    visit: (key: MobileKey, name: string, sub: string) => void; recent: ReturnType<typeof loadRecent>;
    setTitle: (t: string) => void; flash: (msg: string) => void;
}
const M = createContext<Ctx>(null!);
const useM = () => useContext(M);

export default function MobileApp() {
    const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
    const [pins, setPins] = useState(loadPins);
    const [notes, setNotes] = useState(loadNotes);
    const [recent, setRecent] = useState(loadRecent);
    const [title, setTitle] = useState('');
    const [note, setNote] = useState<{ key: MobileKey; name: string; text: string } | null>(null);
    const [toast, setToast] = useState('');
    const depth = useRef(0);
    const screen = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!window.location.hash.startsWith('#/m/')) history.replaceState(null, '', toHash(route));
        const onPop = () => { depth.current = Math.max(0, depth.current - 1); setRoute(parseHash(window.location.hash)); };
        window.addEventListener('popstate', onPop);
        // Same theme choice as desktop.
        const saved = localStorage.getItem('mitsuketa_theme');
        const theme = saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        document.documentElement.classList.toggle('dark', theme === 'dark');
        return () => window.removeEventListener('popstate', onPop);
    }, []);
    useEffect(() => { screen.current?.scrollTo(0, 0); setTitle(''); }, [route]);
    useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); }, [toast]);

    const nav = (r: Route, replace = false) => {
        if (replace) history.replaceState(null, '', toHash(r));
        else { history.pushState(null, '', toHash(r)); depth.current++; }
        setRoute(r);
    };
    const back = () => depth.current > 0 ? history.back() : nav({ v: 'search', kind: 'company', q: '' }, true);
    const updatePins = (f: (p: Pin[]) => Pin[]) => setPins(prev => { const next = f(prev); savePins(next); return next; });
    const ctx: Ctx = {
        nav, pins, notes, recent, setTitle, flash: setToast,
        togglePin: (key, name, snap) => updatePins(p => p.some(x => x.key === key) ? p.filter(x => x.key !== key) : [...p, { key, name, pinnedAt: new Date().toISOString(), snap }]),
        markSeen: (key, snap) => updatePins(p => p.map(x => x.key === key ? { ...x, snap, pinnedAt: new Date().toISOString() } : x)),
        openNote: (key, name) => setNote({ key, name, text: notes[key] || '' }),
        visit: (key, name, sub) => setRecent(pushRecent({ key, name, sub })),
    };
    const isRoot = route.v === 'search' || route.v === 'pinned' || route.v === 'recent';
    const tab = route.v === 'pinned' || route.v === 'recent' ? route.v : 'search';
    const share = async () => {
        const url = window.location.href;
        try {
            if (navigator.share) await navigator.share({ title: title || 'Mitsuketa', url });
            else { await navigator.clipboard.writeText(url); setToast('Link copied'); }
        } catch { /* share sheet dismissed */ }
    };

    return <M.Provider value={ctx}>
        <div className="m-app">
            <header className="m-appbar">
                {isRoot
                    ? <span className="m-brand"><span className="m-mark" aria-hidden="true">見</span><span>Mitsuketa</span></span>
                    : <><button className="m-icon" onClick={back} aria-label="Back">‹</button><span className="m-title">{title}</span>
                        {route.v !== 'title' && <button className="m-icon m-share" onClick={share} aria-label="Share link">⇪</button>}</>}
            </header>
            <main className="m-screen" ref={screen}>
                {route.v === 'search' && <SearchScreen kind={route.kind} q={route.q} />}
                {route.v === 'company' && <CompanyScreen key={route.nzbn} nzbn={route.nzbn} />}
                {route.v === 'record' && <RecordScreen key={route.nzbn} nzbn={route.nzbn} />}
                {route.v === 'person' && <PersonScreen key={route.name} name={route.name} />}
                {route.v === 'title' && <TitleScreen />}
                {route.v === 'pinned' && <PinnedScreen />}
                {route.v === 'recent' && <RecentScreen />}
            </main>
            <nav className="m-tabs" aria-label="Main">
                {([['search', '探', 'Search'], ['pinned', '留', 'Pinned'], ['recent', '歴', 'Recent']] as const).map(([v, k, label]) =>
                    <button key={v} aria-current={tab === v} onClick={() => nav(v === 'search' ? { v, kind: 'company', q: '' } : { v })}>
                        <span className="m-k" aria-hidden="true">{k}</span>{label}{v === 'pinned' && pins.length > 0 && <span className="m-count">{pins.length}</span>}
                    </button>)}
            </nav>
            {note && <>
                <div className="m-scrim" onClick={() => setNote(null)} />
                <div className="m-sheet" role="dialog" aria-modal="true" aria-label={`Note on ${note.name}`}>
                    <h3>Note · {note.name}</h3>
                    <textarea id="m-note" autoFocus value={note.text} onChange={e => setNote({ ...note, text: e.target.value })} />
                    <p>Kept on this phone. It shows on the record and in Pinned.</p>
                    <button className="m-btn" onClick={() => {
                        const next = { ...notes }; if (note.text.trim()) next[note.key] = note.text.trim(); else delete next[note.key];
                        setNotes(next); saveNotes(next); setNote(null);
                    }}>Save note</button>
                </div>
            </>}
            {toast && <div className="m-toast" role="status">{toast}</div>}
        </div>
        <Analytics />
    </M.Provider>;
}

const Row: React.FC<{ k: string; title: string; sub?: string; right?: React.ReactNode; onClick?: () => void; warn?: boolean; stamps?: Stamp[]; note?: string }> = ({ k, title, sub, right, onClick, warn, stamps = [], note }) => {
    const struck = stamps.some(s => s.tone === 'wash') && !stamps.some(s => s.tone === 'crit');
    const body = <><span className="m-rk" aria-hidden="true">{k}</span><span className="m-rb"><span className={`m-rt${struck ? ' m-struck' : ''}`}>{title}</span>{sub && <span className={`m-rs${warn ? ' m-warn' : ''}`}>{sub}</span>}
        <Stamps s={stamps} labels={stamps.some(s => s.tone !== 'wash')} />{note && <span className="m-rs m-warn">{note}</span>}</span>
        {right && <span className="m-rr">{right}</span>}{onClick && <span className="m-chev" aria-hidden="true">›</span>}</>;
    return onClick ? <button className="m-row" onClick={onClick}>{body}</button> : <div className="m-row">{body}</div>;
};
const Section = ({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) =>
    <section className="m-sec"><h2>{title}{aside !== undefined && <span>{aside}</span>}</h2>{children}</section>;
const Loading = ({ text }: { text: string }) => <p className="m-meta m-loading">{text}</p>;

function Actions({ k, name, snap }: { k: MobileKey; name: string; snap: Snapshot | null }) {
    const { pins, togglePin, notes, openNote } = useM();
    const on = pins.some(p => p.key === k);
    return <div className="m-actions">
        <button aria-pressed={on} disabled={!snap} onClick={() => snap && togglePin(k, name, snap)}><span aria-hidden="true">{on ? '★' : '☆'}</span>{on ? 'Pinned' : 'Pin'}</button>
        <button onClick={() => openNote(k, name)}><span aria-hidden="true">✎</span>{notes[k] ? 'Edit note' : 'Note'}</button>
        <button onClick={() => window.print()}><span aria-hidden="true">⎙</span>Save PDF</button>
    </div>;
}
function NoteAndChanges({ k, snap }: { k: MobileKey; snap: Snapshot | null }) {
    const { pins, notes, markSeen } = useM();
    const pin = pins.find(p => p.key === k);
    const changes = pin && snap ? diffSnapshot(pin.snap, snap) : [];
    return <>
        {changes.length > 0 && <div className="m-flag"><b>Changed since you pinned it on {registerDate(pin!.pinnedAt)}</b>
            <ul>{changes.map(c => <li key={c}>{c}</li>)}</ul>
            <button className="m-link" onClick={() => markSeen(k, snap!)}>Mark as seen</button></div>}
        {notes[k] && <div className="m-note"><span aria-hidden="true">✎</span> {notes[k]}</div>}
    </>;
}

function SearchScreen({ kind, q }: { kind: Kind; q: string }) {
    const { nav, recent } = useM();
    const session = useSyncExternalStore(subscribe, getSession, () => null);
    const [text, setText] = useState(q);
    const [res, setRes] = useState<{ loading?: boolean; error?: string; items?: EntitySearchResultItem[] }>({});
    useEffect(() => {
        setText(q); setRes({});
        if (kind !== 'company' || !q) return;
        let off = false;
        setRes({ loading: true });
        searchEntitiesDeep(q, config, undefined, 2)
            .then(r => !off && setRes({ items: r.items }))
            .catch(() => !off && setRes({ error: 'The Companies Register did not answer. Try again in a moment.' }));
        return () => { off = true; };
    }, [kind, q]);
    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const t = text.trim(); if (!t) return;
        (document.activeElement as HTMLElement | null)?.blur();
        if (kind === 'person') nav({ v: 'person', name: t });
        else nav({ v: 'search', kind, q: t }, true);
    };
    return <div className="m-pg">
        {!q && kind !== 'address' && <p className="m-hero">Who's behind it?<small>Check a company or a person. Address search is for registered users.</small></p>}
        <div className="m-seg" role="group" aria-label="Search for">
            {KINDS.map(([k, kj, label]) => <button key={k} aria-pressed={kind === k} onClick={() => nav({ v: 'search', kind: k, q: k === 'address' ? '' : text.trim() }, true)}>
                <span className="m-k" aria-hidden="true">{kj}</span>{label}{k === 'address' && !session && <span className="m-lock" aria-label="locked">🔒</span>}
            </button>)}
        </div>
        {kind === 'address' ? <>
            <div className="m-property"><Suspense fallback={<Loading text="Loading property search…" />}>
                <PropertyScreen onOpenReport={report => { lastReport = report; nav({ v: 'title' }); }} />
            </Suspense></div>
        </> : <>
            <form className="m-search" onSubmit={submit} role="search">
                <span className="m-k" aria-hidden="true">{kind === 'company' ? '社' : '人'}</span>
                <input id="m-q" type="search" enterKeyHint="search" value={text} onChange={e => setText(e.target.value)} autoComplete="off"
                    placeholder={kind === 'company' ? 'Company name or NZBN' : 'Full name, e.g. Jane Smith'} aria-label={kind === 'company' ? 'Company name or NZBN' : 'Person\'s name'} />
                <button type="submit" disabled={!text.trim()}>Search</button>
            </form>
            {res.loading && <Loading text="Searching the Companies Register…" />}
            {res.error && <p className="m-error" role="alert">{res.error}</p>}
            {res.items && (res.items.length
                ? <Section title="Companies and entities" aside={res.items.length}>
                    <div className="m-list">{res.items.map(i => <Row key={i.nzbn} k="社" title={i.entityName} sub={ADMIN.test(i.entityStatusDescription) ? `NZBN ${i.nzbn}` : `${i.entityStatusDescription} · NZBN ${i.nzbn}`}
                        stamps={stampsFor({ status: i.entityStatusDescription, inAdmin: ADMIN.test(i.entityStatusDescription), removed: DEAD.test(i.entityStatusDescription) })} onClick={() => nav({ v: 'company', nzbn: i.nzbn })} />)}</div>
                </Section>
                : <p className="m-meta">No companies match “{q}”. Check the spelling, or try the NZBN.</p>)}
            {!q && recent.length > 0 && <Section title="Recent" aside={recent.length}><RecentList limit={5} /></Section>}
        </>}
    </div>;
}

const CompanyScreen: React.FC<{ nzbn: string }> = ({ nzbn }) => {
    const { nav, setTitle, visit } = useM();
    const [p, setP] = useState<EntityProfile | null>(() => cachedEntityProfile(nzbn));
    const [error, setError] = useState('');
    const [owners, setOwners] = useState<UltimateOwner[] | null>(null);
    const [owns, setOwns] = useState<{ name: string; nzbn: string; pct: number | null; former: boolean }[] | null>(null);
    useEffect(() => {
        let off = false;
        loadProfile(nzbn).then(profile => {
            if (off) return;
            setP(profile); setTitle(profile.name);
            visit(`c:${nzbn}`, profile.name, `${profile.status} · NZBN ${nzbn}`);
            ultimateOwners(profile, loadProfile).then(o => !off && setOwners(o)).catch(() => !off && setOwners([]));
            fetchRolesByEntityName(profile.name, config).then(r => {
                if (off) return;
                // Same matching as the desktop crawl: the role search is fuzzy, so keep only
                // organisation-shareholder roles that are this entity, then read their holdings.
                const norm = (n: string) => n.toUpperCase().replace(/\bLTD\.?\b/g, 'LIMITED').replace(/\bCO\.?\b/g, 'COMPANY').replace(/[^A-Z0-9]/g, '');
                const ended = (v: any) => [v?.endDate, v?.resignationDate, v?.cessationDate].some(d => d && Date.parse(d) <= Date.now()) || /^(inactive|ceased|resigned|historic|historical)$/i.test(v?.status || '');
                const seen = new Set<string>();
                setOwns((r.roles || [])
                    .filter(x => /Shareholder/.test(x.roleType || '') && !/Individual|Director/.test(x.roleType || '')
                        && ((x.nzbn && x.nzbn === nzbn) || norm(x.name || '') === norm(profile.name)))
                    .flatMap(x => (x.shareholdings || []).map(h => ({ ...h, former: ended(x) || ended(h) })))
                    .filter(h => h.associatedCompanyNzbn && h.associatedCompanyNzbn !== nzbn && !seen.has(h.associatedCompanyNzbn) && !!seen.add(h.associatedCompanyNzbn))
                    .map(h => ({ name: h.associatedCompanyName || h.associatedCompanyNzbn!, nzbn: h.associatedCompanyNzbn!, pct: h.sharePercentage ?? null, former: h.former }))
                    .sort((a, b) => Number(a.former) - Number(b.former)));
            }).catch(() => !off && setOwns([]));
        }).catch(() => !off && setError('This record could not be loaded from the register. Check your connection and try again.'));
        return () => { off = true; };
    }, [nzbn]);
    if (error) return <div className="m-pg"><p className="m-error" role="alert">{error}</p></div>;
    if (!p) return <div className="m-pg"><Loading text="Loading the register record…" /></div>;

    const snap = companySnap(p);
    const direct = holdings(p);
    const current = ADMIN.test(p.status) ? p.insolvencies[0] : undefined;
    const past = p.insolvencies.filter(i => i !== current);
    const stamps = profileStamps(p);
    const top = owners?.[0];
    const widelyHeld = p.extensive || p.allocations.length > 40;
    const openHolder = (h: { nzbn: string; names: string[] }) => h.nzbn ? nav({ v: 'company', nzbn: h.nzbn }) : h.names.length === 1 ? nav({ v: 'person', name: h.names[0] }) : undefined;
    const dirs = directors(p);
    return <div className="m-pg">
        <div className="m-head"><span className="m-badge" aria-hidden="true">社</span><div>
            <h1 className="m-name">{p.name}</h1>
            {stamps.length ? <Stamps s={stamps} labels big /> : <span className={`m-pill m-${tone(p.status)}`}>{p.status || 'Status not supplied'}</span>}
            <p className="m-meta">NZBN {p.nzbn}{p.number && ` · No. ${p.number}`} · Registered {registerDate(p.registered)}</p>
            {p.type && <p className="m-meta">{p.type}</p>}
        </div></div>
        <Actions k={`c:${nzbn}`} name={p.name} snap={snap} />
        <NoteAndChanges k={`c:${nzbn}`} snap={snap} />
        {current && <div className="m-flag m-crit"><b>{current.type}</b> since {registerDate(current.commenced)}
            {current.appointees.filter(a => !a.vacated).length > 0 && <> · {current.appointees.filter(a => !a.vacated).map(a => a.name || a.organisation).join(', ')}</>}</div>}
        {!current && ADMIN.test(p.status) && <div className="m-flag m-crit"><b>{p.status}</b></div>}
        {p.removalCommenced && !DEAD.test(p.status) && <div className="m-flag"><b>Removal from the register has started.</b> It can still be stopped until the company is removed.</div>}
        {past.length > 0 && <div className="m-flag m-crit"><b>Insolvency history</b>
            <ul>{past.map((i, n) => <li key={n}>{i.type}, commenced {registerDate(i.commenced)}{i.appointees[0] && ` · ${i.appointees.map(a => a.name || a.organisation).filter(Boolean).join(', ')}`}</li>)}</ul></div>}

        {!p.shareholdingSupplied ? <p className="m-meta">The register holds no shareholding for this kind of entity.</p>
            : widelyHeld ? <Section title="Shareholders" aside={`widely held · ${p.allocations.length} allocations`}>
                <div className="m-list">{direct.slice(0, 8).map((h, i) => <Row key={i} k={h.nzbn ? '社' : '人'} title={h.names.join(' & ')} right={pct(h.pct)} onClick={h.nzbn || h.names.length === 1 ? () => openHolder(h) : undefined} />)}</div>
            </Section>
            : <Section title="Who's behind it" aside="ultimate owners">
                {!owners ? <Loading text="Following the shareholdings up the register…" /> : !owners.length ? <p className="m-meta">No shareholders on the register.</p> :
                    <div>{owners.map((o, i) => <button key={i} className="m-owner" onClick={() => openHolder(o)} disabled={!o.nzbn && o.names.length > 1}>
                        <span className="m-ot">{o.names.join(' & ')}</span><span className="m-op">{pct(o.pct)}</span>
                        <span className="m-os">{o.end === 'unresolved' ? 'Not followed further' : o.end === 'widely-held' ? `Widely held company${o.via.length ? ` · via ${o.via.map(h => h.name).join(' → ')}` : ''}` : o.via.length ? `via ${o.via.map(h => h.name).join(' → ')}` : 'holds directly'}</span>
                        <span className="m-bar"><i style={{ width: `${Math.min(100, o.pct ?? 0)}%` }} /></span>
                    </button>)}</div>}
            </Section>}

        {top && top.via.length > 0 && <Section title="Ownership chain" aside="largest owner">
            <div className="m-chain">
                <div className="m-link m-here"><i /><span>{p.name}</span><small>this company</small></div>
                {top.via.map(h => <React.Fragment key={h.nzbn}><div className="m-edge"><i /><span>owned by</span></div>
                    <button className="m-link" onClick={() => nav({ v: 'company', nzbn: h.nzbn })}><i /><span>{h.name}</span><small>›</small></button></React.Fragment>)}
                <div className="m-edge"><i /><span>owned by</span></div>
                <button className="m-link m-person" onClick={() => openHolder(top)}><i /><span>{top.names.join(' & ')}</span><small>{pct(top.pct)} ›</small></button>
            </div>
        </Section>}

        {!widelyHeld && direct.some(h => h.nzbn) && <Section title="Direct shareholders" aside={direct.length}>
            <div className="m-list">{direct.map((h, i) => <Row key={i} k={h.nzbn ? '社' : '人'} title={h.names.join(' & ')} right={pct(h.pct)} onClick={h.nzbn || h.names.length === 1 ? () => openHolder(h) : undefined} />)}</div>
        </Section>}

        <Section title="Directors" aside={dirs.length}>
            {dirs.length ? <div className="m-list">{dirs.map((d, i) => <Row key={i} k="人" title={d.name} sub={`${d.role} since ${registerDate(d.startDate)}`} onClick={d.name ? () => nav({ v: 'person', name: d.name }) : undefined} />)}</div>
                : <p className="m-meta">No current directors on the register.</p>}
        </Section>

        <Section title="Shareholder in" aside={owns ? `${owns.filter(o => !o.former).length} current${owns.some(o => o.former) ? `, ${owns.filter(o => o.former).length} former` : ''}` : '…'}>
            {!owns ? <Loading text="Checking which companies it holds shares in…" /> : owns.length
                ? <div className="m-list">{owns.map(o => <Row key={o.nzbn} k="社" title={o.name} sub={o.former ? 'Former shareholding' : undefined} right={o.pct ? pct(o.pct) : undefined} onClick={() => nav({ v: 'company', nzbn: o.nzbn })} />)}</div>
                : <p className="m-meta">Not a shareholder in any other company.</p>}
        </Section>

        <button className="m-btn m-ghost" onClick={() => nav({ v: 'record', nzbn })}>Full register record ›</button>
    </div>;
};

const RecordScreen: React.FC<{ nzbn: string }> = ({ nzbn }) => {
    const { setTitle } = useM();
    const [p, setP] = useState<EntityProfile | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let off = false;
        loadEntityRecord(nzbn, config, false, x => { if (!off) { setP(x); setTitle(x.name); } })
            .then(x => { if (!off) { setP(x); setTitle(x.name); } })
            .catch(() => !off && setError('This record could not be loaded from the register.'));
        return () => { off = true; };
    }, [nzbn]);
    if (error) return <div className="m-pg"><p className="m-error" role="alert">{error}</p></div>;
    return <div className="m-record">{p ? <EntityRecord profile={p} loading={!p.historyCheckedAt} /> : <Loading text="Loading the full record…" />}</div>;
};

const PersonScreen: React.FC<{ name: string }> = ({ name }) => {
    const { nav, setTitle, visit } = useM();
    const [rs, setRs] = useState<PersonCompanyResult[] | null>(() => enriched.get(name.toLowerCase()) || null);
    const [base, setBase] = useState<PersonCompanyResult[] | null>(null);
    const [enriching, setEnriching] = useState(false);
    const [dq, setDq] = useState<DisqualifiedDirector[] | 'unavailable' | null>(null);
    const [ins, setIns] = useState<InsolvencyRecord[] | 'unavailable' | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let off = false; setTitle(name);
        // Same three checks as the desktop person search; company status flags patch in afterwards.
        searchDisqualifiedDirectors(name, config).then(r => !off && setDq(r.roles || [])).catch(() => !off && setDq('unavailable'));
        searchInsolvency(name, config).then(r => !off && setIns(r.searchResults || [])).catch(() => !off && setIns('unavailable'));
        loadPerson(name).then(r => {
            if (off) return;
            setBase(r);
            if (!enriched.has(name.toLowerCase())) setRs(r);
            visit(`p:${name}`, name, `${r.filter(x => !x.isInactive).length} current roles`);
            if (!r.length || enriched.has(name.toLowerCase())) return;
            setEnriching(true);
            enrichCompanyResults(r, config).then(e => { enriched.set(name.toLowerCase(), e); if (!off) setRs(e); })
                .catch(() => { /* rows stay without status flags */ }).finally(() => !off && setEnriching(false));
        }).catch(() => !off && setError('The Companies Register did not answer. Try again in a moment.'));
        return () => { off = true; };
    }, [name]);
    if (error) return <div className="m-pg"><p className="m-error" role="alert">{error}</p></div>;
    if (!rs) return <div className="m-pg"><Loading text={`Searching the register for ${name}…`} /></div>;
    const snap = base ? personSnap(base) : null;
    const linked = insolvencyLinkedSummary(rs);
    // The register matches names loosely; different middle names are usually different people.
    const groups = new Map<string, PersonCompanyResult[]>();
    for (const r of rs) { const n = [r.firstName, r.lastName].filter(Boolean).join(' ') || name; groups.set(n, [...(groups.get(n) || []), r]); }
    const row = (r: PersonCompanyResult, i: number) => {
        const st = personStatus(r);
        const stamps = roleStamps(r);
        return <Row key={`${r.nzbn}-${i}`} k="社" title={r.companyName} stamps={stamps} note={timingLabel(r)}
            sub={[r.roleType, r.shareholding > 0 ? pct(r.shareholding) : '', r.isInactive && r.resignationDate ? `ended ${registerDate(r.resignationDate)}` : r.appointmentDate ? `since ${registerDate(r.appointmentDate)}` : '', !stamps.length && tone(st) !== 'ok' && st ? st : ''].filter(Boolean).join(' · ')}
            onClick={() => nav({ v: 'company', nzbn: r.nzbn })} />;
    };
    const dqCurrent = Array.isArray(dq) && dq.some(d => d.disqualificationCriteria?.criteria?.some(c => !c.endDate || Date.parse(c.endDate) > Date.now()));
    const insCurrent = Array.isArray(ins) && ins.some(isInsolvencyRecordCurrent);
    const check = (label: string, v: unknown[] | 'unavailable' | null, current: boolean, details: React.ReactNode) =>
        <div className="m-check">
            <span className={`m-stamp m-st-${v === null || v === 'unavailable' ? 'wash' : v.length ? 'crit' : 'green'}`} aria-hidden="true">{v && v !== 'unavailable' && v.length ? '紅' : '青'}</span>
            <div><b>{label}</b><p>{v === null ? 'Checking…' : v === 'unavailable' ? 'Check unavailable right now. Try again shortly.'
                : !v.length ? 'No match'
                : `${v.length} name match${v.length > 1 ? 'es' : ''} · ${current ? 'current' : 'none current'} · check it is the same person`}</p>
                {Array.isArray(v) && v.length > 0 && <details><summary>Show {v.length > 1 ? 'matches' : 'match'}</summary>{details}</details>}</div>
        </div>;
    return <div className="m-pg">
        <div className="m-head"><span className="m-badge" aria-hidden="true">人</span><div>
            <h1 className="m-name">{name}</h1>
            <p className="m-meta">{rs.filter(r => isActivePersonCompany(r)).length} current and {rs.filter(r => !isActivePersonCompany(r)).length} former roles on the Companies Register</p>
        </div></div>
        <Actions k={`p:${name}`} name={name} snap={snap} />
        <NoteAndChanges k={`p:${name}`} snap={snap} />
        <Section title="Register checks" aside="by name">
            <div className="m-checks">
                {check('Disqualified directors register', dq, dqCurrent, Array.isArray(dq) && <ul>{dq.map((d, i) => <li key={i}>
                    {[d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ')}
                    {(d.disqualificationCriteria?.criteria || []).map((c, j) => <span key={j} className="m-rs">{registerDate(c.startDate)} – {c.endDate ? registerDate(c.endDate) : 'no end date'}{c.criteria && ` · ${c.criteria}`}</span>)}
                </li>)}</ul>)}
                {check('Insolvency register (bankruptcy and no-asset procedure)', ins, insCurrent, Array.isArray(ins) && <ul>{ins.map((r, i) => <li key={i}>
                    {r.estateName}<span className="m-rs">{[r.insolvencyTypeDescription, r.insolvencyStatus, r.adjudicationOrLiquidationDate && registerDate(r.adjudicationOrLiquidationDate),
                        formatBirth(r.monthOfBirth, r.yearOfBirth) && `born ${formatBirth(r.monthOfBirth, r.yearOfBirth)}`].filter(Boolean).join(' · ')}</span>
                </li>)}</ul>)}
            </div>
        </Section>
        {linked.count > 0 && <div className="m-flag m-crit"><b>{linked.line}</b></div>}
        {enriching && <Loading text="Checking each company's status…" />}
        {!rs.length && <p className="m-meta">No directorships or shareholdings found for “{name}”. Try the name as it appears on the register, with first and last name.</p>}
        {groups.size > 1 && <p className="m-meta">{groups.size} different names matched. They may be different people.</p>}
        {[...groups].map(([n, list]) => <React.Fragment key={n}>
            {list.some(r => isActivePersonCompany(r)) && <Section title={groups.size > 1 ? `${n} · current` : 'Current roles'} aside={list.filter(r => isActivePersonCompany(r)).length}>
                <div className="m-list">{list.filter(r => isActivePersonCompany(r)).map(row)}</div></Section>}
            {list.some(r => !isActivePersonCompany(r)) && <Section title={groups.size > 1 ? `${n} · former` : 'Former roles'} aside={list.filter(r => !isActivePersonCompany(r)).length}>
                <div className="m-list">{list.filter(r => !isActivePersonCompany(r)).map(row)}</div></Section>}
        </React.Fragment>)}
    </div>;
};

function TitleScreen() {
    const { nav, setTitle } = useM();
    useEffect(() => { if (!lastReport) nav({ v: 'search', kind: 'address', q: '' }, true); else setTitle(String(lastReport.title?.title_no || 'Title')); }, []);
    if (!lastReport) return null;
    return <div className="m-property"><Suspense fallback={<Loading text="Loading title…" />}>
        <PropertyReport report={lastReport} onExport={() => window.print()} />
    </Suspense></div>;
}

function RecentList({ limit }: { limit?: number }) {
    const { recent, nav } = useM();
    return <div className="m-list">{recent.slice(0, limit).map(r => <Row key={r.key} k={r.key.startsWith('c:') ? '社' : '人'} title={r.name} sub={r.sub}
        onClick={() => nav(r.key.startsWith('c:') ? { v: 'company', nzbn: r.key.slice(2) } : { v: 'person', name: r.key.slice(2) })} />)}</div>;
}
function RecentScreen() {
    const { recent } = useM();
    return <div className="m-pg"><Section title="Recent" aside={recent.length}>
        {recent.length ? <RecentList /> : <p className="m-meta">Companies and people you open appear here.</p>}
    </Section></div>;
}

function PinnedScreen() {
    const { pins, notes, nav } = useM();
    const [state, setState] = useState<Record<string, string[] | 'checking' | 'failed'>>({});
    const [checkedAt, setCheckedAt] = useState('');
    useEffect(() => {
        let off = false;
        setState(Object.fromEntries(pins.map(p => [p.key, 'checking'])));
        Promise.all(pins.map(p => snapFor(p.key)
            .then(now => !off && setState(s => ({ ...s, [p.key]: diffSnapshot(p.snap, now) })))
            .catch(() => !off && setState(s => ({ ...s, [p.key]: 'failed' })))))
            .then(() => !off && setCheckedAt(new Date().toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })));
        return () => { off = true; };
    }, [pins.length]);
    const changed = pins.filter(p => Array.isArray(state[p.key]) && (state[p.key] as string[]).length).length;
    return <div className="m-pg">
        <Section title="Pinned" aside={changed ? `${changed} changed` : pins.length}>
            {!pins.length ? <p className="m-meta">Nothing pinned yet. Pin a company or person to watch it: each time you open this tab, it is checked against the register for changes since you pinned it.</p>
                : <div className="m-list">{pins.map(p => {
                    const s = state[p.key];
                    const sub = s === 'checking' ? 'Checking the register…' : s === 'failed' ? 'Could not check right now'
                        : s?.length ? `${s.length} change${s.length > 1 ? 's' : ''}: ${s[0]}` : notes[p.key] ? `✎ ${notes[p.key]}` : `No changes since ${registerDate(p.pinnedAt)}`;
                    return <Row key={p.key} k={p.key.startsWith('c:') ? '社' : '人'} title={p.name} sub={sub} warn={!!(Array.isArray(s) && s.length)}
                        right={Array.isArray(s) && s.length ? <span className="m-dot" aria-label="changed">●</span> : undefined}
                        onClick={() => nav(p.key.startsWith('c:') ? { v: 'company', nzbn: p.key.slice(2) } : { v: 'person', name: p.key.slice(2) })} />;
                })}</div>}
        </Section>
        {checkedAt && <p className="m-meta">Checked against the register at {checkedAt}. Pins and notes are kept on this phone.</p>}
    </div>;
}
