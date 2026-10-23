import { jsPDF } from 'jspdf';
// Liberation Sans ships with pdfjs-dist (SIL Open Font License). Embedding it gives
// the PDF macrons (Tānui, Ōtāhuhu), which the built-in PDF fonts cannot print.
import regularUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url';
import boldUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url';

// A text-first A4 report: heading, warnings, sections of rows, notices. Built
// from data in the browser, so it needs no server and its text stays selectable.

export type Tone = 'crit' | 'warn' | 'mute';
export interface PdfRow { text: string; sub?: string; right?: string; tone?: Tone; url?: string }
export interface PdfSection { title: string; aside?: string; rows?: PdfRow[]; paragraphs?: string[] }
export interface PdfReport {
    kind: string;          // "Company check", shown in the running header
    title: string;
    subtitle?: string[];
    flags?: { text: string; tone: Tone }[];
    sections: PdfSection[];
    notices?: string[];
    sources: string;
}

const RGB: Record<'ink' | 'mid' | 'pale' | 'rule' | 'accent' | Tone, [number, number, number]> = {
    ink: [38, 34, 30], mid: [98, 93, 87], pale: [150, 145, 138], rule: [214, 210, 203],
    accent: [52, 68, 140], crit: [176, 58, 38], warn: [150, 112, 32], mute: [120, 116, 110],
};
const base64 = async (url: string) => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
};

export async function buildPdf(r: PdfReport): Promise<Blob> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const [regular, bold] = await Promise.all([base64(regularUrl), base64(boldUrl)]);
    doc.addFileToVFS('LiberationSans-Regular.ttf', regular); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal');
    doc.addFileToVFS('LiberationSans-Bold.ttf', bold); doc.addFont('LiberationSans-Bold.ttf', 'LS', 'bold');

    const W = 210, M = 18, CW = W - 2 * M, TOP = 22, BOTTOM = 297 - 18;
    const PT = 0.3528; // mm per point
    let y = TOP;
    const style = (size: number, weight: 'normal' | 'bold' = 'normal', colour: keyof typeof RGB = 'ink') => {
        doc.setFont('LS', weight); doc.setFontSize(size); doc.setTextColor(...RGB[colour]);
    };
    const lineH = (size: number) => size * PT * 1.4;
    const need = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = TOP; } };
    const wrap = (s: string, size: number, weight: 'normal' | 'bold', width: number) => { style(size, weight); return doc.splitTextToSize(s, width) as string[]; };
    const block = (s: string, size: number, weight: 'normal' | 'bold' = 'normal', colour: keyof typeof RGB = 'ink', gap = 0) => {
        for (const l of wrap(s, size, weight, CW)) { need(lineH(size)); style(size, weight, colour); doc.text(l, M, y + size * PT); y += lineH(size); }
        y += gap;
    };
    const rule = () => { doc.setDrawColor(...RGB.rule); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); };

    // Heading
    block(`MITSUKETA · ${r.kind.toUpperCase()}`, 8, 'bold', 'accent', 2);
    block(r.title, 18, 'bold', 'ink', 1.5);
    for (const s of r.subtitle || []) block(s, 9.5, 'normal', 'mid');
    y += 4;

    // Warnings: a coloured bar beside each line, as on screen.
    for (const f of r.flags || []) {
        const lines = wrap(f.text, 10, 'bold', CW - 6);
        const h = lines.length * lineH(10) + 3;
        need(h);
        doc.setFillColor(...RGB[f.tone]); doc.rect(M, y, 1.2, h - 1, 'F');
        style(10, 'bold', f.tone);
        lines.forEach((l, i) => doc.text(l, M + 4, y + 1 + 10 * PT + i * lineH(10)));
        y += h + 1;
    }
    if (r.flags?.length) y += 2;

    for (const sec of r.sections) {
        need(14);
        y += 3;
        style(10, 'bold', 'ink'); doc.text(sec.title.toUpperCase(), M, y + 10 * PT);
        if (sec.aside) { style(9, 'normal', 'pale'); doc.text(sec.aside, W - M, y + 10 * PT, { align: 'right' }); }
        y += lineH(10) + 1; rule(); y += 1.5;
        for (const p of sec.paragraphs || []) block(p, 9.5, 'normal', 'mid', 1.5);
        for (const row of sec.rows || []) {
            style(10, 'bold');
            const rightW = row.right ? Math.min(40, doc.getTextWidth(row.right) + 4) : 0;
            const title = wrap(row.text, 10, 'bold', CW - rightW);
            const sub = row.sub ? wrap(row.sub, 8.5, 'normal', CW - rightW) : [];
            const h = title.length * lineH(10) + sub.length * lineH(8.5) + 2.5;
            need(h);
            const top = y;
            style(10, 'bold', row.tone === 'crit' || row.tone === 'warn' ? row.tone : 'ink');
            title.forEach(l => { doc.text(l, M, y + 10 * PT); y += lineH(10); });
            style(8.5, 'normal', row.tone === 'crit' ? 'crit' : 'mid');
            sub.forEach(l => { doc.text(l, M, y + 8.5 * PT); y += lineH(8.5); });
            if (row.right) { style(10, 'bold', 'ink'); doc.text(row.right, W - M, top + 10 * PT, { align: 'right' }); }
            if (row.url) doc.link(M, top, CW, h - 1, { url: row.url });
            y += 1; doc.setDrawColor(...RGB.rule); doc.setLineWidth(0.1); doc.line(M, y, W - M, y); y += 1.5;
        }
    }

    y += 4;
    for (const n of r.notices || []) block(n, 8, 'normal', 'mid', 1.5);
    block(r.sources, 8, 'normal', 'pale');

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        style(7.5, 'normal', 'pale');
        doc.text(`Mitsuketa · ${r.kind} · ${r.title}`.slice(0, 110), M, 297 - 9);
        doc.text(`Page ${i} of ${pages}`, W - M, 297 - 9, { align: 'right' });
    }
    return doc.output('blob');
}
