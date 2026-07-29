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
    @media print {
        :root { color-scheme: light; }
        body { background: var(--paper); }
        .page { max-width: none; padding: 0; }
        h2 { break-after: avoid; }
        .flag, .addr, tr { break-inside: avoid; }
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

export async function downloadTitleReportHtml(report: TitleReportData): Promise<void> {
    const now = new Date();
    const view = buildTitleView(report);
    const html = buildTitleReportHtml(view, now);
    downloadHtml(html, `mitsuketa-title-${safeName(view.titleNo)}-${now.toISOString().split('T')[0]}.html`);
}

const TONE_HEX: Record<string, string> = {
    accent: '#2f3f6b', green: '#3f6b4f', amber: '#8a6a2a', ink: '#2e2b26', wash: '#b6b1a8',
};
const TONE_FG_HEX: Record<string, string> = {
    accent: '#f4f2ee', green: '#f4f2ee', amber: '#f4f2ee', ink: '#f4f2ee', wash: '#2e2b26',
};

const mark = (e: MemorialEvent): string => {
    const { glyph, tone } = markFor(e);
    return `<span class="sq" style="background:${TONE_HEX[tone]};color:${TONE_FG_HEX[tone]}">${esc(glyph)}</span>`;
};

// Pure — also used to preview the report outside the app
export function buildTitleReportHtml(view: TitleView, now: Date): string {
    const eventRow = (e: MemorialEvent) => `
    <article class="ev">
      <div class="ev-when">${esc(formatDate(e.date, e.undated))}</div>
      <div class="ev-body">
        <h4>${mark(e)} ${esc(e.headline)}
          ${e.current ? '<span class="badge live">Live</span>' : ''}
          ${e.closed_by ? `<span class="badge">${esc(closedVerb(e))} · ${esc(heldFor(e))}</span>` : ''}
          ${e.batch_size && e.batch_size > 1 ? `<span class="badge">Batch of ${e.batch_size}</span>` : ''}
        </h4>
        <p class="commentary">${esc(e.commentary)}</p>
        <pre class="memo">${esc(e.text || '(no memorial text)')}</pre>
        ${(e.notations ?? []).map(n => `<pre class="memo note">${esc(n)}</pre>`).join('')}
      </div>
    </article>`;

    let lastYear: string | null = null;
    const chronology = view.chronology.map(e => {
        const y = yearOf(e);
        const heading = y === lastYear ? '' : `<div class="year">${esc(y)}</div>`;
        lastYear = y;
        return heading + eventRow(e);
    }).join('');

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(view.titleNo)} — LINZ title report — Mitsuketa</title>
<style>
:root{--paper:#f3f1ed;--paper2:#e9e6e0;--ink:#2e2b26;--ink-mid:#5f5a52;--ink-pale:#8c8579;
--rule:#d6d2ca;--accent:#2f3f6b}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--paper);color:var(--ink);font-size:14px;line-height:1.6;
 font-family:"Zen Kaku Gothic New","Yu Gothic UI","Segoe UI",system-ui,sans-serif}
.mono,.memo,.ev-when,.eyebrow,.badge,.sq{font-variant-numeric:tabular-nums}
.mono,.memo,.ev-when,.eyebrow,.badge{font-family:"Cascadia Mono",Consolas,ui-monospace,monospace}
.page{max-width:900px;margin:0 auto;padding:32px 22px 70px}
.mast{display:flex;gap:14px;align-items:flex-start;border-bottom:1px solid var(--rule);
 padding-bottom:16px;margin-bottom:18px}
.hanko{width:34px;height:34px;flex:none;background:var(--accent);color:#f4f2ee;display:grid;
 place-items:center;font-family:"Shippori Mincho","Yu Mincho",serif;font-size:19px;margin-top:5px}
h1{font-family:"Shippori Mincho","Yu Mincho",serif;font-size:34px;font-weight:600;margin:0;
 line-height:1.1;letter-spacing:.01em}
.meta{color:var(--ink-mid);font-size:12.5px;margin:5px 0 0}
.addr{font-size:13px;margin:6px 0 0}
.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-pale);
 margin:24px 0 8px}
.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--rule)}
.fact{padding:9px 13px;border-left:1px solid var(--rule);border-top:1px solid var(--rule)}
.fact:nth-child(3n+1){border-left:none}
.fact:nth-child(-n+3){border-top:none}
.fact .k{font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;font-size:9px;
 text-transform:uppercase;letter-spacing:.09em;color:var(--ink-pale)}
.fact .v{font-size:12.5px;margin-top:3px}
.block{border:1px solid var(--rule)}
.row{display:flex;align-items:center;gap:14px;padding:11px 14px;border-top:1px solid var(--rule)}
.row:first-child{border-top:none}
.row .grow{flex:1;min-width:0}
.row .nm{font-size:13px;font-weight:600}
.row .sub{font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;font-size:10.5px;
 color:var(--ink-pale);margin-top:2px}
.avatar{width:34px;height:34px;flex:none;border:1px solid var(--accent);color:var(--accent);
 display:grid;place-items:center;font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;font-size:12px}
.sq{display:inline-grid;place-items:center;width:17px;height:17px;flex:none;
 font-family:"Shippori Mincho","Yu Mincho",serif;font-size:11px;vertical-align:middle}
.badge{font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;padding:1px 6px;
 border:1px solid var(--rule);color:var(--ink-pale);white-space:nowrap;margin-left:7px}
.badge.live{border-color:var(--accent);color:var(--accent)}
.year{font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;font-size:11px;
 letter-spacing:.08em;color:var(--ink-pale);margin:20px 0 2px}
.ev{display:flex;gap:16px;border-top:1px solid var(--rule);padding:13px 0}
.year + .ev{border-top:none}
.ev-when{width:96px;flex:none;font-size:11px;color:var(--ink-pale)}
.ev-body{flex:1;min-width:0}
.ev h4{margin:0;font-size:13.5px;font-weight:600}
.commentary{font-size:12px;color:var(--ink-mid);margin:5px 0 0}
.memo{font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;font-size:11px;
 white-space:pre-wrap;color:var(--ink-mid);background:var(--paper2);border:1px solid var(--rule);
 padding:8px 10px;margin:7px 0 0;overflow-x:auto}
.memo.note{color:var(--ink-pale);font-size:10.5px}
.foot{border-top:1px solid var(--rule);margin-top:26px;padding-top:14px;font-size:11px;
 color:var(--ink-pale);line-height:1.6}
@media (max-width:720px){.facts{grid-template-columns:repeat(2,minmax(0,1fr))}
 .fact:nth-child(3n+1){border-left:1px solid var(--rule)}
 .fact:nth-child(-n+3){border-top:1px solid var(--rule)}
 .fact:nth-child(2n+1){border-left:none}
 .fact:nth-child(-n+2){border-top:none}
 .ev{flex-direction:column;gap:3px}.ev-when{width:auto}}
@media print{body{background:#fff}.memo{background:#fff}}
</style></head>
<body><div class="page">

<div class="mast">
  <div class="hanko">地</div>
  <div>
    <h1>${esc(view.titleNo)}</h1>
    <p class="meta">${esc(view.meta)}</p>
    ${view.address ? `<p class="addr">${esc(view.address)}</p>` : ''}
  </div>
</div>

<div class="eyebrow" style="margin-top:0">Register detail</div>
<div class="facts">
  ${view.facts.map(f => `<div class="fact"><div class="k">${esc(f.label)}</div>
    <div class="v${f.mono ? ' mono' : ''}">${esc(f.value)}</div></div>`).join('')}
</div>

${view.owners.length === 0 ? '' : `
<div class="eyebrow">Registered owner${view.owners.length === 1 ? '' : 's'}</div>
<div class="block">
  ${view.owners.map(o => `<div class="row">
    <div class="avatar">${esc(o.initials)}</div>
    <div class="grow"><div class="nm">${esc(o.name)}</div>
      <div class="sub">${esc([o.shares.length ? `Share ${o.shares.join(', ')}` : null, ...o.estateLines].filter(Boolean).join(' · ') || '—')}</div></div>
    <span class="badge">${o.corporate ? 'Corporation' : 'Individual'}</span>
  </div>`).join('')}
</div>`}

<div class="eyebrow">Currently registered — ${view.live.length}</div>
${view.live.length === 0
    ? '<div class="block"><div class="row">Nothing is currently registered against this title.</div></div>'
    : `<div class="block">${view.live.map(e => `<div class="row">
        ${mark(e)}
        <div class="grow"><div class="nm">${esc(e.headline)}</div>
          <div class="sub">${esc([e.instrument, formatDate(e.date, e.undated)].filter(Boolean).join(' · '))}</div></div>
      </div>`).join('')}</div>`}

<div class="eyebrow">Chronology — ${view.chronology.length} dealing${view.chronology.length === 1 ? '' : 's'}</div>
${chronology || '<p class="commentary">No dated dealings on this title.</p>'}

${view.burdens.length === 0 ? '' : `
<div class="eyebrow">Standing burdens — ${view.burdens.length}</div>
<div class="block">
  ${view.burdens.map(e => `<div class="row">
    ${mark(e)}
    <div class="grow"><div class="nm">${esc(e.headline)}</div>
      <div class="sub">${esc(e.instrument ?? '')}</div></div>
    ${e.current ? '<span class="badge live">Live</span>' : ''}
    <span class="sub">${e.date ? e.date.getUTCFullYear() : '—'}</span>
  </div>`).join('')}
</div>`}

<div class="foot">
  <p>Generated ${esc(nzTimestamp(now))} · LINZ Title Register via the LINZ Data Service.</p>
  <p>Reference copy of the LINZ Title Register, not a title search. It may lag the register and is
  not legal advice. Every line above is taken from the register's own fields — no interpretation
  has been added. Obtain a formal search from LINZ before relying on this document.</p>
  <p>This document contains personal information supplied under the LINZ Licence for Personal Data.
  Handle it in line with the Privacy Act 2020 and do not pass it to anyone who has not accepted
  equivalent terms.</p>
</div>

</div></body></html>`;
}
