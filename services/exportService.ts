// Proper export: self-contained interactive HTML for org charts,
// static print-friendly HTML report for person searches.

import { GraphNode, GraphEdge, PersonCompanyResult, CaseNote } from '../types';
import { DisqualifiedDirector } from '../src/api/disqualifiedDirectorsApi';
import { InsolvencyRecord } from '../src/api/insolvencyApi';

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
