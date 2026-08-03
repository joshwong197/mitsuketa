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

const nodeTypes = {
    companyNode: CompanyNode,
    personNode: PersonNode,
    summaryNode: SummaryNode,
};

interface ExportPayload {
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
    const initialRef = useRef(initialNodes);
    const [allNodes, setAllNodes] = useState<GraphNode[]>(initialNodes);

    const styledEdges = useMemo(() => styleEdges(payload.edges), []);

    // rfNodes is what React Flow renders — driven by drag events (onNodesChange)
    // and re-laid-out whenever visibility changes (drags reset then, like the main app).
    const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
    const [rfEdges, setRfEdges] = useState<Edge[]>([]);
    useEffect(() => {
        const visible = allNodes.filter((n) => n.data.isVisible);
        const laid = getLayoutedElements(visible as Node[], styledEdges);
        setRfNodes(laid.nodes);
        setRfEdges(laid.edges as Edge[]);
    }, [allNodes, styledEdges]);

    const applyVisibility = (updated: GraphNode[]) => {
        setAllNodes(calculateHiddenDescendants(updated, payload.edges));
    };

    const onNodeClick = (_: React.MouseEvent, node: Node) => {
        const mem = allNodes.find((n) => n.id === node.id);
        if (!mem) return;
        if (mem.data.isBranchExpanded) {
            applyVisibility(collapseNodeSubtree(allNodes, payload.edges, node.id));
        } else if ((mem.data.hiddenDescendantCount || 0) > 0) {
            applyVisibility(expandNodeSubtree(allNodes, payload.edges, node.id));
        }
    };

    const expandAll = () => {
        applyVisibility(allNodes.map((n) => ({
            ...n,
            data: { ...n.data, isVisible: true, isBranchExpanded: true },
        })));
    };

    const resetView = () => setAllNodes(initialRef.current);

    const generated = new Date(payload.generatedAt);
    const generatedStr = generated.toLocaleString('en-NZ', {
        dateStyle: 'full',
        timeStyle: 'long',
        timeZone: 'Pacific/Auckland',
    });

    return (
        <div className="w-screen h-screen bg-paper relative">
            <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                onNodesChange={onNodesChange}
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.05}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
            >
                {/* Dot color is dyed in export-viewer.css (SVG attrs can't take var()) */}
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                <Controls position="bottom-left" showInteractive={false} />
            </ReactFlow>

            {/* Header: identity + timestamp. Must stay visible in any screenshot. */}
            <div className="absolute top-4 left-4 z-10 bg-paper px-4 py-3 border border-rule max-w-md">
                <h1 className="text-sm font-bold text-ink">{payload.title}</h1>
                {payload.nzbn && <p className="text-[11px] text-ink-mid font-mono tabular-nums">NZBN: {payload.nzbn}</p>}
                <p className="text-[11px] text-ink-mid mt-1 font-semibold">Generated: {generatedStr}</p>
                <p className="text-[10px] text-ink-pale mt-0.5">
                    Point-in-time snapshot — reflects NZ register data as at the generation date. Click a node to expand or collapse its branch; drag to reposition.
                </p>
                <p className="text-[10px] text-ink-pale mt-1">
                    {allNodes.filter((n) => n.data.isVisible).length} of {allNodes.length} entities shown · {payload.edges.length} relationships
                </p>
                <div className="flex gap-2 mt-2">
                    <button onClick={expandAll} className="text-[11px] px-2 py-1 bg-ink text-paper hover:bg-accent hover:text-accent-ink">
                        Expand all
                    </button>
                    <button onClick={resetView} className="text-[11px] px-2 py-1 border border-rule text-ink-mid hover:border-ink-mid hover:text-ink">
                        Reset view
                    </button>
                </div>
                <NotesBlock notes={notes} />
            </div>

            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-[11px] text-ink-pale pointer-events-none">
                Mitsuketa 見つけた · {generatedStr}
            </div>
        </div>
    );
}

const payload = readPayload();
document.title = `Mitsuketa — ${payload.title}`;
createRoot(document.getElementById('root')!).render(<ExportedGraph payload={payload} />);
