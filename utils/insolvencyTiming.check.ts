import assert from 'node:assert/strict';
import { insolvencyTiming } from './insolvencyTiming';

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
console.log('ok - insolvency timing');
