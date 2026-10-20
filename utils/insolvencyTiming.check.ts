import assert from 'node:assert/strict';
import { insolvencyTiming, insolvencyLinkedSummary } from './insolvencyTiming';

const r = (appointmentDate: string, resignationDate?: string, starts = ['2024-06-12']) => ({
    companyName: 'X', nzbn: '1', isDirector: true, shareholding: 0, status: '', roleType: 'Director',
    appointmentDate, resignationDate, insolvencyPeriods: starts.map(start => ({ type: 'Liquidation', start })),
});
assert.equal(insolvencyTiming(r('2018-01-01T11:41:27.000+1300')), 'in_office');
assert.equal(insolvencyTiming(r('2018-01-01', '2024-01-01')), 'resigned_before');
assert.equal(insolvencyTiming(r('2018-01-01', '2020-01-01')), 'left_earlier');
assert.equal(insolvencyTiming(r('2025-01-01')), 'appointed_after');
assert.equal(insolvencyTiming(r('2018-01-01', '2020-01-01', ['2019-05-01', '2024-06-12'])), 'in_office', 'any period in office wins');
assert.equal(insolvencyTiming(r('2018-01-01', undefined, [])), 'unknown');
assert.equal(insolvencyTiming({ ...r('2018-01-01'), isDirector: false }), 'not_director');
const linked = (a: string, r?: string) => ({ ...r_(a, r), hasHistoricInsolvency: true });
function r_(a: string, res?: string) { return { ...r(a, res), nzbn: a }; }
assert.equal(insolvencyLinkedSummary([linked('2018-01-01'), linked('2019-01-01')]).line, '2 Associated Companies with Insolvency History (Director at time of insolvency)');
assert.equal(insolvencyLinkedSummary([linked('2018-01-01'), linked('2025-01-01')]).line, '2 Associated Companies with Insolvency History (Director at time of insolvency for 1)');
assert.equal(insolvencyLinkedSummary([r('2018-01-01')]).count, 0);
console.log('ok - insolvency timing');
