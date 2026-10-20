import type { PersonCompanyResult } from '../types';

export type InsolvencyTiming = 'in_office' | 'resigned_before' | 'left_earlier' | 'appointed_after' | 'not_director' | 'unknown';

const YEAR = 365 * 24 * 60 * 60 * 1000;
// Register dates carry "+1300" offsets; day precision is all the comparison needs.
const day = (value?: string) => { const m = value?.match(/^\d{4}-\d{2}-\d{2}/); const t = m ? Date.parse(m[0]) : NaN; return Number.isFinite(t) ? t : null; };

/**
 * Where a director's appointment sat relative to each insolvency start.
 * Liquidators look back 12 months for voidable transactions, so a resignation
 * inside that window is reported, not treated as a clean exit.
 * Most serious finding wins: in office > resigned within 12 months > the rest.
 */
export function insolvencyTiming(r: PersonCompanyResult): InsolvencyTiming {
    if (!r.isDirector) return 'not_director';
    const starts = (r.insolvencyPeriods || []).map(p => day(p.start)).filter((t): t is number => t !== null);
    const appointed = day(r.appointmentDate);
    if (!starts.length || appointed === null) return 'unknown';
    const resigned = day(r.resignationDate);
    let best: InsolvencyTiming | null = null;
    for (const start of starts) {
        if (appointed <= start && (resigned === null || resigned >= start)) return 'in_office';
        if (resigned !== null && resigned < start && start - resigned <= YEAR) best = 'resigned_before';
        else if (best === null) best = appointed > start ? 'appointed_after' : 'left_earlier';
    }
    return best || 'unknown';
}

export const isInsolvencyLinked = (r: PersonCompanyResult) => !!(r.isInExternalAdmin || r.hasHistoricInsolvency);

export const TIMING_TEXT: Partial<Record<InsolvencyTiming, string>> = {
    in_office: 'Director at time of insolvency', resigned_before: 'Resigned within 12 months before',
    left_earlier: 'Left over 12 months before', appointed_after: 'Appointed after insolvency began',
};
/** Row label for a linked company, or '' when timing does not apply. */
export const timingLabel = (r: PersonCompanyResult) => isInsolvencyLinked(r) ? TIMING_TEXT[insolvencyTiming(r)] || '' : '';

/** Company outcomes for a person card, kept apart from register findings against the person. */
export function insolvencyLinkedSummary(results: PersonCompanyResult[]) {
    const linked = results.filter(isInsolvencyLinked).filter((r, i, all) => all.findIndex(o => o.nzbn === r.nzbn) === i);
    if (!linked.length) return { count: 0, line: '' };
    const timings = linked.map(insolvencyTiming);
    const n = (t: InsolvencyTiming) => timings.filter(x => x === t).length;
    const current = linked.filter(r => r.isInExternalAdmin).length;
    const detail = [
        n('in_office') ? `Director at time of insolvency${n('in_office') === linked.length ? '' : ` for ${n('in_office')}`}` : '',
        n('resigned_before') ? `Resigned within 12 months before ${n('resigned_before')}` : '',
    ].filter(Boolean).join('; ');
    const line = `${linked.length} Associated ${linked.length === 1 ? 'Company' : 'Companies'} with Insolvency History`
        + (current ? ` · ${current} Current` : '') + (detail ? ` (${detail})` : '');
    return { count: linked.length, line };
}
