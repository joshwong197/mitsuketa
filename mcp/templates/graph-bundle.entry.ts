// Source for the prebuilt graph bundle. Bundled with esbuild via
// `npm run build:graph-bundle`. The output (mcp/templates/graph-bundle.js)
// is committed to the repo so the MCP server can inline it at runtime.

import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
// @ts-ignore - cytoscape-expand-collapse has no bundled types.
import expandCollapse from 'cytoscape-expand-collapse';

cytoscape.use(dagre);
cytoscape.use(expandCollapse);

interface MitsuketaNode {
    id: string;
    label: string;
    entityName?: string;
    nzbn?: string;
    sourceRegisterUniqueId?: string;
    status?: string;
    entityTypeCode?: string;
    entityTypeDescription?: string;
    type?: string;
    isInExternalAdmin?: boolean;
    externalAdminType?: string;
    removalCommenced?: boolean;
    hasHistoricInsolvency?: boolean;
    historicInsolvencyType?: string;
    appointmentDate?: string;
    vacationDate?: string;
    isTarget?: boolean;
}

interface MitsuketaEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
    percentage?: number;
    relationshipType?: string;
}

interface GraphData {
    nodes: MitsuketaNode[];
    edges: MitsuketaEdge[];
}

interface RenderOpts {
    theme?: 'light' | 'dark';
    title?: string;
}

const COLORS = {
    light: {
        bg: '#ffffff',
        panelBg: '#f8fafc',
        panelText: '#0f172a',
        border: '#e2e8f0',
        node: '#dbeafe',
        nodeText: '#0f172a',
        nodeBorder: '#3b82f6',
        target: '#fde68a',
        targetBorder: '#f59e0b',
        admin: '#fecaca',
        adminBorder: '#dc2626',
        removed: '#e5e7eb',
        removedText: '#6b7280',
        edge: '#94a3b8',
        edgeLabel: '#475569',
    },
    dark: {
        bg: '#0f172a',
        panelBg: '#1e293b',
        panelText: '#f1f5f9',
        border: '#334155',
        node: '#1e3a8a',
        nodeText: '#f1f5f9',
        nodeBorder: '#60a5fa',
        target: '#78350f',
        targetBorder: '#fbbf24',
        admin: '#7f1d1d',
        adminBorder: '#f87171',
        removed: '#374151',
        removedText: '#9ca3af',
        edge: '#64748b',
        edgeLabel: '#cbd5e1',
    },
};

function isInExternalAdmin(data: MitsuketaNode): boolean {
    return data.isInExternalAdmin === true;
}

function isRemoved(data: MitsuketaNode): boolean {
    if (data.removalCommenced === true) return true;
    const s = (data.status || '').toLowerCase();
    return s.includes('removed') || s.includes('struck off') || s === 'inactive';
}

function buildDetailHtml(data: MitsuketaNode, palette: typeof COLORS.light): string {
    const rows: Array<[string, string | undefined]> = [
        ['NZBN', data.nzbn],
        ['NZCN', data.sourceRegisterUniqueId],
        ['Status', data.status],
        ['Type', data.entityTypeDescription || data.entityTypeCode],
        ['Appointed', data.appointmentDate],
        ['Vacated', data.vacationDate],
    ];
    const badges: string[] = [];
    if (data.isInExternalAdmin) badges.push(`<span class="badge badge-admin">${data.externalAdminType || 'In external administration'}</span>`);
    if (data.removalCommenced) badges.push('<span class="badge badge-removed">Removal commenced</span>');
    if (data.hasHistoricInsolvency) badges.push(`<span class="badge badge-history">Historic: ${data.historicInsolvencyType || 'insolvency'}</span>`);

    const escape = (v: string) => v.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

    const tableRows = rows
        .filter(([, v]) => v && String(v).trim() !== '')
        .map(([k, v]) => `<tr><th>${k}</th><td>${escape(String(v))}</td></tr>`)
        .join('');

    const links: string[] = [];
    if (data.sourceRegisterUniqueId) {
        links.push(
            `<a href="https://app.companiesoffice.govt.nz/companies/app/ui/pages/companies/${encodeURIComponent(data.sourceRegisterUniqueId)}" target="_blank" rel="noreferrer">View on Companies Office</a>`,
        );
    }
    if (data.nzbn) {
        links.push(`<a href="https://www.nzbn.govt.nz/mynzbn/nzbndetails/${encodeURIComponent(data.nzbn)}/" target="_blank" rel="noreferrer">View on NZBN register</a>`);
    }

    return `
        <h2>${escape(data.entityName || data.label || data.id)}</h2>
        ${badges.length ? `<div class="badges">${badges.join(' ')}</div>` : ''}
        ${tableRows ? `<table>${tableRows}</table>` : ''}
        ${links.length ? `<div class="links">${links.join(' · ')}</div>` : ''}
    `;
}

function render(container: HTMLElement, data: GraphData, opts: RenderOpts = {}) {
    const theme = opts.theme || 'light';
    const palette = COLORS[theme];

    document.body.style.background = palette.bg;
    document.body.style.color = palette.panelText;

    const elements: cytoscape.ElementDefinition[] = [
        ...data.nodes.map((n) => ({
            data: { ...n, id: n.id },
            classes: [
                n.isTarget ? 'target' : '',
                isInExternalAdmin(n) ? 'admin' : '',
                isRemoved(n) ? 'removed' : '',
            ]
                .filter(Boolean)
                .join(' '),
        })),
        ...data.edges.map((e) => ({
            data: { ...e, id: e.id, source: e.source, target: e.target },
        })),
    ];

    const cy = cytoscape({
        container,
        elements,
        wheelSensitivity: 0.2,
        minZoom: 0.05,
        maxZoom: 4,
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': palette.node,
                    'border-color': palette.nodeBorder,
                    'border-width': 2,
                    'color': palette.nodeText,
                    'label': 'data(label)',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'text-wrap': 'wrap',
                    'text-max-width': '220px',
                    'font-size': 12,
                    'width': 'label',
                    'height': 'label',
                    'padding': '12px',
                    'shape': 'round-rectangle',
                },
            },
            {
                selector: 'node.target',
                style: { 'background-color': palette.target, 'border-color': palette.targetBorder, 'border-width': 3 },
            },
            {
                selector: 'node.admin',
                style: { 'background-color': palette.admin, 'border-color': palette.adminBorder, 'border-width': 3 },
            },
            {
                selector: 'node.removed',
                style: { 'background-color': palette.removed, 'color': palette.removedText, 'border-color': palette.removedText },
            },
            {
                selector: 'edge',
                style: {
                    'curve-style': 'bezier',
                    'target-arrow-shape': 'triangle',
                    'line-color': palette.edge,
                    'target-arrow-color': palette.edge,
                    'width': 1.5,
                    'label': 'data(label)',
                    'font-size': 10,
                    'color': palette.edgeLabel,
                    'text-background-color': palette.bg,
                    'text-background-opacity': 0.9,
                    'text-background-padding': '2px',
                },
            },
            {
                selector: ':selected',
                style: { 'border-width': 4, 'border-color': '#3b82f6' },
            },
        ],
        layout: { name: 'dagre', rankDir: 'TB', nodeSep: 20, rankSep: 80 } as any,
    });

    // Expand/collapse plugin: enables compound-node collapsing. We don't pre-group
    // nodes into compounds here, so collapse/expand applies to subtrees via the
    // double-click handler below.
    // @ts-ignore plugin attaches at runtime
    const api = cy.expandCollapse({ animate: true, fisheye: false });

    // --- Detail panel ---
    const panel = document.createElement('aside');
    panel.id = 'detail-panel';
    panel.style.cssText = `
        position: fixed; top: 16px; right: 16px; width: 320px; max-height: 80vh;
        overflow-y: auto; background: ${palette.panelBg}; color: ${palette.panelText};
        border: 1px solid ${palette.border}; border-radius: 8px; padding: 16px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08); font: 13px system-ui, sans-serif;
        display: none; z-index: 10;
    `;
    panel.innerHTML = `<button id="close-detail" style="float:right;border:0;background:transparent;color:${palette.panelText};cursor:pointer;font-size:18px;line-height:1">&times;</button><div id="detail-body"><p style="opacity:.7">Click a node to see details.</p></div>`;
    document.body.appendChild(panel);

    const detailBody = panel.querySelector('#detail-body')!;
    panel.querySelector('#close-detail')!.addEventListener('click', () => {
        panel.style.display = 'none';
    });

    cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        const nodeData = node.data() as MitsuketaNode;
        detailBody.innerHTML = buildDetailHtml(nodeData, palette);
        panel.style.display = 'block';
    });

    cy.on('dbltap', 'node', (evt) => {
        // Hide/show descendants (depth-first walk via outgoing edges).
        const node = evt.target;
        const visited = new Set<string>([node.id()]);
        const stack = [node];
        const descendants: cytoscape.NodeSingular[] = [];
        while (stack.length) {
            const cur = stack.pop()!;
            const out = cur.outgoers('node');
            out.forEach((n: cytoscape.NodeSingular) => {
                if (visited.has(n.id())) return;
                visited.add(n.id());
                descendants.push(n);
                stack.push(n);
            });
        }
        if (descendants.length === 0) return;
        const allHidden = descendants.every((n) => n.style('display') === 'none');
        descendants.forEach((n) => {
            n.style('display', allHidden ? 'element' : 'none');
            n.connectedEdges().style('display', allHidden ? 'element' : 'none');
        });
    });

    // Theme toggle button
    const themeBtn = document.createElement('button');
    themeBtn.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
    themeBtn.style.cssText = `
        position: fixed; bottom: 16px; left: 16px; padding: 8px 12px;
        background: ${palette.panelBg}; color: ${palette.panelText};
        border: 1px solid ${palette.border}; border-radius: 6px; cursor: pointer;
        font: 12px system-ui, sans-serif; z-index: 10;
    `;
    themeBtn.addEventListener('click', () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        location.hash = `theme=${next}`;
        location.reload();
    });
    document.body.appendChild(themeBtn);

    // Reset view button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '⤢ Fit';
    resetBtn.style.cssText = themeBtn.style.cssText.replace('left: 16px', 'left: 88px');
    resetBtn.addEventListener('click', () => cy.fit(undefined, 60));
    document.body.appendChild(resetBtn);

    // Inject detail-panel styles
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        #detail-panel h2 { margin: 0 0 12px; font-size: 16px; line-height: 1.3; }
        #detail-panel table { width: 100%; border-collapse: collapse; font-size: 12px; }
        #detail-panel th { text-align: left; color: ${palette.edgeLabel}; font-weight: 500; padding: 4px 8px 4px 0; vertical-align: top; width: 80px; }
        #detail-panel td { padding: 4px 0; }
        #detail-panel .badges { margin: 8px 0; display: flex; gap: 6px; flex-wrap: wrap; }
        #detail-panel .badge { padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
        #detail-panel .badge-admin { background: ${palette.admin}; color: ${palette.adminBorder}; }
        #detail-panel .badge-removed { background: ${palette.removed}; color: ${palette.removedText}; }
        #detail-panel .badge-history { background: ${palette.target}; color: ${palette.targetBorder}; }
        #detail-panel .links { margin-top: 12px; font-size: 12px; }
        #detail-panel .links a { color: ${palette.nodeBorder}; text-decoration: none; }
        #detail-panel .links a:hover { text-decoration: underline; }
    `;
    document.head.appendChild(styleEl);

    cy.ready(() => cy.fit(undefined, 60));
    return cy;
}

// Expose globally for the inline <script> in graph-template.html.
(window as any).MitsuketaGraph = { render };
