// Standalone React Flow viewer for MCP-exported ownership graphs.
//
// Loads as /graph.html?id=<storeId>. Fetches the graph JSON from
// /api/mcp?graphData=<storeId> and renders with the same CompanyNode /
// PersonNode components as the main app — so the look matches.

import React, { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, BackgroundVariant, Controls, MarkerType, type Edge, type Node } from 'reactflow';
import { CompanyNode, PersonNode, SummaryNode } from './CustomNodes';
import { getLayoutedElements } from '../services/layoutService';
import type { GraphEdge, GraphNode } from '../types';

const nodeTypes = {
    companyNode: CompanyNode,
    personNode: PersonNode,
    summaryNode: SummaryNode,
};

interface GraphPayload {
    title?: string;
    rootNzbn?: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
}

type Status = 'loading' | 'ready' | 'missing' | 'error';

export function GraphViewer() {
    const [status, setStatus] = useState<Status>('loading');
    const [data, setData] = useState<GraphPayload | null>(null);
    const [errorMsg, setErrorMsg] = useState<string>('');

    const id = useMemo(() => new URLSearchParams(window.location.search).get('id') || '', []);

    useEffect(() => {
        if (!id) {
            setStatus('error');
            setErrorMsg('Missing ?id= query parameter.');
            return;
        }
        let cancelled = false;
        fetch(`/api/mcp?graphData=${encodeURIComponent(id)}`)
            .then(async (res) => {
                if (res.status === 404) {
                    if (!cancelled) setStatus('missing');
                    return;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as GraphPayload;
                if (!cancelled) {
                    setData(json);
                    setStatus('ready');
                    document.title = `Mitsuketa — ${json.title || 'Graph Viewer'}`;
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setStatus('error');
                    setErrorMsg(err?.message || String(err));
                }
            });
        return () => { cancelled = true; };
    }, [id]);

    const laidOut = useMemo(() => {
        if (!data) return { nodes: [] as Node[], edges: [] as Edge[] };
        const rfNodes: Node[] = data.nodes.map((n) => ({
            id: n.id,
            type: n.type || 'companyNode',
            position: n.position || { x: 0, y: 0 },
            data: n.data as any,
        }));
        const rfEdges: Edge[] = data.edges.map((e) => {
            // Status ramp: ceased roles render dashed/faded, current roles solid.
            // (This standalone viewer doesn't load index.css, so no CSS tokens here.)
            const isCeased = !!e.data?.isCeased;
            return {
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label,
                type: 'smoothstep',
                animated: false,
                className: isCeased ? 'edge-ceased' : undefined,
                style: isCeased
                    ? { stroke: '#94a3b8', strokeWidth: 1.3, strokeDasharray: '6 4' }
                    : { stroke: '#3b82f6', strokeWidth: 1.5 },
                markerEnd: { type: MarkerType.ArrowClosed, color: isCeased ? '#94a3b8' : '#3b82f6' },
                data: e.data as any,
            };
        });
        return getLayoutedElements(rfNodes, rfEdges);
    }, [data]);

    if (status === 'loading') {
        return <CenterMessage title="Loading graph…" body="Fetching data from the Mitsuketa MCP server." />;
    }
    if (status === 'missing') {
        return (
            <CenterMessage
                title="Graph not found"
                body="This link has expired or the serving instance was recycled. Ask Claude to regenerate the graph — a fresh link will be issued."
            />
        );
    }
    if (status === 'error') {
        return <CenterMessage title="Could not load graph" body={errorMsg} />;
    }

    return (
        <div className="w-screen h-screen bg-slate-50 dark:bg-slate-950 relative">
            <ReactFlow
                nodes={laidOut.nodes}
                edges={laidOut.edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
                <Controls position="bottom-left" showInteractive={false} />
            </ReactFlow>

            <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">{data?.title || 'Ownership graph'}</h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {data?.nodes.length} entities · {data?.edges.length} relationships
                </p>
            </div>

            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 text-[11px] text-slate-500 dark:text-slate-400 pointer-events-none">
                Mitsuketa <span className="font-japanese">見つけた</span>
            </div>
        </div>
    );
}

function CenterMessage({ title, body }: { title: string; body: string }) {
    return (
        <div className="flex flex-col items-center justify-center w-screen h-screen text-center px-6">
            <h1 className="text-xl font-semibold text-slate-800 mb-2">{title}</h1>
            <p className="text-sm text-slate-600 max-w-md">{body}</p>
        </div>
    );
}
