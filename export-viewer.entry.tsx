import { removedCompany } from './utils/relationshipStatus';
// Entry for the self-contained interactive HTML export.
// Bundled by `npm run build:export-viewer` into public/export-viewer.js,
// then inlined into exported files by services/exportService.ts.
// Reads its graph payload from <script id="mitsuketa-data" type="application/json">.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactFlow, { Background, BackgroundVariant, Controls, MarkerType, useNodesState, type Edge, type Node } from 'reactflow';
import { CompanyNode, PersonNode, SummaryNode } from './components/CustomNodes';
import { getLayoutedElements } from './services/layoutService';
import { calculateHiddenDescendants, expandNodeSubtree, collapseNodeSubtree } from './utils/graphVisibility';
import type { CaseNote, GraphEdge, GraphNode } from './types';
import { EntityRecord } from './components/EntityRecord';
import type { EntityProfile } from './services/entityProfile';

const nodeTypes = {
    companyNode: CompanyNode,
    personNode: PersonNode,
    summaryNode: SummaryNode,
};

interface ExportPayload {
    record?: EntityProfile;
    recordUnavailable?: string;
    scope?: 'simple' | 'comprehensive';
    title: string;
    nzbn?: string;
    searchQuery?: string;
    generatedAt: string; // ISO timestamp
    nodes: GraphNode[];
    edges: GraphEdge[];
    notes?: CaseNote[]; // Case notes for the exported tab (older exports omit this)
}

// Mirror of services/compareService personId() — kept inline so the export
// bundle doesn't drag the API layer in. Note keys are nzbn ?? personId(label).
const personId = (name: string): string =>
    'P-' +
    name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .sort()
        .join('-');

const nodeKey = (n: GraphNode): string => n.data.nzbn || personId(n.data.label);

function readPayload(): ExportPayload {
    const el = document.getElementById('mitsuketa-data');
    if (!el?.textContent) throw new Error('Embedded graph data missing');
    return JSON.parse(el.textContent);
}

// Keep the main app's look: default bezier curves, sumi ink strokes, animated subsidiary edges.
// Exported payloads carry the app's token-based edge styles; fallbacks match App.tsx / STATUS_RAMP.md.
const INK_ARROW = { type: MarkerType.ArrowClosed, color: 'oklch(from var(--ink) l c h / .6)' };
function styleEdges(edges: GraphEdge[]): Edge[] {
    return edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: e.animated,
        style: e.style || { stroke: 'var(--ink-mid)', strokeWidth: 1.6 },
        markerEnd: (e.markerEnd as any) || INK_ARROW,
        data: e.data as any,
    }));
}

// Collapsible note list inside the header card. Renders nothing without notes.
function NotesBlock({ notes }: { notes: CaseNote[] }) {
    const [open, setOpen] = useState(false);
    if (notes.length === 0) return null;
    return (
        <div className="mt-2 pt-2 border-t border-rule">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.08em] text-ink-pale hover:text-ink"
                aria-expanded={open}
            >
                <span>Notes ({notes.length})</span>
                <span aria-hidden="true">{open ? '−' : '+'}</span>
            </button>
            {open && (
                <ul className="mt-1 max-h-48 overflow-y-auto">
                    {notes.map((note) => (
                        <li key={note.id} className="py-1.5 border-t border-rule first:border-t-0">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-mid">
                                {note.flag && (
                                    <span
                                        className="inline-block w-2 h-2 shrink-0"
                                        style={{ background: 'var(--accent)' }}
                                        title="Flagged"
                                    />
                                )}
                                <span className="truncate">{note.nodeLabel}</span>
                            </div>
                            <p className="text-[12.5px] text-ink mt-0.5 whitespace-pre-wrap break-words">{note.text}</p>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function ExportedGraph({ payload }: { payload: ExportPayload }) {
    const [view, setView] = useState<'network' | 'record'>('network');
    const notes = payload.notes ?? [];
    // Note lookup by stable node key (nzbn ?? personId(label)) — stamps the
    // dog-ear fields so shared CustomNodes renders them, same as the app.
    const noteByKey = useMemo(() => new Map(notes.map((note) => [note.key, note])), []);
    // Preserve the exporter's expand/collapse state; default any unmarked node to visible.
    const initialNodes = useMemo(() => calculateHiddenDescendants(
        payload.nodes.map((n) => {
            const note = noteByKey.get(nodeKey(n));
            return {
                ...n,
                data: {
                    ...n.data,
                    isVisible: n.data.isVisible !== false,
                    isExpanding: false,
                    hasNote: n.data.hasNote || !!note,
                    noteFlagged: n.data.noteFlagged || (note?.flag ?? false),
                },
            };
        }),
        payload.edges
    ), []);
    const root = payload.nodes.find(n=>n.data.isTarget) || payload.nodes[0];
    const [scope,setScope]=useState(payload.scope==='simple'?'simple':'comprehensive');
    const [removed,setRemoved]=useState(false), [former,setFormer]=useState(false), [people,setPeople]=useState(false);
    const [mode,setMode]=useState('focused');
    const [expanded,setExpanded]=useState<Set<string>>(new Set());
    const [selected,setSelected]=useState(root.id);
    const [menu,setMenu]=useState<{id:string,x:number,y:number}|null>(null);
    const menuRef=useRef<HTMLDivElement>(null);
    useEffect(()=>{if(!menu)return;menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();const dismiss=(e:PointerEvent)=>{if(!menuRef.current?.contains(e.target as Element))setMenu(null)};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(null)};document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape)}},[menu]);
    const toggleConnections=(id:string)=>{if(payload.scope==='simple')return;setSelected(id);setScope('comprehensive');setMode('focused');setExpanded(prev=>{const next=new Set(prev);next.has(id)?next.delete(id):next.add(id);return next});setMenu(null)};
    const [flow,setFlow]=useState<any>(null);
    const [rfNodes,setRfNodes,onNodesChange]=useNodesState([]);
    const [rfEdges,setRfEdges]=useState<Edge[]>([]);
    const filtered=useMemo(()=>{
        const eligible=new Map<string, GraphNode>(initialNodes.filter(n=>(scope!=='simple'&&removed) || !removedCompany(n.data)).map(n=>[n.id,n] as [string, GraphNode]));
        const edges=payload.edges.filter(e=>eligible.has(e.source)&&eligible.has(e.target)&&((scope!=='simple'&&former)||(!e.data?.isCeased&&!e.data?.currentUnverified)));
        const ids=new Set<string>(); if(eligible.has(root.id)) ids.add(root.id);
        const company=(id:string)=>eligible.get(id)?.type==='companyNode';
        if(mode==='saved') initialNodes.forEach(n=>{if(n.data.isVisible&&eligible.has(n.id))ids.add(n.id)});
        else if(mode==='all') eligible.forEach(n=>{if(people||company(n.id))ids.add(n.id)});
        else if(scope==='simple') edges.forEach(e=>{if(e.target===root.id)ids.add(e.source)});
        else {
            edges.forEach(e=>{if(company(e.source)&&company(e.target)&&(e.source===root.id||e.target===root.id)){ids.add(e.source);ids.add(e.target)}});
            let changed=true;while(changed){changed=false;edges.forEach(e=>{if(company(e.source)&&company(e.target)&&((ids.has(e.source)&&expanded.has(e.source))||(ids.has(e.target)&&expanded.has(e.target)))){if(!ids.has(e.source)||!ids.has(e.target))changed=true;ids.add(e.source);ids.add(e.target)}})}
            if(people)edges.forEach(e=>{if(ids.has(e.target)&&!company(e.source))ids.add(e.source)});
        }
        const connected=new Set(edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).flatMap(e=>[e.source,e.target]));
        ids.forEach(id=>{if(!company(id)&&!connected.has(id))ids.delete(id)});
        return {nodes:initialNodes.filter(n=>ids.has(n.id)).map(n=>({...n,data:{...n.data,isVisible:true,isBranchExpanded:false,hiddenDescendantCount:undefined}})),edges:styleEdges(edges.filter(e=>ids.has(e.source)&&ids.has(e.target)))};
    },[removed,former,people,scope,mode,expanded]);
    useEffect(()=>{const laid=getLayoutedElements(filtered.nodes as Node[],filtered.edges);setRfNodes(laid.nodes);setRfEdges(laid.edges as Edge[]);const t=setTimeout(()=>flow?.fitView({padding:.18}),150);return()=>clearTimeout(t)},[filtered,flow]);
    const onNodeClick=(_:React.MouseEvent,n:Node)=>setSelected(n.id);
    const resetView=()=>{setMode('focused');setScope(payload.scope==='simple'?'simple':'comprehensive');setRemoved(false);setFormer(false);setPeople(false);setExpanded(new Set())};
    const expandAll=()=>{setScope('comprehensive');setMode('all')};
    // Theme. export-viewer.css already carries the :root[data-theme] rules, but
    // nothing ever set the attribute — so an exported chart silently followed the
    // reader's OS and arrived dark with no way back. Default stays the OS
    // preference; this is an override, and the label names what you will get.
    const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
    const effective = theme
        ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    useEffect(() => {
        if (theme) document.documentElement.dataset.theme = theme;
    }, [theme]);

    const generated = new Date(payload.generatedAt);
    const generatedStr = generated.toLocaleString('en-NZ', {
        dateStyle: 'full',
        timeStyle: 'long',
        timeZone: 'Pacific/Auckland',
    });

    return (
        <div className="w-screen h-screen bg-paper relative">
            <header className="export-report-bar">
                <strong>見つけた <span>Mitsuketa</span></strong>
                <nav aria-label="Report views">
                    <button aria-pressed={view==='network'} onClick={()=>setView('network')}>Org Chart</button>
                    <button aria-pressed={view==='record'} onClick={()=>setView('record')}>Details</button>
                </nav>
                <span className="export-scope">{payload.scope==='simple'?'Simple':'Comprehensive'} search</span>
                <button aria-label={`Switch to ${effective==='dark'?'light':'dark'} theme`} onClick={()=>setTheme(effective==='dark'?'light':'dark')}>{effective==='dark'?'Light':'Dark'}</button>
            </header>
            {view==='network'&&<div className="export-network">
            <div className="revision-toolbar">
                <div className="revision-title"><strong>{payload.title}</strong><span>{filtered.nodes.length} of {payload.nodes.length} entities · {filtered.edges.length} relationships shown</span></div>
                <div className="revision-controls">
                <select aria-label="Chart scope" value={scope} onChange={e=>{setScope(e.target.value);setMode('focused')}}><option value="simple">Simple</option>{payload.scope!=='simple'&&<option value="comprehensive">Comprehensive</option>}</select>
                {scope!=='simple'&&<label><input type="checkbox" checked={removed} onChange={e=>setRemoved(e.target.checked)}/> Include removed companies</label>}
                {scope!=='simple'&&<label><input type="checkbox" checked={former} onChange={e=>setFormer(e.target.checked)}/> Include former / unverified relationships</label>}
                {scope!=='simple'&&<label><input type="checkbox" checked={people} onChange={e=>{setPeople(e.target.checked);setMode('focused')}}/> Show people</label>}
                <button onClick={resetView}>Reset</button>{scope!=='simple'&&<button onClick={expandAll}>Expand all branches</button>}
                </div>
                <details><summary>Report details & notes</summary><p>NZBN {payload.nzbn} · Exported {generatedStr}</p><p>Filters change the view. All original data remains in this snapshot.</p><NotesBlock notes={notes}/></details>
                </div>
                <div className="revision-selection"><span>Selected: <strong>{payload.nodes.find(n=>n.id===selected)?.data.label}</strong></span><button disabled={payload.scope==='simple'} onClick={()=>toggleConnections(selected)}>{expanded.has(selected)?'Collapse':'Expand'} company connections</button><span>Right-click a company to expand or collapse its connections. Filters still apply.</span></div>
                <div className="revision-canvas"><ReactFlow onInit={setFlow}
                nodes={rfNodes}
                edges={rfEdges}
                onNodesChange={onNodesChange}
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                onNodeContextMenu={(event,node)=>{event.preventDefault();setSelected(node.id);setMenu({id:node.id,x:Math.max(8,Math.min(event.clientX,window.innerWidth-280)),y:Math.max(8,Math.min(event.clientY,window.innerHeight-155))})}}
                onPaneClick={()=>setMenu(null)}
                onMoveStart={()=>setMenu(null)}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.05}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
            >
                {/* Dot color is dyed in export-viewer.css (SVG attrs can't take var()) */}
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                <Controls position="bottom-left" showInteractive={false} />
            </ReactFlow></div>
            {menu&&<div ref={menuRef} role="menu" aria-label="Entity connections" style={{position:'fixed',left:menu.x,top:menu.y,zIndex:100,width:264,padding:12,background:'var(--paper)',color:'var(--ink)',border:'1px solid var(--rule)',boxShadow:'0 4px 18px #0003'}}>
                <p style={{fontSize:12,marginBottom:10}}>{payload.nodes.find(n=>n.id===menu.id)?.data.label}</p>
                {payload.nodes.find(n=>n.id===menu.id)?.type==='companyNode'&&payload.scope!=='simple'?<button role="menuitem" style={{width:'100%',padding:10,border:'1px solid var(--rule)',background:'var(--paper)',color:'var(--accent)',textAlign:'left',cursor:'pointer'}} onClick={()=>toggleConnections(menu.id)}>{expanded.has(menu.id)?'Collapse':'Expand'} connections{scope==='simple'?' (Comprehensive)':''}</button>:<p style={{fontSize:12}}>Select a company to explore its connections.</p>}
                <button role="menuitem" onClick={()=>setMenu(null)} style={{fontSize:12,marginTop:10}}>Close</button>
            </div>}

            </div>}
            {view==='record'&&<main className="export-record" aria-label="Entity Details">
                <p className="export-snapshot">{payload.title} · Snapshot exported {generatedStr}</p>
                {payload.record?<EntityRecord profile={payload.record} statusContext={payload.nodes.find(n=>n.data.isTarget)?.data}/>:<p>{payload.recordUnavailable||'No entity record is included in this snapshot.'}</p>}
            </main>}
        </div>
    );
}

const payload = readPayload();
document.title = `Mitsuketa — ${payload.title}`;
createRoot(document.getElementById('root')!).render(<ExportedGraph payload={payload} />);
