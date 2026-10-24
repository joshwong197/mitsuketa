import { jsPDF } from 'jspdf';
// Liberation Sans ships with pdfjs-dist (SIL Open Font License). Embedding it gives
// the PDF macrons (Tānui, Ōtāhuhu), which the built-in PDF fonts cannot print.
import regularUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url';
import boldUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url';

// An A4 report drawn to match the HTML reports: the record card (spine, status,
// name, alerts, identifiers), an at-a-glance row, then kanji-marked sections.
// Text stays real text; only the kanji are small images, drawn with the app's
// own Shippori Mincho because the PDF fonts have no CJK glyphs.

export type Tone = 'crit' | 'warn' | 'mute';
export type CardTone = 'active' | 'crit' | 'warn' | 'faded';
export interface PdfRow { text: string; sub?: string; right?: string; tone?: Tone; url?: string }
export interface PdfSection { mark?: string; title: string; aside?: string; rows?: PdfRow[]; paragraphs?: string[] }
export interface PdfCard {
    spine: string;                 // 記録 · 人 · 登記
    spineTone?: 'accent' | 'crit';
    eyebrow: string;               // "Mitsuketa · Entity record"
    status?: { text: string; tone: CardTone };
    name: string;
    type?: string;
    alerts?: { text: string; tone: Tone }[];
    ids?: [string, string][];      // [label, value], value printed in mono
    footer?: [string, string];     // [label, value] bottom-left
    link?: { text: string; url: string };
}
export interface PdfReport {
    kind: string;                  // running footer, e.g. "Company check"
    card: PdfCard;
    glance?: [string, string][];   // [big value, label]
    flags?: { text: string; tone: Tone }[];
    sections: PdfSection[];
    notices?: string[];
    sources: string;
}

type RGB3 = [number, number, number];
const C: Record<string, RGB3> = {
    ink: [38, 34, 30], mid: [98, 93, 87], pale: [150, 145, 138], rule: [214, 210, 203], paper2: [236, 232, 223],
    accent: [52, 68, 140], accentInk: [246, 244, 238], crit: [176, 58, 38], warn: [150, 112, 32], mute: [120, 116, 110],
    critWash: [246, 230, 225], warnWash: [244, 238, 222], muteWash: [238, 236, 232],
};
const hex = (c: RGB3) => `rgb(${c.join(',')})`;
const base64 = async (url: string) => {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
};
const KANJI_FONT = '"Shippori Mincho", "Yu Mincho", "Noto Serif JP", serif';
/** Kanji on a coloured block as a PNG. Vertical stacks one glyph per line, like the HTML spine. */
async function kanjiImage(text: string, wMm: number, hMm: number, bg: RGB3, fg: RGB3, sizeMm: number, vertical = false, small?: string) {
    const px = 8; // px per mm ≈ 200 dpi: crisp in print, small in the file
    await document.fonts.load(`500 ${Math.round(sizeMm * px)}px "Shippori Mincho"`, text + (small || '')).catch(() => undefined);
    const c = document.createElement('canvas');
    c.width = Math.round(wMm * px); c.height = Math.round(hMm * px);
    const g = c.getContext('2d')!;
    g.fillStyle = hex(bg); g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = hex(fg); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `500 ${sizeMm * px}px ${KANJI_FONT}`;
    if (vertical) {
        [...text].forEach((ch, i) => g.fillText(ch, c.width / 2, (6 + sizeMm * 0.6 + i * sizeMm * 1.25) * px));
        if (small) {
            g.font = `500 ${2.6 * px}px ${KANJI_FONT}`;
            [...small].forEach((ch, i, all) => g.fillText(ch, c.width / 2, c.height - (5 + (all.length - 1 - i) * 3.4) * px));
        }
    } else g.fillText(text, c.width / 2, c.height / 2 + 0.3 * px);
    return c.toDataURL('image/png');
}

export async function buildPdf(r: PdfReport): Promise<Blob> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const [regular, bold] = await Promise.all([base64(regularUrl), base64(boldUrl)]);
    doc.addFileToVFS('LiberationSans-Regular.ttf', regular); doc.addFont('LiberationSans-Regular.ttf', 'LS', 'normal');
    doc.addFileToVFS('LiberationSans-Bold.ttf', bold); doc.addFont('LiberationSans-Bold.ttf', 'LS', 'bold');

    const W = 210, M = 16, CW = W - 2 * M, TOP = 16, BOTTOM = 297 - 18;
    const PT = 0.3528; // mm per point
    let y = TOP;
    const style = (size: number, weight: 'normal' | 'bold' = 'normal', colour: RGB3 = C.ink, font = 'LS') => {
        doc.setFont(font, weight); doc.setFontSize(size); doc.setTextColor(...colour);
    };
    const lineH = (size: number) => size * PT * 1.4;
    const need = (h: number) => { if (y + h > BOTTOM) { doc.addPage(); y = TOP; } };
    const wrap = (s: string, size: number, weight: 'normal' | 'bold', width: number, font = 'LS') => { style(size, weight, C.ink, font); return doc.splitTextToSize(s, width) as string[]; };
    const block = (s: string, size: number, weight: 'normal' | 'bold' = 'normal', colour: RGB3 = C.ink, gap = 0) => {
        for (const l of wrap(s, size, weight, CW)) { need(lineH(size)); style(size, weight, colour); doc.text(l, M, y + size * PT); y += lineH(size); }
        y += gap;
    };
    const toneRGB = (t: Tone | CardTone) => t === 'crit' ? C.crit : t === 'warn' ? C.warn : t === 'active' ? C.accent : C.mute;
    const washRGB = (t: Tone) => t === 'crit' ? C.critWash : t === 'warn' ? C.warnWash : C.muteWash;

    // ── Record card ──────────────────────────────────────────────────────────
    const card = r.card;
    const spineW = 14, pad = 6, mainX = M + spineW + pad, mainW = CW - spineW - 2 * pad;
    const nameLines = wrap(card.name, 19, 'bold', mainW);
    const alertLines = (card.alerts || []).map(a => wrap(a.text, 8.5, 'bold', mainW - 5));
    const idsText = (card.ids || []).map(([l, v]) => `${l}  ${v}`);
    const cardH = pad + lineH(7.5) + 4 + nameLines.length * lineH(19) + (card.type ? lineH(9.5) + 2 : 0) + 2
        + alertLines.reduce((h, l) => h + l.length * lineH(8.5) + 3, 0) + (alertLines.length ? 2 : 0)
        + (idsText.length ? lineH(9) + 2 : 0) + 4 + lineH(9) + pad;
    const cardTop = y;
    doc.setFillColor(...C.paper2); doc.rect(M + 1.6, cardTop + 1.6, CW, cardH, 'F');
    doc.setFillColor(255, 255, 255); doc.rect(M, cardTop, CW, cardH, 'F');
    doc.setDrawColor(...C.ink); doc.setLineWidth(0.35); doc.rect(M, cardTop, CW, cardH, 'S');
    const spineBg = card.spineTone === 'crit' ? C.crit : C.accent;
    doc.addImage(await kanjiImage(card.spine, spineW, cardH, spineBg, C.accentInk, card.spine.length > 1 ? 7 : 8.5, true, '見つけた'), 'PNG', M, cardTop, spineW, cardH, 'spine', 'FAST');
    y = cardTop + pad;
    style(7.5, 'normal', C.mid); doc.text(card.eyebrow.toUpperCase(), mainX, y + 7.5 * PT, { charSpace: 0.4 });
    if (card.status) {
        style(8.5, 'normal', toneRGB(card.status.tone));
        const sw = doc.getTextWidth(card.status.text) + 5, sx = mainX + mainW - sw;
        doc.setDrawColor(...toneRGB(card.status.tone)); doc.setLineWidth(0.3); doc.rect(sx, y - 1.3, sw, 5.6, 'S');
        doc.text(card.status.text, sx + 2.5, y + 2.8);
    }
    y += lineH(7.5) + 4;
    style(19, 'bold'); nameLines.forEach(l => { doc.text(l, mainX, y + 19 * PT); y += lineH(19); });
    if (card.type) { y += 1; style(9.5, 'normal', C.mid); doc.text(card.type, mainX, y + 9.5 * PT); y += lineH(9.5) + 1; }
    y += 2;
    (card.alerts || []).forEach((a, i) => {
        const lines = alertLines[i], h = lines.length * lineH(8.5) + 2;
        doc.setFillColor(...washRGB(a.tone)); doc.rect(mainX, y, mainW, h, 'F');
        doc.setFillColor(...toneRGB(a.tone)); doc.rect(mainX, y, 0.8, h, 'F');
        style(8.5, 'bold', toneRGB(a.tone)); lines.forEach((l, j) => doc.text(l, mainX + 3, y + 1 + 8.5 * PT + j * lineH(8.5)));
        y += h + 1;
    });
    if (alertLines.length) y += 2;
    if (idsText.length) {
        let x = mainX;
        for (const [label, value] of card.ids!) {
            style(8, 'normal', C.mid); doc.text(label, x, y + 9 * PT); x += doc.getTextWidth(label) + 2;
            style(9.5, 'normal', C.ink, 'courier'); doc.text(value, x, y + 9 * PT); x += doc.getTextWidth(value) + 8;
        }
        y += lineH(9) + 2;
    }
    y += 1; doc.setDrawColor(...C.rule); doc.setLineWidth(0.2); doc.line(mainX, y, mainX + mainW, y); y += 3;
    if (card.footer) { style(8.5, 'normal', C.mid); doc.text(card.footer[0], mainX, y + 9 * PT); const lw = doc.getTextWidth(card.footer[0]) + 2; style(8.5, 'bold'); doc.text(card.footer[1], mainX + lw, y + 9 * PT); }
    if (card.link) {
        style(8.5, 'normal', C.accent); const lw = doc.getTextWidth(card.link.text);
        doc.textWithLink(card.link.text, mainX + mainW - lw, y + 9 * PT, { url: card.link.url });
        doc.setDrawColor(...C.accent); doc.setLineWidth(0.15); doc.line(mainX + mainW - lw, y + 9 * PT + 0.8, mainX + mainW, y + 9 * PT + 0.8);
    }
    y = cardTop + cardH + 7;

    // ── At a glance ──────────────────────────────────────────────────────────
    if (r.glance?.length) {
        let x = M;
        for (const [value, label] of r.glance) {
            style(17, 'bold'); doc.text(value, x, y + 17 * PT);
            style(7.5, 'normal', C.mid); doc.text(label, x, y + lineH(17) + 2);
            x += Math.max(36, doc.getTextWidth(label) + 10);
        }
        y += lineH(17) + 7;
    }

    // Warnings outside the card: a coloured bar beside each line.
    for (const f of r.flags || []) {
        const lines = wrap(f.text, 9.5, 'bold', CW - 6);
        const h = lines.length * lineH(9.5) + 3;
        need(h);
        doc.setFillColor(...washRGB(f.tone)); doc.rect(M, y, CW, h - 0.5, 'F');
        doc.setFillColor(...toneRGB(f.tone)); doc.rect(M, y, 1, h - 0.5, 'F');
        style(9.5, 'bold', toneRGB(f.tone));
        lines.forEach((l, i) => doc.text(l, M + 4, y + 1.2 + 9.5 * PT + i * lineH(9.5)));
        y += h + 1.5;
    }

    // ── Sections ─────────────────────────────────────────────────────────────
    for (const sec of r.sections) {
        need(18);
        y += 4;
        const markW = sec.mark ? 6 + (sec.mark.length - 1) * 4 : 0;
        // Alias by glyph so a mark used twice is embedded once.
        if (sec.mark) doc.addImage(await kanjiImage(sec.mark, markW, 6, C.accent, C.accentInk, 4.2), 'PNG', M, y, markW, 6, `mark-${sec.mark}`, 'FAST');
        style(11, 'bold'); doc.text(sec.title, M + (markW ? markW + 3 : 0), y + 4.4);
        if (sec.aside) { style(8.5, 'normal', C.pale); doc.text(sec.aside, W - M, y + 4.4, { align: 'right' }); }
        y += 8; doc.setDrawColor(...C.ink); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 2.5;
        for (const p of sec.paragraphs || []) block(p, 9, 'normal', C.mid, 1.5);
        for (const row of sec.rows || []) {
            style(10, 'bold');
            const rightW = row.right ? Math.min(40, doc.getTextWidth(row.right) + 4) : 0;
            const title = wrap(row.text, 10, 'bold', CW - rightW);
            const sub = row.sub ? wrap(row.sub, 8.5, 'normal', CW - rightW) : [];
            const h = title.length * lineH(10) + sub.length * lineH(8.5) + 2.5;
            need(h);
            const top = y;
            style(10, 'bold', row.tone === 'crit' ? C.crit : row.tone === 'warn' ? C.warn : row.tone === 'mute' ? C.mid : C.ink);
            title.forEach(l => { doc.text(l, M, y + 10 * PT); y += lineH(10); });
            style(8.5, 'normal', row.tone === 'crit' ? C.crit : C.mid);
            sub.forEach(l => { doc.text(l, M, y + 8.5 * PT); y += lineH(8.5); });
            if (row.right) { style(10, 'bold'); doc.text(row.right, W - M, top + 10 * PT, { align: 'right' }); }
            if (row.url) doc.link(M, top, CW, h - 1, { url: row.url });
            y += 1; doc.setDrawColor(...C.rule); doc.setLineWidth(0.1); doc.line(M, y, W - M, y); y += 1.5;
        }
    }

    y += 5;
    for (const n of r.notices || []) block(n, 8, 'normal', C.mid, 1.5);
    block(r.sources, 8, 'normal', C.pale);

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        style(7.5, 'normal', C.pale);
        doc.text(`Mitsuketa · ${r.kind} · ${card.name}`.slice(0, 110), M, 297 - 9);
        doc.text(`Page ${i} of ${pages}`, W - M, 297 - 9, { align: 'right' });
    }
    return doc.output('blob');
}
