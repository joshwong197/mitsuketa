import { buildPersonReportHtml } from './exportService';
import type { DisqualifiedDirector } from '../src/api/disqualifiedDirectorsApi';
import type { InsolvencyRecord } from '../src/api/insolvencyApi';

const historical: InsolvencyRecord = {
    estateNumber: 1, estateName: 'Alex Example', adjudicationOrLiquidationDate: '2012-01-01',
    insolvencyTypeDescription: 'Bankruptcy', multipleInsolvencies: false, insolvencyStatus: 'Discharged',
    dischargeOrCompletionDate: '2015-01-01', courtName: 'Example High Court',
};
const current: InsolvencyRecord = {
    ...historical, estateNumber: 2, insolvencyStatus: 'Current Bankrupt',
};
const disqualified: DisqualifiedDirector = {
    firstName: 'Alex', lastName: 'Example', disqualifiedDirectorId: '1',
    disqualificationCriteria: { criteria: [{ startDate: '2012-01-01', endDate: '2015-01-01' }, { startDate: '2025-01-01' }] },
};
const base = {
    personName: 'Alex Example', results: [], disqualified: [disqualified], insolvency: [historical, current],
    signatures: [], generatedAt: new Date('2026-01-02T03:04:05Z'),
};
const assertIncludes = (html: string, text: string) => {
    if (!html.includes(text)) throw new Error(`Expected report to include: ${text}`);
};

const unknown = buildPersonReportHtml(base);
assertIncludes(unknown, 'Register check completion not available.');
if (unknown.includes('Register checks · clear')) throw new Error('Report must not call unknown checks clear');
assertIncludes(unknown, 'current and historical records returned');
assertIncludes(unknown, 'Estate number');
assertIncludes(unknown, 'Example High Court');
assertIncludes(unknown, '2012-01-01');
assertIncludes(unknown, '2015-01-01');
if (unknown.includes('Identity not confirmed')) throw new Error('Duplicate header identity qualification must be removed');
assertIncludes(unknown, 'Individuals are matched by name');

const unavailable = buildPersonReportHtml({
    ...base, registerChecks: { disqualified: 'unavailable', insolvency: 'unavailable' },
});
assertIncludes(unavailable, 'Disqualified directors check unavailable.');
assertIncludes(unavailable, 'Insolvency check unavailable.');

const complete = buildPersonReportHtml({
    ...base, disqualified: [], insolvency: [],
    registerChecks: { disqualified: 'complete', insolvency: 'complete', checkedAt: Date.UTC(2026, 0, 2, 3, 4) },
});
assertIncludes(complete, 'No insolvency or disqualification name matches returned.');
assertIncludes(complete, 'Checked');
