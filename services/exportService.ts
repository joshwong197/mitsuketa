// Proper export: self-contained interactive HTML for org charts,
// static print-friendly HTML report for person searches.

import { GraphNode, GraphEdge, PersonCompanyResult, CaseNote } from '../types';
import { DisqualifiedDirector } from '../src/api/disqualifiedDirectorsApi';
import { InsolvencyRecord } from '../src/api/insolvencyApi';
import { heldFor, type MemorialEvent } from '../utils/memorials';
import {
    buildTitleView, closedVerb, formatDate, markFor, yearOf,
    type TitleReportData, type TitleView,
} from '../utils/titleReport';
import { ringsToPaths, scaleBar, tileGrid } from '../utils/tiles';
import { tileUrl } from './propertyService';

const esc = (s: unknown): string =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const nzTimestamp = (d: Date) =>
    d.toLocaleString('en-NZ', { dateStyle: 'full', timeStyle: 'long', timeZone: 'Pacific/Auckland' });

const downloadHtml = (html: string, filename: string) => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
};

const safeName = (s: string) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase();

// ---------------------------------------------------------------------------
// Interactive org chart export
// ---------------------------------------------------------------------------

export async function downloadInteractiveGraphHtml(opts: {
    title: string;
    nzbn?: string;
    searchQuery?: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
    notes?: CaseNote[]; // Case notes for this tab — viewer stamps dog-ears + lists them
}): Promise<void> {
    const [jsRes, cssRes] = await Promise.all([fetch('/export-viewer.js'), fetch('/export-viewer.css')]);
    if (!jsRes.ok || !cssRes.ok) throw new Error('Export viewer assets not found — run npm run build:export-viewer');
    // Neutralise any </script> inside the bundle so it can be inlined.
    const bundle = (await jsRes.text()).replace(/<\/script/gi, '<\\/script');
    const css = await cssRes.text();

    const payload = {
        title: opts.title,
        nzbn: opts.nzbn,
        searchQuery: opts.searchQuery,
        generatedAt: new Date().toISOString(),
        nodes: opts.nodes,
        edges: opts.edges,
        notes: opts.notes ?? [],
    };
    // < escaping keeps embedded JSON from terminating the script tag.
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Mitsuketa — ${esc(opts.title)}</title>
<style>${css}</style>
<style>html,body,#root{margin:0;height:100%;overflow:hidden}</style>
</head>
<body>
<div id="root"></div>
<script id="mitsuketa-data" type="application/json">${json}</script>
<script>${bundle}</script>
</body>
</html>`;

    downloadHtml(html, `mitsuketa-orgchart-${safeName(opts.title)}-${new Date().toISOString().split('T')[0]}.html`);
}

// ---------------------------------------------------------------------------
// Person / director report export
// ---------------------------------------------------------------------------

interface SignatureCapture {
    companyName: string;
    companyNumber: string;
    imageDataUrl: string;
}

// Same signature band as hooks/useSignatureExtractor.ts
const SIGNATURE_START_RATIO = 0.44;
const SIGNATURE_END_RATIO = 0.66;

async function extractSignatures(
    jobs: Array<{ companyNumber: string; companyName: string; pdfUrl: string }>
): Promise<SignatureCapture[]> {
    if (jobs.length === 0) return [];
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const results = await Promise.all(jobs.map(async (job) => {
        try {
            const pdf = await pdfjsLib.getDocument(job.pdfUrl).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            // Same untyped call shape as hooks/useSignatureExtractor.ts — pdfjs v5 types want `canvas`, runtime accepts canvasContext
            await page.render({ canvasContext: canvas.getContext('2d')!, viewport } as any).promise;

            const sigCanvas = document.createElement('canvas');
            const startY = Math.floor(canvas.height * SIGNATURE_START_RATIO);
            const height = Math.floor(canvas.height * SIGNATURE_END_RATIO) - startY;
            sigCanvas.width = canvas.width;
            sigCanvas.height = height;
            sigCanvas.getContext('2d')!.drawImage(canvas, 0, startY, canvas.width, height, 0, 0, canvas.width, height);

            return {
                companyName: job.companyName,
                companyNumber: job.companyNumber,
                imageDataUrl: sigCanvas.toDataURL('image/png'),
            };
        } catch {
            return null; // ponytail: a failed PDF just drops out of the report
        }
    }));
    return results.filter((r): r is SignatureCapture => r !== null);
}

async function fetchKydData(results: PersonCompanyResult[]): Promise<SignatureCapture[]> {
    const firstName = results.find((r) => r.firstName)?.firstName || '';
    const lastName = results.find((r) => r.lastName)?.lastName || '';
    const activeCompanies = results.filter(
        (r) => r.companyNumber && (r.entityStatusCode || 0) < 80 && !r.isInactive
    );
    if (!firstName || !lastName || activeCompanies.length === 0) return [];

    try {
        const res = await fetch('/api/consent-forms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName,
                lastName,
                companies: activeCompanies.map((c) => ({ companyNumber: c.companyNumber!, status: 'active' })),
            }),
        });
        if (!res.ok) return [];
        const data = await res.json();

        const jobs: Array<{ companyNumber: string; companyName: string; pdfUrl: string }> = [];
        for (const [companyNumber, link] of Object.entries(data.results || {})) {
            if (!link) continue;
            const company = results.find((r) => r.companyNumber === companyNumber);
            if (!company) continue;
            jobs.push({ companyNumber, companyName: company.companyName, pdfUrl: (link as any).url });
        }
        return await extractSignatures(jobs);
    } catch {
        return []; // report still generates without signatures
    }
}

function groupAddresses(results: PersonCompanyResult[]) {
    // Same grouping logic as KydVerificationPanel's AddressComparison
    const addrMap = new Map<string, { fullAddress: string; companies: string[] }>();
    for (const r of results) {
        if (!r.physicalAddress?.addressLines?.length) continue;
        const addr = r.physicalAddress.addressLines.join(', ');
        const full = addr + (r.physicalAddress.postCode ? `, ${r.physicalAddress.postCode}` : '');
        const key = addr.toLowerCase().replace(/\s+/g, ' ');
        const existing = addrMap.get(key);
        if (existing) existing.companies.push(r.companyName);
        else addrMap.set(key, { fullAddress: full, companies: [r.companyName] });
    }
    return Array.from(addrMap.values());
}

export async function downloadPersonReportHtml(opts: {
    personName: string;
    results: PersonCompanyResult[];
    disqualified: DisqualifiedDirector[];
    insolvency: InsolvencyRecord[];
}): Promise<void> {
    const signatures = await fetchKydData(opts.results);
    const now = new Date();
    const html = buildPersonReportHtml({ ...opts, signatures, generatedAt: now });
    downloadHtml(html, `mitsuketa-director-${safeName(opts.personName)}-${now.toISOString().split('T')[0]}.html`);
}

// Pure — also used to preview the report outside the app
export function buildPersonReportHtml(opts: {
    personName: string;
    results: PersonCompanyResult[];
    disqualified: DisqualifiedDirector[];
    insolvency: InsolvencyRecord[];
    signatures: SignatureCapture[];
    generatedAt: Date;
}): string {
    const { personName, results, disqualified, insolvency, signatures, generatedAt: now } = opts;
    const addresses = groupAddresses(results);

    const flagBlock = (disqualified.length === 0 && insolvency.length === 0)
        ? `<div class="flag clear"><strong>No adverse records found.</strong> No matches in the Disqualified Directors register or the Insolvency register for "${esc(personName)}" at the time of generation.</div>`
        : `
        ${insolvency.map((r) => `
        <div class="flag alert">
            <strong>Insolvency record — ${esc(r.insolvencyStatus)}</strong>
            <table class="kv">
                <tr><td>Estate name</td><td>${esc(r.estateName)}</td></tr>
                <tr><td>Type</td><td>${esc(r.insolvencyTypeDescription)}</td></tr>
                <tr><td>Adjudication / liquidation date</td><td>${esc(r.adjudicationOrLiquidationDate)}</td></tr>
                ${r.dischargeOrCompletionDate ? `<tr><td>Discharge / completion date</td><td>${esc(r.dischargeOrCompletionDate)}</td></tr>` : ''}
                ${r.addressAtAdjudication ? `<tr><td>Address at adjudication</td><td>${esc(r.addressAtAdjudication)}</td></tr>` : ''}
                ${r.alternateNames?.length ? `<tr><td>Alternate names</td><td>${esc(r.alternateNames.join(', '))}</td></tr>` : ''}
                ${r.multipleInsolvencies ? '<tr><td>Multiple insolvencies</td><td>Yes</td></tr>' : ''}
            </table>
        </div>`).join('')}
        ${disqualified.map((d) => `
        <div class="flag alert">
            <strong>Disqualified director — ${esc(d.firstName)} ${esc(d.middleName || '')} ${esc(d.lastName)}</strong>
            ${d.aliases?.aliases?.length ? `<p>Aliases: ${esc(d.aliases.aliases.join(', '))}</p>` : ''}
            ${(d.disqualificationCriteria?.criteria || []).map((c) => `
            <table class="kv">
                <tr><td>Period</td><td>${esc(c.startDate)}${c.endDate ? ` — ${esc(c.endDate)}` : ' — ongoing'}</td></tr>
                ${c.criteria ? `<tr><td>Criteria</td><td>${esc(c.criteria)}</td></tr>` : ''}
                ${c.comments ? `<tr><td>Comments</td><td>${esc(c.comments)}</td></tr>` : ''}
            </table>`).join('')}
            ${d.associations?.associations?.length ? `<p>Associated companies: ${esc(d.associations.associations.map((a) => a.associatedCompanyName).filter(Boolean).join(', '))}</p>` : ''}
        </div>`).join('')}`;

    const companyRows = results.map((r) => {
        const flags = [
            r.isInExternalAdmin && r.externalAdminType ? r.externalAdminType : '',
            r.removalCommenced ? 'Removal in progress' : '',
            r.hasHistoricInsolvency ? `Previously: ${r.historicInsolvencyType || 'insolvent'}` : '',
        ].filter(Boolean).join('; ');
        return `<tr${flags ? ' class="warn-row"' : ''}>
            <td>${esc(r.companyName)}</td>
            <td class="mono">${esc(r.nzbn)}</td>
            <td>${esc(r.roleType)}${r.isInactive ? ' (inactive)' : ''}</td>
            <td>${r.shareholding > 0 ? `${r.shareholding.toFixed(1)}%` : '—'}</td>
            <td>${esc(r.entityStatusDescription || r.status)}</td>
            <td>${esc(r.resignationDate || '—')}</td>
            <td>${esc(flags || '—')}</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Mitsuketa — Director Report: ${esc(personName)}</title>
<style>
    /* Sumi tokens (mirror of design/SUMI_SPEC.md §1) — self-contained, prints light */
    :root {
        color-scheme: light dark;
        --paper:    light-dark(oklch(0.952 0.007 85), oklch(0.185 0.008 75));
        --paper2:   light-dark(oklch(0.930 0.008 85), oklch(0.225 0.009 75));
        --ink:      light-dark(oklch(0.235 0.014 65), oklch(0.905 0.012 85));
        --ink-mid:  light-dark(oklch(0.44 0.012 65),  oklch(0.68 0.012 85));
        --ink-pale: light-dark(oklch(0.62 0.010 70),  oklch(0.50 0.010 80));
        --rule:     light-dark(oklch(0.855 0.008 80), oklch(0.30 0.010 75));
        --crit:     light-dark(oklch(0.55 0.17 30),  oklch(0.66 0.17 30));
        --amber:    light-dark(oklch(0.60 0.10 78),  oklch(0.72 0.10 78));
        --green:    light-dark(oklch(0.50 0.08 150), oklch(0.68 0.09 150));
        --serif:  "Shippori Mincho", "Yu Mincho", serif;
        --gothic: "Zen Kaku Gothic New", "Yu Gothic UI", "Segoe UI", system-ui, sans-serif;
        --mono:   "Cascadia Mono", Consolas, ui-monospace, monospace;
    }
    /* The toggle stamps data-theme; flipping color-scheme makes every
       light-dark() token above follow it, in both directions. */
    :root[data-theme="light"] { color-scheme: light; }
    :root[data-theme="dark"]  { color-scheme: dark; }
    ${THEME_TOGGLE_CSS}
    body { font-family: var(--gothic); color: var(--ink); margin: 0; background: var(--paper2); }
    .page { max-width: 900px; margin: 0 auto; padding: 32px; background: var(--paper); min-height: 100vh; box-sizing: border-box; }
    header { border-bottom: 2px solid var(--ink); padding-bottom: 16px; margin-bottom: 24px; }
    h1 { margin: 0 0 4px; font-size: 24px; font-family: var(--serif); font-weight: 600; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-mid); border-bottom: 1px solid var(--rule); padding-bottom: 6px; margin: 28px 0 12px; }
    .timestamp { font-weight: 600; font-size: 13px; color: var(--ink); }
    .disclaimer { font-size: 11px; color: var(--ink-pale); margin-top: 6px; }
    .flag { padding: 12px 16px; margin-bottom: 12px; font-size: 13px; }
    .flag.alert { background: oklch(from var(--crit) l c h / .08); border: 1px solid oklch(from var(--crit) l c h / .4); color: var(--crit); }
    .flag.clear { background: oklch(from var(--green) l c h / .08); border: 1px solid oklch(from var(--green) l c h / .4); color: var(--green); }
    table.kv { font-size: 12px; margin: 8px 0 0; border-collapse: collapse; }
    table.kv td { padding: 2px 12px 2px 0; vertical-align: top; }
    table.kv td:first-child { color: var(--ink-mid); white-space: nowrap; }
    table.companies { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.companies th { text-align: left; padding: 6px 8px; background: var(--paper2); border-bottom: 2px solid var(--rule); white-space: nowrap; }
    table.companies td { padding: 6px 8px; border-bottom: 1px solid var(--rule); vertical-align: top; }
    tr.warn-row td { background: oklch(from var(--amber) l c h / .10); }
    .mono { font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: 11px; }
    .addr { font-size: 13px; padding: 8px 12px; border: 1px solid var(--rule); margin-bottom: 8px; }
    .addr .who { color: var(--ink-pale); font-size: 11px; margin-top: 2px; }
    .addr-verdict { font-size: 12px; font-weight: 600; margin-bottom: 10px; }
    .addr-verdict.match { color: var(--green); } .addr-verdict.mismatch { color: var(--amber); }
    .sigs { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
    .sig { border: 1px solid var(--rule); overflow: hidden; break-inside: avoid; }
    .sig .co { font-size: 11px; font-weight: 600; padding: 4px 8px; background: var(--paper2); }
    .sig img { width: 100%; display: block; background: #fff; } /* white stays: PNG signature crops */
    footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid var(--rule); font-size: 10px; color: var(--ink-pale); }
    /* Print: white ground, ink outlines. Every tinted surface — the page wash,
       table headers, flag blocks, the address and signature panels — becomes
       white with a hairline, so a 40-company report does not lay down a solid
       page of toner. Severity squares keep their fill: they are the one thing
       whose colour carries meaning rather than decoration. */
    @media print {
        :root { color-scheme: light; }
        body, .page { background: #fff; }
        .page { max-width: none; padding: 0; }
        h2 { break-after: avoid; }
        .flag, .addr, tr { break-inside: avoid; }
        table.companies th, .sig .co, .flag, .addr, .card, .strip { background: #fff !important; }
        table.companies th { border-bottom: 1px solid #999; }
        .flag, .addr { border: 1px solid #bbb; }
    }
</style>
</head>
<body>
<div class="page">
    <header>
        <h1>Director report — ${esc(personName)}</h1>
        <div class="timestamp">Generated: ${esc(nzTimestamp(now))}</div>
        <div class="disclaimer">Point-in-time snapshot of NZ Government register data (MBIE) as at the generation date. Provided for informational purposes only. Print this page to PDF for a paginated copy.</div>
    </header>

    <h2>Register checks</h2>
    ${flagBlock}

    <h2>Associated companies (${results.length})</h2>
    <table class="companies">
        <thead><tr><th>Company</th><th>NZBN</th><th>Role</th><th>Shareholding</th><th>Status</th><th>Resigned</th><th>Flags</th></tr></thead>
        <tbody>${companyRows}</tbody>
    </table>

    ${addresses.length > 0 ? `
    <h2>Known addresses (KYD)</h2>
    <div class="addr-verdict ${addresses.length === 1 ? 'match' : 'mismatch'}">
        ${addresses.length === 1 ? '✓ All company records use the same address' : `⚠ ${addresses.length} different addresses on record`}
    </div>
    ${addresses.map((a) => `
    <div class="addr">
        <div>${esc(a.fullAddress)}</div>
        <div class="who">Used by ${a.companies.length} compan${a.companies.length === 1 ? 'y' : 'ies'}: ${esc(a.companies.join(', '))}</div>
    </div>`).join('')}` : ''}

    ${signatures.length > 0 ? `
    <h2>Signatures from consent forms (KYD)</h2>
    <div class="sigs">
        ${signatures.map((s) => `
        <div class="sig">
            <div class="co">${esc(s.companyName)} · #${esc(s.companyNumber)}</div>
            <img src="${s.imageDataUrl}" alt="Signature from ${esc(s.companyName)}" />
        </div>`).join('')}
    </div>` : ''}

    <footer>Mitsuketa 見つけた · Generated ${esc(nzTimestamp(now))} · Data sourced from NZ Government registers (MBIE)</footer>
</div>
${THEME_TOGGLE_HTML}
${THEME_TOGGLE_JS}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 地 Title report export — static, self-contained HTML
// ---------------------------------------------------------------------------
//
// Built from the SAME view model the on-screen report uses
// (utils/titleReport.ts), so the file cannot drift from the app. The export is
// deliberately unfiltered: whatever the screen is showing, the document carries
// the full memorial set, because a filtered report is a misleading record.

/**
 * The parcel map, rendered to a standalone SVG with its aerial tiles inlined as
 * data URIs — the export has to survive being emailed, so it cannot reference
 * /api/property for imagery. Tiles that fail are simply omitted; the outline and
 * the rest of the mosaic still read.
 */
async function buildMapSvg(report: TitleReportData & {
    geometry?: { type: string; coordinates: any } | null;
    bbox?: [number, number, number, number] | null;
}): Promise<string> {
    const { geometry, bbox } = report;
    if (!geometry || !bbox) return '';

    const width = 640;
    const height = 300;

    const fetchTiles = async (grid: ReturnType<typeof tileGrid>) =>
        Promise.all(grid.tiles.map(async t => {
            try {
                const resp = await fetch(tileUrl(t.z, t.x, t.y), { credentials: 'same-origin' });
                if (!resp.ok) return '';
                const blob = await resp.blob();
                const data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () => reject(reader.error);
                    reader.readAsDataURL(blob);
                });
                return `<image x="${t.left}" y="${t.top}" width="256" height="256" href="${esc(data)}"/>`;
            } catch {
                return '';
            }
        }));

    // Same zoom-out search as TitleMap: LINZ holds imagery to different depths
    // in different places, so a grid can come back wholly empty at the natural
    // fit and be fine a level out. Without this the export would silently drop
    // the map the screen is showing.
    let grid = tileGrid(bbox, width, height);
    let images = await fetchTiles(grid);
    for (let step = 1; step <= 4 && images.every(i => !i); step++) {
        grid = tileGrid(bbox, width, height, 20, step);
        images = await fetchTiles(grid);
    }
    if (images.every(i => !i)) return '';

    const paths = ringsToPaths(geometry, grid);
    const bar = scaleBar((bbox[1] + bbox[3]) / 2, grid.z);

    return `<figure class="map">
  <svg viewBox="0 0 ${width} ${height}" width="100%" preserveAspectRatio="none" role="img"
       aria-label="Title boundary on aerial imagery">
    <rect width="${width}" height="${height}" fill="#e9e6e0"/>
    ${images.join('')}
    ${paths.map(d => `<path d="${d}" fill="none" stroke="#f3f1ed" stroke-width="4.5" opacity=".65"/>
    <path d="${d}" fill="#2f3f6b" fill-opacity=".14" stroke="#2f3f6b" stroke-width="2" stroke-linejoin="round"/>`).join('')}
    <g transform="translate(12 ${height - 20})">
      <rect x="-4" y="-11" width="${bar.px + 52}" height="22" fill="#f3f1ed" opacity=".82"/>
      <path d="M0,-4 L0,3 M0,0 L${bar.px},0 M${bar.px},-4 L${bar.px},3" stroke="#2e2b26" stroke-width="1.2" fill="none"/>
      <text x="${bar.px + 7}" y="4" fill="#2e2b26"
            style="font-family:'Cascadia Mono',Consolas,ui-monospace,monospace;font-size:11px">${bar.metres} m</text>
    </g>
  </svg>
  <figcaption>Title boundary over aerial imagery ·
    <a href="https://basemaps.linz.govt.nz/">LINZ Basemaps</a> CC BY 4.0.
    Imagery date varies by region and may predate recent works.</figcaption>
</figure>`;
}

export async function downloadTitleReportHtml(report: TitleReportData): Promise<void> {
    const now = new Date();
    const view = buildTitleView(report);
    const map = await buildMapSvg(report);
    const html = buildTitleReportHtml(view, now, map);
    downloadHtml(html, `mitsuketa-title-${safeName(view.titleNo)}-${now.toISOString().split('T')[0]}.html`);
}


/**
 * Theme toggle for the standalone HTML reports.
 *
 * Both reports use light-dark() against `color-scheme`, so with no toggle they
 * silently follow the reader's OS — which is why a report opened on a dark
 * desktop arrived dark with no way back. Setting data-theme on :root flips
 * color-scheme explicitly and every token follows, the same mechanism index.css
 * uses. Default stays "whatever the OS says"; the button is an override.
 *
 * The label names what you will GET, not what you are looking at.
 */
const THEME_TOGGLE_CSS = `
.theme-btn{position:fixed;top:12px;right:12px;z-index:50;font:inherit;font-size:11px;
 letter-spacing:.06em;text-transform:uppercase;padding:5px 11px;cursor:pointer;
 background:var(--paper);color:var(--ink-mid);border:1px solid var(--rule)}
.theme-btn:hover{border-color:var(--ink-mid);color:var(--ink)}
.theme-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media print{.theme-btn{display:none}}`;

const THEME_TOGGLE_HTML = '<button type="button" class="theme-btn" id="themeBtn">Dark</button>';

const THEME_TOGGLE_JS = `<script>
(function(){
  var b=document.getElementById('themeBtn');if(!b)return;
  function current(){
    return document.documentElement.dataset.theme
      || (window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  }
  function paint(){var c=current();b.textContent=c==='dark'?'Light':'Dark';
    b.setAttribute('aria-label','Switch to '+(c==='dark'?'light':'dark')+' theme');}
  b.addEventListener('click',function(){
    document.documentElement.dataset.theme=current()==='dark'?'light':'dark';paint();});
  paint();
})();
</script>`;

const TONE_HEX: Record<string, string> = {
    accent: '#2f3f6b', green: '#3f6b4f', amber: '#8a6a2a', ink: '#2e2b26', wash: '#b6b1a8',
};
const TONE_FG_HEX: Record<string, string> = {
    accent: '#f4f2ee', green: '#f4f2ee', amber: '#f4f2ee', ink: '#f4f2ee', wash: '#2e2b26',
};
// The export is a fixed light document, so unlike the app the glyph colours do
// not need to flip with a theme — but the ink-wash ground still needs dark ink.

const mark = (e: MemorialEvent): string => {
    const { glyph, tone } = markFor(e);
    return `<span class="sq" style="background:${TONE_HEX[tone]};color:${TONE_FG_HEX[tone]}">${esc(glyph)}</span>`;
};


// Pure — also used to preview the report outside the app
export function buildTitleReportHtml(view: TitleView, now: Date, mapSvg = ''): string {
    const isLive = (view.status ?? '').toLowerCase().startsWith('live');

    const eventRow = (e: MemorialEvent) => `
    <article class="ev" data-ts="${e.date ? e.date.getTime() : ''}" data-cat="${esc(e.category)}"
             data-live="${e.current ? '1' : '0'}" data-year="${esc(yearOf(e))}">
      <div class="ev-when">${esc(formatDate(e.date, e.undated))}</div>
      <div class="ev-body">
        <h4>${mark(e)}<span>${esc(e.headline)}</span>
          ${e.current ? '<em class="live">Live</em>' : ''}
          ${e.closed_by ? `<em>${esc(closedVerb(e))} · ${esc(heldFor(e))}</em>` : ''}
          ${e.instrument ? `<em class="instr">${esc(e.instrument)}</em>` : ''}
        </h4>
        <p class="note">${esc(e.commentary)}</p>
        <p class="memo">${esc(e.text || '(no memorial text)')}</p>
        ${(e.notations ?? []).map(n => `<p class="memo faint">${esc(n)}</p>`).join('')}
      </div>
    </article>`;

    const CATEGORY_LABELS: Record<string, string> = {
        mortgage: 'Mortgage', discharge: 'Discharge', transfer: 'Transfer',
        caveat: 'Caveat', lease: 'Lease', other: 'Other',
    };
    // Only offer filters for what is actually on this title — a chip that always
    // yields nothing is worse than no chip.
    const presentCats = [...new Set(view.chronology.map(e => e.category))]
        .sort((a, b) => (CATEGORY_LABELS[a] ?? a).localeCompare(CATEGORY_LABELS[b] ?? b));
    const liveCount = view.chronology.filter(e => e.current).length;

    // Progressive enhancement: the document is complete and correctly ordered
    // without scripting, and the controls only appear once the script runs.
    const controls = view.chronology.length < 2 ? '' : `
    <div class="ctl" id="ctl" hidden>
      <div class="ctl-row">
        <span class="ctl-lbl">Order</span>
        <button type="button" class="chip" data-sort="desc" aria-pressed="true">Newest first</button>
        <button type="button" class="chip" data-sort="asc" aria-pressed="false">Oldest first</button>
      </div>
      <div class="ctl-row">
        <span class="ctl-lbl">Show</span>
        <button type="button" class="chip" data-all aria-pressed="true">All ${view.chronology.length}</button>
        ${liveCount ? `<button type="button" class="chip" data-live-only aria-pressed="false">Live only ${liveCount}</button>` : ''}
        ${presentCats.map(c => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="false">${esc(CATEGORY_LABELS[c] ?? c)}</button>`).join('')}
      </div>
      <p class="ctl-count" id="ctlCount"></p>
    </div>`;

    let lastYear: string | null = null;
    const chronology = view.chronology.map(e => {
        const y = yearOf(e);
        const heading = y === lastYear ? '' : `<div class="ev-year" data-yearhead><span>${esc(y)}</span></div>`;
        lastYear = y;
        return heading + eventRow(e);
    }).join('');

    const entry = (e: MemorialEvent, extra = '') => `
      <div class="entry">${mark(e)}
        <div class="entry-main"><div class="entry-name">${esc(e.headline)}</div>
          <div class="entry-sub">${esc([e.instrument, formatDate(e.date, e.undated)].filter(Boolean).join(' · '))}</div>
        </div>${extra}
      </div>`;

    const section = (m: string, title: string, count: string, body: string) => `
    <section class="sec">
      <span class="sec-mark">${m}</span>
      <h3 class="sec-head"><span>${esc(title)}</span>${count ? `<b>${count}</b>` : ''}</h3>
      ${body}
    </section>`;

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(view.titleNo)} — Record of title — Mitsuketa</title>
<style>
:root{
 color-scheme:light dark;
 /* Was light-only hex. Paired so the reader can switch, since a report opened on
    a dark desktop should not be stuck bright — print still forces light below. */
 --paper:light-dark(#f3f1ed,#211f1c);--ink:light-dark(#2e2b26,#e6e2d9);
 --ink-mid:light-dark(#5f5a52,#a8a29a);--ink-pale:light-dark(#8c8579,#7d776e);
 --ink-wash:light-dark(#c3bdb2,#4a453f);--rule:light-dark(#dcd8d0,#3a352f);
 --accent:light-dark(#2f3f6b,#93a5d6);--accent-ink:light-dark(#f4f2ee,#211f1c);
 --margin:84px;--gap:22px}
:root[data-theme="light"]{color-scheme:light}
:root[data-theme="dark"]{color-scheme:dark}
${THEME_TOGGLE_CSS}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--paper);color:var(--ink);font-size:14px;line-height:1.6;
 font-family:"Zen Kaku Gothic New","Yu Gothic UI","Segoe UI",system-ui,sans-serif}
.serif{font-family:"Shippori Mincho","Yu Mincho","Hiragino Mincho ProN",serif}
.mono,.ev-when,.entry-sub,.memo,.instr,b,.sec-head b{font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;
 font-variant-numeric:tabular-nums}
.doc{max-width:880px;margin:0 auto;padding:34px 26px 72px}
/* Masthead */
.mast{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;
 border-bottom:2px solid var(--ink);padding-bottom:14px}
.rule2{border-top:1px solid var(--ink);margin-bottom:30px}
.sup{font-size:11.5px;color:var(--ink-pale);margin:0 0 4px}
.sup em{font-family:"Shippori Mincho","Yu Mincho",serif;font-style:normal;letter-spacing:.2em;
 margin-right:8px;color:var(--ink-mid)}
h1{font-family:"Shippori Mincho","Yu Mincho",serif;font-size:42px;font-weight:600;margin:0;
 line-height:1.05;letter-spacing:.01em;font-variant-numeric:tabular-nums}
.addr{font-size:14px;margin:8px 0 0}
.meta{font-size:12.5px;color:var(--ink-mid);margin:3px 0 0}
.stampwrap{display:flex;flex-direction:column;align-items:center;gap:7px;padding-top:4px}
.hanko{display:grid;place-items:center;width:46px;height:46px;background:var(--accent);
 color:var(--accent-ink);font-family:"Shippori Mincho","Yu Mincho",serif;font-size:25px;line-height:1;
 box-shadow:inset 0 0 14px rgba(0,0,0,.22)}
.hanko.stamp{transform:rotate(-7deg);width:42px;height:42px;font-size:21px}
.status{font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;font-size:9.5px;
 letter-spacing:.1em;text-transform:uppercase;color:var(--ink-pale)}
.status.on{color:var(--accent)}
/* Spine */
.body{position:relative;padding-left:calc(var(--margin) + var(--gap))}
.body::before{content:"";position:absolute;left:var(--margin);top:4px;bottom:0;width:1px;background:var(--rule)}
.sec{position:relative;margin-top:34px}
.sec:first-child{margin-top:0}
.sec-mark{position:absolute;left:calc((var(--margin) + var(--gap)) * -1);top:0;width:var(--margin);
 text-align:right;font-family:"Shippori Mincho","Yu Mincho",serif;font-size:15px;line-height:1.45;
 letter-spacing:.12em;color:var(--accent)}
.sec-head{font-family:"Shippori Mincho","Yu Mincho",serif;font-size:16.5px;font-weight:600;
 margin:0 0 12px;padding-bottom:6px;border-bottom:1px solid var(--ink-wash);
 display:flex;justify-content:space-between;align-items:baseline;gap:14px}
.sec-head b{font-size:11px;font-weight:400;color:var(--ink-pale)}
/* Ledger */
dl{display:grid;grid-template-columns:152px minmax(0,1fr);margin:0}
dt,dd{margin:0;padding:7px 0;border-top:1px solid var(--rule);font-size:13px}
dt{color:var(--ink-pale);padding-right:18px;text-align:right;font-size:12px}
dt:first-of-type,dt:first-of-type + dd{border-top:none}
/* Entries */
.entry{display:flex;align-items:baseline;gap:13px;padding:10px 0;border-top:1px solid var(--rule)}
.entry:first-of-type{border-top:none}
.entry-main{flex:1;min-width:0}
.entry-name{display:block;font-size:13.5px;font-weight:600}
.entry-sub{display:block;font-size:10.5px;color:var(--ink-pale);margin-top:2px}
.avatar{display:grid;place-items:center;width:30px;height:30px;flex:none;border:1px solid var(--accent);
 color:var(--accent);font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;font-size:11px;
 align-self:flex-start}
.tag{font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;font-size:10px;letter-spacing:.06em;
 text-transform:uppercase;color:var(--ink-pale);white-space:nowrap}
.tag.on{color:var(--accent)}
.sq{display:inline-grid;place-items:center;width:19px;height:19px;flex:none;align-self:flex-start;
 font-family:"Shippori Mincho","Yu Mincho",serif;font-size:12px;line-height:1}
/* Chronology controls — only shown once the script enables them */
.ctl{margin:0 0 18px;display:flex;flex-direction:column;gap:7px}
.ctl-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.ctl-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-pale);margin-right:4px}
.chip{font:inherit;font-size:11.5px;padding:3px 10px;border:1px solid var(--rule);background:var(--paper);
 color:var(--ink-mid);cursor:pointer;border-radius:0}
.chip:hover{border-color:var(--ink-mid);color:var(--ink)}
.chip[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ctl-count{margin:0;font-size:11px;color:var(--ink-pale)}
.ev[hidden]{display:none}
@media print{.ctl{display:none}}

/* Chronology */
.ev{position:relative;border-top:1px solid var(--rule);padding:12px 0}
.ev-when{position:absolute;left:calc((var(--margin) + var(--gap)) * -1);top:13px;width:var(--margin);
 padding-right:18px;text-align:right;font-size:10.5px;color:var(--ink-pale)}
.ev h4{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin:0;font-size:13.5px;font-weight:600}
.ev h4 .sq{width:16px;height:16px;font-size:10px;align-self:center}
.ev em{font-style:normal;font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;font-size:10px;
 letter-spacing:.06em;text-transform:uppercase;color:var(--ink-pale)}
.ev em.live{color:var(--accent)}
.ev em.instr{text-transform:none;letter-spacing:0;font-size:10.5px}
.note{font-size:12px;color:var(--ink-mid);margin:4px 0 0;max-width:64ch}
.memo{font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;font-size:11px;line-height:1.6;
 white-space:pre-wrap;color:var(--ink-mid);border-left:2px solid var(--rule);padding-left:12px;margin:8px 0 0}
.memo.faint{color:var(--ink-pale);font-size:10.5px}
.ev-year{position:relative;margin:26px 0 0;font-family:"Shippori Mincho","Yu Mincho",serif;
 font-size:13px;letter-spacing:.1em;color:var(--ink-mid)}
.ev-year::before{content:"";position:absolute;left:calc((var(--margin) + var(--gap)) * -1);right:0;
 top:50%;height:1px;background:var(--ink-wash)}
.ev-year span{position:relative;background:var(--paper);padding-right:12px}
.ev-year + .ev{border-top:none}
.hint{font-size:11.5px;color:var(--ink-pale);margin:-4px 0 8px;max-width:64ch}
.map{margin:0}
.map svg{display:block;border:1px solid var(--rule);background:#e9e6e0}
.map figcaption{font-size:10.5px;color:var(--ink-pale);margin-top:5px;line-height:1.5}
.map a{color:inherit}
.colophon{font-size:11px;line-height:1.65;color:var(--ink-pale);margin-top:40px;
 border-top:1px solid var(--ink-wash);padding-top:14px;max-width:78ch}
.colophon em{font-family:"Shippori Mincho","Yu Mincho",serif;font-style:normal;letter-spacing:.18em;
 margin-right:8px;color:var(--ink-mid)}
.colophon p{margin:0 0 7px}
@media (max-width:700px){
 .doc{padding:24px 18px 60px}
 .body{padding-left:0}.body::before{display:none}
 .sec-mark{position:static;width:auto;text-align:left;display:block;margin-bottom:2px}
 dl{grid-template-columns:minmax(0,1fr)}
 dt{text-align:left;padding:8px 0 0}dd{padding:1px 0 8px;border-top:none}
 dt:first-of-type + dd{border-top:none}
 .ev-when{position:static;display:block;width:auto;padding-right:0;text-align:left;margin-bottom:3px}
 .ev-year::before{left:0}
 h1{font-size:32px}}
/* Print: drop every tinted ground so a long chronology does not cost a
   cartridge. Severity squares keep their fill — that colour is the meaning.
   Controls are hidden (they do nothing on paper) and events avoid splitting. */
@media print{
 :root{color-scheme:light}
 body,.doc,.sec,.ev,.entry,.fact{background:#fff !important}
 .memo{border-left-color:#999}
 .ctl{display:none}
 .ev,.entry{break-inside:avoid}
 .sec-head,.ev-year{break-after:avoid}
 .ev-year span{background:#fff}
}
</style></head>
<body><div class="doc">

<header class="mast">
  <div style="min-width:0;flex:1">
    <p class="sup"><em>登記簿</em>Record of title · LINZ Title Register</p>
    <h1>${esc(view.titleNo)}</h1>
    ${view.address ? `<p class="addr">${esc(view.address)}</p>` : ''}
    <p class="meta">${esc(view.meta)}</p>
  </div>
  <div class="stampwrap">
    <div class="hanko${isLive ? ' stamp' : ''}">${isLive ? '現' : '地'}</div>
    <div class="status${isLive ? ' on' : ''}">${esc(view.status ?? 'Status unknown')}</div>
  </div>
</header>
<div class="rule2"></div>

<div class="body">
${mapSvg ? section('地図', 'Parcel', '', mapSvg) : ''}

${section('登記', 'Register detail', '', `<dl>${view.facts.map(f =>
    `<dt>${esc(f.label)}</dt><dd${f.mono ? ' class="mono"' : ''}>${esc(f.value)}</dd>`).join('')}</dl>`)}

${view.owners.length === 0 ? '' : section('所有',
    `Registered owner${view.owners.length === 1 ? '' : 's'}`, String(view.owners.length),
    view.owners.map(o => `<div class="entry">
      <div class="avatar">${esc(o.initials)}</div>
      <div class="entry-main"><div class="entry-name">${esc(o.name)}</div>
        <div class="entry-sub">${esc([o.shares.length ? `Share ${o.shares.join(', ')}` : null, ...o.estateLines].filter(Boolean).join(' · ') || '—')}</div>
      </div>
      <span class="tag">${o.corporate ? 'Corporation' : 'Individual'}</span>
    </div>`).join(''))}

${section('現況', 'Currently registered', String(view.live.length),
    view.live.length === 0
        ? '<p class="note">No live mortgages, caveats or leases on this title.</p>'
        : view.live.map(e => entry(e)).join(''))}

${section('履歴', 'History', `${view.chronology.length} dealing${view.chronology.length === 1 ? '' : 's'}`,
    controls + `<div id="chron">${chronology}</div>` || '<p class="note">No dated dealings on this title.</p>')}

${view.burdens.length === 0 ? '' : section('負担', 'Standing burdens', String(view.burdens.length),
    '<p class="hint">Easements, covenants and statutory conditions. These sit on the land indefinitely rather than happening at a moment.</p>'
    + view.burdens.map(e => entry(e, e.current ? '<span class="tag on">Live</span>' : '')).join(''))}
</div>

<div class="colophon">
  <p><em>注記</em>Reference copy of the LINZ Title Register, not a title search. It may lag the
  register and is not legal advice. Every line above is taken from the register\'s own fields — no
  interpretation has been added. Obtain a formal search from LINZ before relying on it.</p>
  <p>This document contains personal information supplied under the LINZ Licence for Personal Data.
  Handle it in line with the Privacy Act 2020 and do not pass it to anyone who has not accepted
  equivalent terms.</p>
  <p>Generated ${esc(nzTimestamp(now))} · Mitsuketa 見つけた</p>
</div>

</div>
<script>
/* Chronology sort + filter. The document is already complete and correctly
   ordered without this — the controls stay hidden unless the script runs, so a
   print or a no-script viewer sees the full record rather than a broken one.
   Year separators are regenerated after every change, because sorting or
   filtering makes the server-rendered ones wrong. */
(function () {
  var ctl = document.getElementById('ctl'), chron = document.getElementById('chron');
  if (!ctl || !chron) return;
  var rows = [].slice.call(chron.querySelectorAll('.ev'));
  if (rows.length < 2) return;
  ctl.hidden = false;

  var count = document.getElementById('ctlCount');
  var sortBtns = [].slice.call(ctl.querySelectorAll('[data-sort]'));
  var catBtns = [].slice.call(ctl.querySelectorAll('[data-cat]'));
  var allBtn = ctl.querySelector('[data-all]');
  var liveBtn = ctl.querySelector('[data-live-only]');
  var dir = 'desc', cats = {}, liveOnly = false;

  function press(btn, on) { if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function anyCat() { for (var k in cats) if (cats[k]) return true; return false; }

  function apply() {
    // An undated dealing has no timestamp; keep those last in either direction
    // rather than letting them sort as 1970.
    var order = rows.slice().sort(function (a, b) {
      var x = a.getAttribute('data-ts'), y = b.getAttribute('data-ts');
      if (!x && !y) return 0;
      if (!x) return 1;
      if (!y) return -1;
      return dir === 'desc' ? (+y) - (+x) : (+x) - (+y);
    });

    [].slice.call(chron.querySelectorAll('[data-yearhead]')).forEach(function (h) { h.remove(); });

    var shown = 0, lastYear = null, frag = document.createDocumentFragment();
    order.forEach(function (row) {
      var okCat = !anyCat() || cats[row.getAttribute('data-cat')];
      var okLive = !liveOnly || row.getAttribute('data-live') === '1';
      var visible = okCat && okLive;
      row.hidden = !visible;
      if (visible) {
        var y = row.getAttribute('data-year');
        if (y !== lastYear) {
          var h = document.createElement('div');
          h.className = 'ev-year';
          h.setAttribute('data-yearhead', '');
          h.innerHTML = '<span></span>';
          h.firstChild.textContent = y;
          frag.appendChild(h);
          lastYear = y;
        }
        shown++;
      }
      frag.appendChild(row);
    });
    chron.appendChild(frag);

    press(allBtn, !anyCat() && !liveOnly);
    count.textContent = shown === rows.length
      ? 'Showing all ' + rows.length + ' dealings'
      : 'Showing ' + shown + ' of ' + rows.length + ' dealings';
  }

  sortBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      dir = b.getAttribute('data-sort');
      sortBtns.forEach(function (o) { press(o, o === b); });
      apply();
    });
  });
  catBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var c = b.getAttribute('data-cat');
      cats[c] = !cats[c];
      press(b, cats[c]);
      apply();
    });
  });
  if (liveBtn) liveBtn.addEventListener('click', function () {
    liveOnly = !liveOnly; press(liveBtn, liveOnly); apply();
  });
  if (allBtn) allBtn.addEventListener('click', function () {
    cats = {}; liveOnly = false;
    catBtns.forEach(function (o) { press(o, false); });
    press(liveBtn, false);
    apply();
  });

  apply();
})();
</script>
${THEME_TOGGLE_HTML}
${THEME_TOGGLE_JS}
</body></html>`;
}
